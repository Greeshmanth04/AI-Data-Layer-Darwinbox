import { GoogleGenerativeAI } from '@google/generative-ai';

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
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured');
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
}
