import { GoogleGenerativeAI } from '@google/generative-ai';
// No config/env import here to be ultra safe against circular imports during init

// ──────────────────────────────────────────────────────────────────────────────
// Heuristic helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts a raw field_name / fieldName / field-name into human-readable words.
 * Also strips common HR-data suffixes that rarely add meaning in a description.
 */
function humanizeFieldName(name: string): string {
  // 1. Replace underscores / hyphens with spaces
  let h = name.replace(/[_\-]/g, ' ');

  // 2. Split camelCase → words  (e.g. "employeeId" → "employee Id")
  h = h.replace(/([a-z])([A-Z])/g, '$1 $2');

  // 3. Lower-case everything
  h = h.toLowerCase().trim();

  // 4. Strip trailing noise tokens that add no context
  const noiSuffixes = [' id', ' at', ' by', ' on', ' ts', ' flag', ' code'];
  for (const suffix of noiSuffixes) {
    if (h.endsWith(suffix)) {
      h = h.slice(0, -suffix.length).trim();
      break;
    }
  }

  return h;
}

/**
 * Infer the semantic role of the field purely from its name, giving the LLM
 * extra context so it produces accurate, HR-domain descriptions.
 */
function inferSemanticRole(name: string): string {
  const n = name.toLowerCase();

  if (n.includes('_id') || n.endsWith('id'))   return 'unique identifier or foreign-key reference';
  if (n.endsWith('_at') || n.endsWith('_date') || n.includes('date') || n.includes('_on'))
                                                  return 'date/timestamp value';
  if (n.endsWith('_by') || n.includes('created_by') || n.includes('updated_by'))
                                                  return 'actor / responsible user reference';
  if (n.includes('status') || n.includes('state')) return 'status or lifecycle state';
  if (n.includes('salary') || n.includes('pay') || n.includes('wage') || n.includes('ctc'))
                                                  return 'compensation / remuneration value';
  if (n.includes('department') || n.includes('dept')) return 'department classification';
  if (n.includes('grade') || n.includes('level') || n.includes('band'))
                                                  return 'job grade or seniority level';
  if (n.includes('location') || n.includes('city') || n.includes('site'))
                                                  return 'geographic location';
  if (n.includes('name') || n.includes('title')) return 'human-readable name or label';
  if (n.includes('email') || n.includes('phone') || n.includes('contact'))
                                                  return 'contact information';
  if (n.includes('manager') || n.includes('supervisor') || n.includes('reporting'))
                                                  return 'reporting hierarchy reference';
  if (n.includes('join') || n.includes('doj') || n.includes('hire'))
                                                  return 'joining / hire date';
  if (n.includes('exit') || n.includes('term') || n.includes('resignation'))
                                                  return 'exit or termination event';
  if (n.includes('flag') || n.includes('is_') || n.includes('has_'))
                                                  return 'boolean flag / indicator';
  if (n.includes('count') || n.includes('total') || n.includes('num'))
                                                  return 'numeric count or aggregate';

  return 'data attribute';
}

// ──────────────────────────────────────────────────────────────────────────────
// LLM Service
// ──────────────────────────────────────────────────────────────────────────────

export class LLMService {
  private static client: GoogleGenerativeAI | null = null;

  private static getClient(): GoogleGenerativeAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      console.log('[LLMService] Initializing with process.env.GEMINI_API_KEY present:', !!apiKey);
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured in environment or .env');
      }
      this.client = new GoogleGenerativeAI(apiKey);
    }
    return this.client;
  }

  /**
   * Heuristic-only fallback — guaranteed to never throw.
   * Produces a clean, HR-domain appropriate definition using semantic roles.
   */
  static heuristicFallback(fieldName: string, collectionName: string, fieldType: string): string {
    const humanField = humanizeFieldName(fieldName);
    const role = inferSemanticRole(fieldName);
    const entity = collectionName.replace(/s$/, '').replace(/[_\-]/g, ' ').toLowerCase();

    const typePrefix: Record<string, string> = {
      date:      'The date and time of',
      boolean:   'A flag indicating whether',
      number:    'The numeric value for',
      reference: 'The unique reference to the related',
    };
    const prefix = typePrefix[fieldType] ?? 'The value representing';

    // Special case for IDs to keep them extremely concise
    if (role.includes('identifier')) {
      return `The unique identifier for the ${entity} ${humanField}.`;
    }

    return `${prefix} ${humanField} within the ${entity} record, serving as the ${role}.`;
  }

  /**
   * Generate a concise, factual field description using Gemini.
   * Falls back to the heuristic string on any error so the rest of the
   * request never fails due to an LLM quota or network issue.
   */
  static async generateFieldDescription(
    fieldName: string,
    collectionName: string,
    fieldType: string,
    module: string = 'HR',
  ): Promise<{ description: string; source: 'ai' | 'fallback' }> {
    const humanField  = humanizeFieldName(fieldName);
    const semanticRole = inferSemanticRole(fieldName);
    const entity      = collectionName.replace(/[_\-]/g, ' ').toLowerCase();

    const prompt = `You are a professional HR data architect at Darwinbox.
Your task is to write a single, professional, factual description (max 25 words) for a database field in the ${module} module.

Context:
- Field: ${fieldName} (${humanField})
- Entity: ${entity}
- Type: ${fieldType}
- Context/Role: ${semanticRole}

Rules:
- Format: "The [human field name] [rest of description]..."
- Tone: Professional, direct, and factual.
- No conversational fillers, quotes, or markdown.
- Focus on the HR business value of this attribute.

Description:`;

    try {
      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1, // Lower temperature for more factual consistency
          maxOutputTokens: 60,
          topP: 0.8,
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/^"+|"+$/g, '').trim();

      // Basic validation: if too short or basically empty, use fallback
      if (!text || text.length < 5 || text.toLowerCase().includes('i record')) {
        return { description: this.heuristicFallback(fieldName, collectionName, fieldType), source: 'fallback' };
      }

      return { description: text, source: 'ai' };
    } catch (err) {
      console.warn(`[LLMService] Gemini call failed for "${fieldName}":`, (err as Error).message);
      return { description: this.heuristicFallback(fieldName, collectionName, fieldType), source: 'fallback' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Natural Language → Metric Formula Generation
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Schema context entry from the catalog dictionary endpoint.
   */
  static formatSchemaForPrompt(schema: { slug: string; name: string; fields: { name: string; type: string; description: string }[] }[]): string {
    return schema.map(c =>
      `Collection: "${c.slug}" (${c.name})\n  Fields:\n${c.fields.map(f => 
        `    - ${f.name} [${f.type}]${f.description ? `: ${f.description}` : ''}`
      ).join('\n')}`
    ).join('\n\n');
  }

  /**
   * Generate a metric formula from natural language using Gemini LLM.
   * Falls back to heuristicFormulaParser on any LLM error.
   */
  static async generateMetricFormula(
    prompt: string,
    schema: { slug: string; name: string; fields: { name: string; type: string; description: string }[] }[],
  ): Promise<{ formula: string; source: 'ai' | 'heuristic'; error?: string }> {
    const schemaText = this.formatSchemaForPrompt(schema);

    const systemPrompt = `You are a metric formula generator for an HR analytics platform at Darwinbox.

Your job: convert a natural language description into a metric formula using ONLY the syntax and schema below.

## Formula Syntax Rules
- Supported functions: COUNT, SUM, AVG, MIN, MAX
- COUNT syntax: COUNT(collection) or COUNT(collection WHERE field = "value")
- Other functions: FUNC(collection.field) or FUNC(collection.field WHERE field = "value")
- Cross-collection WHERE: FUNC(collection.field WHERE other_collection.field = "value")
- Arithmetic: formulas can be combined with +, -, *, / and parentheses
- String values in WHERE must be wrapped in double quotes

## Available Schema (Context is key!)
${schemaText}

## Critical Prompting Rules
- ONLY use collection slugs and field names from the schema provided.
- PRIORITIZE numeric fields for SUM, AVG, MIN, MAX. Check the field [type] in the schema.
- USE field descriptions to resolve ambiguity. If the prompt asks for "Active" and a field says "Employment status", use that field.
- Output ONLY the raw formula string — no explanation, no markdown, no quotes.
- If the request is ambiguous, make a reasonable assumption using the most likely collection/field based on descriptions.
- For "count" or "total" requests without a specific field, use COUNT(collection).
- Match field names case-insensitively against the schema but use the exact casing from the schema in your output.

## Examples
Input: "Count all active employees"
Output: COUNT(employees WHERE status = "Active")

Input: "Average salary of employees in Engineering"
Output: AVG(employees.base_pay WHERE department = "Engineering")

Input: "Total payroll cost this month"
Output: SUM(payroll.net_salary)

Now generate the formula for:
${prompt}`;

    try {
      const genAI = this.getClient();
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 150,
          topP: 0.9,
        },
      });

      const result = await model.generateContent(systemPrompt);
      let formula = result.response.text().trim();

      // Strip any wrapping quotes or backticks the LLM might add
      formula = formula.replace(/^[`"']+|[`"']+$/g, '').trim();

      // Strip any markdown code fence
      formula = formula.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

      if (!formula || formula.length < 3) {
        console.warn('[LLMService] LLM returned empty/too-short formula, falling back to heuristic');
        return this.heuristicFormulaParser(prompt, schema);
      }

      return { formula, source: 'ai' };
    } catch (err: any) {
      const errorMsg = err.stack || err.message || 'Unknown error';
      console.warn('[LLMService] Gemini formula generation failed:', errorMsg);
      const fallback = this.heuristicFormulaParser(prompt, schema);
      return { ...fallback, error: errorMsg };
    }
  }

  /**
   * Heuristic fallback parser: maps common natural language patterns to formula syntax.
   * Uses fuzzy matching against the provided schema to resolve collection/field names.
   */
  static heuristicFormulaParser(
    prompt: string,
    schema: { slug: string; name: string; fields: { name: string; type: string; description: string }[] }[],
  ): { formula: string; source: 'heuristic' } {
    const lower = prompt.toLowerCase().trim();

    // ── Step 1: Determine aggregation function ──
    let func = 'COUNT';
    const hasTotal = /\btotal\b/.test(lower);
    const hasSumOf = /\b(sum\s+of|total\s+of|total\s+amount)\b/.test(lower);
    
    if (/\b(average|avg|mean)\b/.test(lower)) func = 'AVG';
    else if (/\b(sum|total\s+of|sum\s+of|total\s+amount)\b/.test(lower)) func = 'SUM';
    else if (/\b(minimum|min|lowest|smallest)\b/.test(lower)) func = 'MIN';
    else if (/\b(maximum|max|highest|largest|top)\b/.test(lower)) func = 'MAX';
    // If "total" is mentioned but not specifically "total of", and we have hints of numeric fields, SUM often makes more sense for "Total X"
    else if (hasTotal && /\b(salary|pay|net|gross|amount|cost|wage|ctc)\b/.test(lower)) func = 'SUM';
    else if (/\b(count|how\s+many|number\s+of|headcount|total)\b/.test(lower)) func = 'COUNT';

    // ── Step 2: Find the target collection ──
    let matchedCollection: { slug: string; name: string; fields: { name: string; type: string; description: string }[] } | null = null;

    // Try 1: match collection by slug or name appearing in the prompt
    for (const coll of schema) {
      const slugLower = coll.slug.toLowerCase();
      const nameLower = coll.name.toLowerCase();
      // Match plural/singular forms
      const slugSingular = slugLower.replace(/s$/, '');
      if (lower.includes(slugLower) || lower.includes(nameLower) || lower.includes(slugSingular)) {
        matchedCollection = coll;
        break;
      }
    }

    // Try 2: If no collection name found, check which collection has the "best" matching field
    if (!matchedCollection) {
      let bestMatchLength = 0;
      for (const coll of schema) {
        for (const field of coll.fields) {
          const fName = field.name.toLowerCase();
          const fHuman = humanizeFieldName(field.name);
          const regex = new RegExp(`\\b(${fName.replace(/_/g, '[_ ]')}|${fHuman})\\b`, 'i');
          const match = lower.match(regex);
          if (match && match[0].length > bestMatchLength) {
            bestMatchLength = match[0].length;
            matchedCollection = coll;
          }
        }
      }
    }

    // Fallback: use the first one (most likely "employees" in HR context)
    if (!matchedCollection && schema.length > 0) {
      matchedCollection = schema[0];
    }

    if (!matchedCollection) {
      throw new Error('Could not determine a target collection from the prompt. Please mention a collection name (e.g., "employees", "payroll").');
    }

    // ── Step 3: Find the target field (for non-COUNT functions) ──
    let matchedField: string | null = null;

    if (func !== 'COUNT') {
      // Try to find a field mentioned in the prompt
      for (const field of matchedCollection.fields) {
        const fName = field.name.toLowerCase();
        const fHuman = humanizeFieldName(field.name);
        const regex = new RegExp(`\\b(${fName.replace(/_/g, '[_ ]')}|${fHuman})\\b`, 'i');
        if (regex.test(lower)) {
          matchedField = field.name;
          break;
        }
      }

      // If no field found, try semantic guessing based on function
      if (!matchedField) {
        const numericHints = ['salary', 'pay', 'wage', 'amount', 'cost', 'ctc', 'net_salary', 'gross_salary', 'price', 'value', 'total', 'count', 'score', 'rating', 'age'];
        for (const hint of numericHints) {
          const found = matchedCollection.fields.find(f => f.name.toLowerCase().includes(hint));
          if (found) { matchedField = found.name; break; }
        }
      }

      if (!matchedField) {
        throw new Error(`Could not determine a numeric field for ${func}(). Please mention a field name (e.g., "salary", "net_salary").`);
      }
    }

    // ── Step 4: Extract WHERE condition ──
    let whereClause = '';

    // Patterns: "where X is Y", "where X = Y", "with X Y", "in Y department", "who are Y"
    const wherePatterns = [
      /where\s+(\w+)\s+(?:is|=|equals?)\s+["']?([^"']+?)["']?\s*$/i,
      /where\s+(\w+)\s*=\s*["']?([^"']+?)["']?\s*$/i,
      /(?:with|having)\s+(\w+)\s+(?:as|=|of)?\s*["']?([^"']+?)["']?\s*$/i,
      /\bwho\s+are\s+["']?(\w+)["']?/i,
      /\bin\s+["']?([^"']+?)["']?\s+(?:department|dept|team|group|division)/i,
      /\bof\s+["']?([^"']+?)["']?\s+(?:department|dept|team|group|division)/i,
    ];

    for (const pattern of wherePatterns) {
      const match = lower.match(pattern);
      if (match) {
        if (pattern === wherePatterns[3]) {
          // "who are Active" → status = "Active"
          const statusField = matchedCollection.fields.find(f =>
            f.name.toLowerCase().includes('status') || f.name.toLowerCase().includes('state')
          );
          if (statusField) {
            const val = match[1].charAt(0).toUpperCase() + match[1].slice(1);
            whereClause = ` WHERE ${statusField.name} = "${val}"`;
          }
        } else if (pattern === wherePatterns[4] || pattern === wherePatterns[5]) {
          // "in Engineering department"
          const deptField = matchedCollection.fields.find(f =>
            f.name.toLowerCase().includes('department') || f.name.toLowerCase().includes('dept')
          );
          if (deptField) {
            const val = match[1].charAt(0).toUpperCase() + match[1].slice(1);
            whereClause = ` WHERE ${deptField.name} = "${val}"`;
          }
        } else {
          // Generic "where field is value"
          const fieldName = match[1];
          const fieldValue = match[2].trim();
          // Try to match "field" against actual schema fields
          const resolvedField = matchedCollection.fields.find(f =>
            f.name.toLowerCase() === fieldName.toLowerCase() ||
            humanizeFieldName(f.name) === fieldName.toLowerCase()
          );
          if (resolvedField) {
            const val = fieldValue.charAt(0).toUpperCase() + fieldValue.slice(1);
            whereClause = ` WHERE ${resolvedField.name} = "${val}"`;
          }
        }
        break;
      }
    }

    // Also check for "active" keyword as a special shorthand
    if (!whereClause && /\bactive\b/i.test(lower)) {
      const statusField = matchedCollection.fields.find(f =>
        f.name.toLowerCase().includes('status') || f.name.toLowerCase().includes('state') || f.name.toLowerCase().includes('employment_status')
      );
      if (statusField) {
        whereClause = ` WHERE ${statusField.name} = "Active"`;
      }
    }

    // ── Step 5: Assemble formula ──
    let formula: string;
    if (func === 'COUNT') {
      formula = `${func}(${matchedCollection.slug}${whereClause})`;
    } else {
      formula = `${func}(${matchedCollection.slug}.${matchedField}${whereClause})`;
    }

    return { formula, source: 'heuristic' };
  }
}
