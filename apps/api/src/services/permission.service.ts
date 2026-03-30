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

  /**
   * Translates a single RowFilter into a MongoDB query clause.
   * Supports all 8 operators defined in the spec:
   * eq | neq | in | nin | gt | gte | lt | lte
   */
  private static parseOperator(filter: IRowFilter): any {
    const { field, operator, value } = filter;
    switch (operator) {
      case 'eq': return { [field]: { $eq: value } };
      case 'neq': return { [field]: { $ne: value } };
      case 'in': return { [field]: { $in: Array.isArray(value) ? value : [value] } };
      case 'nin': return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
      case 'gt': return { [field]: { $gt: value } };
      case 'gte': return { [field]: { $gte: value } };
      case 'lt': return { [field]: { $lt: value } };
      case 'lte': return { [field]: { $lte: value } };
      default: return {};
    }
  }

  /**
   * Combines multiple RowFilter conditions with $and semantics.
   * This means a row must satisfy ALL conditions from the same permission entry.
   * Multiple groups' permissions are combined with $or (user gets the union of all group grants).
   */
  private static transformFiltersToMongo(filters: IRowFilter[]): any {
    if (!filters || filters.length === 0) return {};
    const clauses = filters.map(f => this.parseOperator(f));
    if (clauses.length === 1) return clauses[0];
    return { $and: clauses };
  }

  /**
   * Resolves the effective permissions for a user against a specific collection.
   * Merges permissions from ALL groups the user belongs to (union semantics):
   * - canRead: true if ANY group grants read
   * - allowedFields: union of all groups' allowedFields
   * - deniedFields: union of all groups' deniedFields (applied after allowed)
   * - rowFilters: $or across all groups' filter conditions (user sees rows matching any group)
   */
  static async resolveCollectionPermissions(
    userId: string,
    collectionName: string,
    throwOnDeny: boolean = true
  ): Promise<ResolvedPermissions | null> {
    const user = await User.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    // platform_admin bypasses all permission checks — full unrestricted access
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
    const groupRowFilters: any[] = []; // each entry = one group's combined filter

    for (const group of groups) {
      if (!group.permissions) continue;

      const perm = group.permissions.find(p => p.collectionName === collectionName);

      if (perm && perm.canRead) {
        canRead = true;

        // Field-level: union of all allowed fields across groups
        if (!perm.allowedFields || perm.allowedFields.length === 0) {
          allowedAll = true; // at least one group grants all fields
        } else {
          perm.allowedFields.forEach(f => allowedSet.add(f));
        }

        // Denied fields always apply
        if (perm.deniedFields) {
          perm.deniedFields.forEach(f => deniedSet.add(f));
        }

        // Row-level: collect each group's combined filter as an $or branch
        if (perm.rowFilters && perm.rowFilters.length > 0) {
          groupRowFilters.push(this.transformFiltersToMongo(perm.rowFilters));
        } else {
          // This group grants full row access — no filter means all rows visible
          groupRowFilters.push({});
        }
      }
    }

    if (!canRead) {
      if (throwOnDeny) {
        throw new AppError(403, 'COLLECTION_ACCESS_DENIED', `Access denied for collection: ${collectionName}`);
      }
      return null;
    }

    return {
      canRead: true,
      effectiveFields: {
        allowed: allowedAll ? [] : Array.from(allowedSet),
        denied: Array.from(deniedSet)
      },
      rowFilters: groupRowFilters
    };
  }

  /**
   * Builds the MongoDB $match query for row-level filtering.
   * Uses $or semantics: rows visible to ANY group the user belongs to are returned.
   * If any group has no row restrictions, the entire collection is visible.
   */
  static buildMongoQuery(resolved: ResolvedPermissions): Record<string, any> {
    if (resolved.rowFilters.length === 0) return {};
    // If any group grants full row access (empty filter object), no restriction applies
    const hasFullAccess = resolved.rowFilters.some(f => Object.keys(f).length === 0);
    if (hasFullAccess) return {};
    return { $or: resolved.rowFilters };
  }

  /**
   * Builds the MongoDB projection for field-level filtering.
   * allowedFields: whitelist (only include specified fields)
   * deniedFields:  blacklist (exclude specified fields; overrides allowedFields)
   * empty allowedFields = all fields permitted (zero projection = include everything except denied)
   *
   * IMPORTANT: MongoDB does NOT allow mixing inclusion (1) and exclusion (0) in
   * the same projection (except for _id). When both allowed and denied lists exist,
   * we use inclusion-only mode and simply omit the denied fields from the whitelist.
   */
  static buildMongoProjection(resolved: ResolvedPermissions): Record<string, number> {
    const { allowed, denied } = resolved.effectiveFields;
    const projection: Record<string, number> = {};

    if (allowed.length > 0) {
      // Whitelist mode: include only allowed fields, minus any denied
      const effectiveAllowed = allowed.filter(f => !denied.includes(f));
      effectiveAllowed.forEach(f => { projection[f] = 1; });
      // Always include _id in whitelist mode (MongoDB allows _id: 1 alongside inclusions)
      projection['_id'] = 1;
    } else {
      // Blacklist-only mode: exclude denied fields (no whitelist constraint)
      denied.forEach(f => { projection[f] = 0; });
    }

    return projection;
  }

  /**
   * Asserts that a set of explicitly requested fields are accessible.
   * Used when a query/formula references specific field names.
   * Throws HTTP 403 FIELD_ACCESS_DENIED if any field is restricted.
   */
  static assertFieldsAccessible(requestedFields: string[], resolved: ResolvedPermissions) {
    const { allowed, denied } = resolved.effectiveFields;
    for (const field of requestedFields) {
      if (denied.includes(field)) {
        throw new AppError(403, 'FIELD_ACCESS_DENIED', `Access to field '${field}' is denied.`);
      }
      if (allowed.length > 0 && !allowed.includes(field)) {
        throw new AppError(403, 'FIELD_ACCESS_DENIED', `Field '${field}' is not in the allowed set.`);
      }
    }
  }
}
