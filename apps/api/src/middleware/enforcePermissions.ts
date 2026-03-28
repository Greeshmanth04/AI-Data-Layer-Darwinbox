import { Request, Response, NextFunction } from 'express';
import { PermissionService, ResolvedPermissions } from '../services/permission.service';
import { AppError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      permissions?: ResolvedPermissions;
      collectionName?: string;
    }
  }
}

/**
 * Layer 1 — Collection Access
 * Resolves permissions for the collection specified either:
 *   - directly via `collectionName` factory param, OR
 *   - dynamically from `req.params.collectionName` or `req.query.collection`
 *
 * On pass: attaches `req.permissions` for downstream field/row enforcement.
 * On fail: returns HTTP 403 COLLECTION_ACCESS_DENIED immediately.
 *
 * Layer 2 — Field Access
 * Stored on `req.permissions.effectiveFields`.
 * Controllers MUST use `PermissionService.buildMongoProjection(req.permissions)` 
 * to generate their MongoDB projection — never expose all fields blindly.
 * `PermissionService.assertFieldsAccessible(fields, req.permissions)` for explicit checks.
 *
 * Layer 3 — Row Access
 * Stored on `req.permissions.rowFilters`.
 * Controllers MUST use `PermissionService.buildMongoQuery(req.permissions)` 
 * to generate their MongoDB filter — never return unfiltered documents.
 */
export const enforceCollectionAccess = (collectionNameOrParam?: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      }

      // Superadmins bypass all permission checks
      if (req.user.role === 'platform_admin') {
        req.permissions = {
          canRead: true,
          effectiveFields: { allowed: [], denied: [] },
          rowFilters: []
        };
        return next();
      }

      // Resolve collection name: static param > route param > query param
      const collName =
        collectionNameOrParam ||
        req.params.collectionName ||
        (req.query.collection as string);

      if (!collName) {
        // No collection context — pass through (field/row checks N/A without collection)
        return next();
      }

      req.collectionName = collName;

      // Layer 1: Collection-level check (throws 403 if denied)
      const resolved = await PermissionService.resolveCollectionPermissions(
        req.user._id,
        collName,
        true  // throwOnDeny = true enforces server-side, frontend is never trusted
      );

      // Attach resolved context for Layer 2 (field) + Layer 3 (row) enforcement downstream
      req.permissions = resolved!;

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * assertFieldAccess — inline middleware to check specific requested fields.
 * Use on routes that accept explicit field lists (e.g. query params or body).
 */
export const assertFieldAccess = (getFields: (req: Request) => string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.permissions) return next();                      // No context = no check
    if (req.user?.role === 'platform_admin') return next();   // Superadmins bypass

    try {
      const fields = getFields(req);
      if (fields.length > 0) {
        PermissionService.assertFieldsAccessible(fields, req.permissions);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
