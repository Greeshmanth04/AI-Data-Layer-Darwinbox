import { User } from '../models/user.model';
import { Group, IRowFilter } from '../models/group.model';
import { UserGroup } from '../models/userGroup.model';
import { AppError } from '../utils/errors';

export interface ResolvedPermissions {
  canRead: boolean;
  effectiveFields: {
    allowed: string[];
    denied: string[];
  };
  rowFilters: any[];
}

export class PermissionService {

  private static parseOperator(filter: IRowFilter): any {
    const { field, operator, value } = filter;
    switch (operator) {
      case 'equals': return { [field]: value };
      case 'contains': return { [field]: { $regex: value, $options: 'i' } };
      case 'in': return { [field]: { $in: Array.isArray(value) ? value : [value] } };
      case 'gt': return { [field]: { $gt: value } };
      case 'lt': return { [field]: { $lt: value } };
      default: return {};
    }
  }

  private static transformFiltersToMongo(filters: IRowFilter[]): any {
    if (!filters || filters.length === 0) return {};
    if (filters.length === 1) return this.parseOperator(filters[0]);
    const andClauses = filters.map(f => this.parseOperator(f));
    return { $and: andClauses };
  }

  static async resolveCollectionPermissions(userId: string, collectionName: string, throwOnDeny: boolean = true): Promise<ResolvedPermissions | null> {
    const user = await User.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    if (user.role === 'platform_admin') {
      return { canRead: true, effectiveFields: { allowed: [], denied: [] }, rowFilters: [] };
    }

    const userGroups = await UserGroup.find({ userId });
    const groupIds = userGroups.map(ug => ug.groupId);
    const groups = await Group.find({ _id: { $in: groupIds } });

    let canRead = false;
    let allowedAll = false;
    const allowedSet = new Set<string>();
    const deniedSet = new Set<string>();
    const combinedRowFilters: any[] = [];

    for (const group of groups) {
      if (!group.permissions) continue;
      
      const perm = group.permissions.find(p => p.collectionName === collectionName);
      
      if (perm && perm.canRead) {
        canRead = true;

        if (!perm.allowedFields || perm.allowedFields.length === 0) allowedAll = true;
        else perm.allowedFields.forEach(f => allowedSet.add(f));

        if (perm.deniedFields) perm.deniedFields.forEach(f => deniedSet.add(f));

        if (perm.rowFilters && perm.rowFilters.length > 0) {
          combinedRowFilters.push(this.transformFiltersToMongo(perm.rowFilters));
        } else {
          combinedRowFilters.push({}); 
        }
      }
    }

    if (!canRead) {
      if (throwOnDeny) throw new AppError(403, 'COLLECTION_ACCESS_DENIED', `Access is strictly denied for collection: ${collectionName}.`);
      return null;
    }

    return {
      canRead: true,
      effectiveFields: {
        allowed: allowedAll ? [] : Array.from(allowedSet),
        denied: Array.from(deniedSet)
      },
      rowFilters: combinedRowFilters
    };
  }

  static buildMongoQuery(resolved: ResolvedPermissions): Record<string, any> {
    if (resolved.rowFilters.length === 0) return {};
    const grantsFullRowAccess = resolved.rowFilters.some(f => Object.keys(f).length === 0);
    if (grantsFullRowAccess) return {};
    return { $or: resolved.rowFilters };
  }

  static buildMongoProjection(resolved: ResolvedPermissions): Record<string, number> {
    const { allowed, denied } = resolved.effectiveFields;
    const projection: Record<string, number> = {};

    if (allowed.length > 0) {
      allowed.forEach(f => { projection[f] = 1; });
      denied.forEach(f => { delete projection[f]; }); 
    } else {
      denied.forEach(f => { projection[f] = 0; });
    }
    
    return projection;
  }

  static assertFieldsAccessible(requestedFields: string[], resolved: ResolvedPermissions) {
    const { allowed, denied } = resolved.effectiveFields;
    for (const field of requestedFields) {
      if (denied.includes(field)) {
        throw new AppError(403, 'FIELD_ACCESS_DENIED', `Access to requested field '${field}' is strictly denied.`);
      }
      if (allowed.length > 0 && !allowed.includes(field)) {
        throw new AppError(403, 'FIELD_ACCESS_DENIED', `Access to requested field '${field}' is not explicitly allowed.`);
      }
    }
  }
}
