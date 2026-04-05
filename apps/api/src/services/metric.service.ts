import mongoose from 'mongoose';
import { PermissionService } from './permission.service';
import { Relationship } from '../models/relationship.model';
import { AppError } from '../utils/errors';

export interface ParsedToken {
  raw: string;
  func: string;
  collection: string;
  field: string | null;
  whereField: string | null;
  whereValue: string | null;
}

export class MetricService {
  /**
   * Parses formula tokens like:
   *   COUNT(employees)
   *   SUM(employees.salary)
   *   AVG(payroll.net_salary WHERE department = "Engineering")
   *   COUNT(employees WHERE status = 'Active')
   * Supports both single and double quoted string values in WHERE clauses.
   */
  static parseTokens(formula: string): ParsedToken[] {
    const regex = /(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?(?:\s+WHERE\s+([a-zA-Z0-9_.]+)\s*=\s*["']([^"']+)["'])?\s*\)/gi;
    const tokens: ParsedToken[] = [];
    let match;
    while ((match = regex.exec(formula)) !== null) {
      tokens.push({
        raw: match[0],
        func: match[1].toUpperCase(),
        collection: match[2],
        field: match[3] || null,
        whereField: match[4] || null,
        whereValue: match[5] || null
      });
    }
    return tokens;
  }

  /**
   * Validates formula syntax without executing it.
   * Returns parsed tokens on success, throws AppError on failure.
   */
  static async validateSyntax(formula: string): Promise<ParsedToken[]> {
    if (!formula || formula.trim().length === 0) {
      throw new AppError(400, 'INVALID_FORMULA', 'Formula cannot be empty.');
    }

    const tokens = this.parseTokens(formula);

    if (tokens.length === 0) {
      throw new AppError(400, 'INVALID_FORMULA', 
        'No valid aggregation functions found. Use COUNT(collection), SUM(collection.field), AVG(collection.field), MIN(collection.field), or MAX(collection.field).');
    }

    for (const t of tokens) {
      if (t.func !== 'COUNT' && !t.field) {
        throw new AppError(400, 'INVALID_FORMULA', 
          `${t.func}() requires a field reference. Example: ${t.func}(${t.collection}.fieldName)`);
      }
    }

    // Validate that the arithmetic expression is structurally sound
    let testExpr = formula;
    for (const token of tokens) {
      testExpr = testExpr.replace(token.raw, '1');
    }
    const sanitized = testExpr.replace(/[^0-9+\-*/(). ]/g, '');
    try {
      new Function('return ' + sanitized)();
    } catch {
      throw new AppError(400, 'INVALID_FORMULA', 
        'The arithmetic expression around the aggregate functions is invalid. Check for mismatched parentheses or operators.');
    }

    return tokens;
  }

  /**
   * Evaluates a single parsed token against the database with permission checks.
   */
  static async evaluateToken(token: ParsedToken, userId: string): Promise<number> {
    // Determine the actual MongoDB collection to query
    let queryCollection = token.collection;
    let whereField = token.whereField;
    let foreignColl: string | null = null;
    let foreignField: string | null = null;

    // Handle cross-collection WHERE: e.g. WHERE employees.department = "Engineering"
    if (whereField && whereField.includes('.')) {
      const parts = whereField.split('.');
      if (parts[0] !== queryCollection) {
        foreignColl = parts[0];
        foreignField = parts.slice(1).join('.');
      } else {
        whereField = parts.slice(1).join('.');
      }
    }

    // Permission check: collection-level read access for base
    const resolved = await PermissionService.resolveCollectionPermissions(userId, queryCollection, false);
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 
        `You do not have read access to collection '${queryCollection}'.`);
    }

    // Permission check: field-level access for base
    if (token.field) {
      PermissionService.assertFieldsAccessible([token.field], resolved);
    }
    if (whereField && !foreignColl) {
      PermissionService.assertFieldsAccessible([whereField], resolved);
    }

    const permMatch = PermissionService.buildMongoQuery(resolved);
    const aggregationPipeline: any[] = [];

    if (Object.keys(permMatch).length > 0) {
      aggregationPipeline.push({ $match: permMatch });
    }

    if (foreignColl && foreignField) {
      const foreignResolved = await PermissionService.resolveCollectionPermissions(userId, foreignColl, false);
      if (!foreignResolved || !foreignResolved.canRead) {
        throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 
          `Cross-collection query requires read access to '${foreignColl}'.`);
      }
      const db = mongoose.connection.db;
      if (!db) throw new AppError(500, 'DB_ERROR', 'Database connection not available.');

      const qCollObj = await db.collection('collections').findOne({ slug: queryCollection });
      const fCollObj = await db.collection('collections').findOne({ slug: foreignColl });

      if (!qCollObj || !fCollObj) {
         throw new AppError(400, 'CROSS_COLLECTION_ERROR', `Lookup failed: Cannot resolve metadata for '${queryCollection}' or '${foreignColl}'.`);
      }

      // Check relationships using resolved ObjectIDs
      const rel = await Relationship.findOne({
        $or: [
          { sourceCollectionId: qCollObj._id, targetCollectionId: fCollObj._id },
          { targetCollectionId: qCollObj._id, sourceCollectionId: fCollObj._id }
        ]
      }).lean();

      if (!rel) {
         throw new AppError(400, 'CROSS_COLLECTION_ERROR', `No relationship defined between '${queryCollection}' and '${foreignColl}'.`);
      }

      // Resolve field names from ObjectIDs
      const isQuerySource = String(rel.sourceCollectionId) === String(qCollObj._id);
      const localFieldId = isQuerySource ? rel.sourceFieldId : rel.targetFieldId;
      const remoteFieldId = isQuerySource ? rel.targetFieldId : rel.sourceFieldId;

      const localFieldMeta = await db.collection('fields').findOne({ _id: localFieldId });
      const remoteFieldMeta = await db.collection('fields').findOne({ _id: remoteFieldId });

      if (!localFieldMeta || !remoteFieldMeta) {
         throw new AppError(500, 'CROSS_COLLECTION_ERROR', 'Relationship references missing field metadata.');
      }

      const localField = localFieldMeta.fieldName;
      const remoteField = remoteFieldMeta.fieldName;

      const foreignPermMatch = PermissionService.buildMongoQuery(foreignResolved);
      
      const pipelineMatch: any = {
         $expr: { $eq: [`$${remoteField}`, "$$local_id"] }
      };

      if (Object.keys(foreignPermMatch).length > 0) {
         pipelineMatch.$and = [foreignPermMatch];
      }
      
      if (token.whereValue) {
         pipelineMatch.$and = pipelineMatch.$and || [];
         pipelineMatch.$and.push({ [foreignField]: { $regex: new RegExp(`^${token.whereValue}$`, 'i') } });
      }

      aggregationPipeline.push({
         $lookup: {
            from: foreignColl,
            let: { local_id: `$${localField}` },
            pipeline: [
               { $match: pipelineMatch }
            ],
            as: "__joined"
         }
      });

      aggregationPipeline.push({ $match: { "__joined": { $ne: [] } } });

    } else if (whereField && token.whereValue) {
      aggregationPipeline.push({
         $match: { [whereField]: { $regex: new RegExp(`^${token.whereValue}$`, 'i') } }
      });
    }

    // Build aggregation group stage
    const groupStage: any = { _id: null };
    if (token.func === 'COUNT') {
      groupStage.val = { $sum: 1 };
    } else {
      const op = `$${token.func.toLowerCase()}`;
      groupStage.val = { [op]: `$${token.field}` };
    }

    aggregationPipeline.push({ $group: groupStage });

    if (!mongoose.connection.db) {
      throw new AppError(500, 'DB_ERROR', 'Database connection not available.');
    }

    const result = await mongoose.connection.db.collection(queryCollection).aggregate(aggregationPipeline).toArray();

    return result.length > 0 ? (result[0].val ?? 0) : 0;
  }

  /**
   * Evaluates a full formula expression by parsing tokens, evaluating each one,
   * substituting results, then evaluating the arithmetic expression.
   */
  static async previewFormula(formula: string, userId: string): Promise<number> {
    const tokens = await this.validateSyntax(formula);
    let evaluationString = formula;

    for (const token of tokens) {
      const val = await this.evaluateToken(token, userId);
      evaluationString = evaluationString.replace(token.raw, val.toString());
    }

    const sanitized = evaluationString.replace(/[^0-9+\-*/(). ]/g, '');
    try {
      const result = new Function('return ' + sanitized)();
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Result is not a valid number');
      }
      return result;
    } catch {
      throw new AppError(400, 'FORMULA_ERROR', 
        'Arithmetic evaluation failed. Check the formula syntax around operators and parentheses.');
    }
  }
}
