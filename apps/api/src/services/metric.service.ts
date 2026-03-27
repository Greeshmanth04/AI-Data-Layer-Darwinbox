import mongoose from 'mongoose';
import { PermissionService } from './permission.service';
import { AppError } from '../utils/errors';

export class MetricService {
  static parseTokens(formula: string) {
    const regex = /(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?(?:\s+WHERE\s+([a-zA-Z0-9_]+)\s*=\s*'([^']+)')?\s*\)/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(formula)) !== null) {
      tokens.push({
        raw: match[0],
        func: match[1],
        collection: match[2],
        field: match[3] || null,
        whereField: match[4] || null,
        whereValue: match[5] || null
      });
    }
    return tokens;
  }

  static async validateSyntax(formula: string) {
    const tokens = this.parseTokens(formula);
    if (tokens.length === 0) {
      throw new AppError(400, 'INVALID_FORMULA', 'Formula contains no valid aggregation tokens.');
    }
    for (const t of tokens) {
      if (t.func !== 'COUNT' && !t.field) {
        throw new AppError(400, 'INVALID_FORMULA', `Function ${t.func} requires a field strictly natively (e.g. ${t.func}(${t.collection}.fieldName)).`);
      }
    }
    return tokens;
  }

  static async evaluateToken(token: any, userId: string): Promise<number> {
    const resolved = await PermissionService.resolveCollectionPermissions(userId, token.collection, false);
    if (!resolved || !resolved.canRead) {
       throw new AppError(403, 'COLLECTION_ACCESS_DENIED', `Formula requires reads against natively Restricted Collection: ${token.collection}`);
    }

    const fieldsToCheck = [];
    if (token.field) fieldsToCheck.push(token.field);
    if (token.whereField) fieldsToCheck.push(token.whereField);
    
    if (fieldsToCheck.length > 0) {
      PermissionService.assertFieldsAccessible(fieldsToCheck, resolved);
    }

    const matchStage: any = PermissionService.buildMongoQuery(resolved);
    const finalMatch: any = {};
    if (Object.keys(matchStage).length > 0) {
       finalMatch.$and = [matchStage];
    }

    if (token.whereField && token.whereValue) {
      if (!finalMatch.$and) finalMatch.$and = [];
      finalMatch.$and.push({ [token.whereField]: { $regex: new RegExp(`^${token.whereValue}$`, 'i') } }); 
    }

    let groupStage: any = { _id: null };
    if (token.func === 'COUNT') {
      groupStage.val = { $sum: 1 };
    } else {
      const op = `$${token.func.toLowerCase()}`;
      groupStage.val = { [op]: `$${token.field}` };
    }

    if (!mongoose.connection.db) throw new AppError(500, 'DB_ERROR', 'Database not initialized appropriately.');

    const result = await mongoose.connection.db.collection(token.collection).aggregate([
      { $match: Object.keys(finalMatch).length > 0 ? finalMatch : {} },
      { $group: groupStage }
    ]).toArray();

    return result.length > 0 ? (result[0].val || 0) : 0;
  }

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
      if (typeof result !== 'number' || isNaN(result)) throw new Error('Math failure');
      return result;
    } catch (e) {
      throw new AppError(400, 'FORMULA_ERROR', 'Arithmetic evaluation failed syntactically globally cleanly.');
    }
  }
}
