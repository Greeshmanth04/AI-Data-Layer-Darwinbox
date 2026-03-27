import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { PermissionService } from './permission.service';
import { AppError } from '../utils/errors';

export class CatalogService {
  
  static async getPermittedCollections(userId: string) {
    const collections = await CollectionMetadata.find().lean();
    const permitted = [];

    for (const coll of collections) {
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.name, false);
      if (resolved && resolved.canRead) {
        permitted.push(coll);
      }
    }

    const grouped = permitted.reduce((acc, curr) => {
      const m = curr.module || 'Other';
      if (!acc[m]) acc[m] = [];
      acc[m].push(curr);
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }

  static async getPermittedCollectionById(userId: string, collId: string, searchQuery?: string) {
    const coll = await CollectionMetadata.findById(collId).lean();
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.name, false);
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 'You do not have permission to view this collection');
    }

    const { allowed, denied } = resolved.effectiveFields;
    
    const filter: any = { collectionId: collId };
    if (searchQuery) filter.$text = { $search: searchQuery };

    const fields = await FieldMetadata.find(filter).lean();
    
    const permittedFields = fields.filter(f => {
      if (denied.includes(f.name)) return false;
      if (allowed.length > 0 && !allowed.includes(f.name)) return false;
      return true;
    });

    return { ...coll, fields: permittedFields };
  }

  static async getPermittedFieldById(userId: string, fieldId: string) {
    const field = await FieldMetadata.findById(fieldId).populate('collectionId').lean();
    if (!field || !field.collectionId) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const collection = field.collectionId as any;
    const resolved = await PermissionService.resolveCollectionPermissions(userId, collection.name, false);
    
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 'Access denied to parent collection');
    }

    PermissionService.assertFieldsAccessible([field.name], resolved);
    return field;
  }

  static generateHeuristicDescription(fieldName: string, collectionName: string): string {
    const humanized = fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();
    const cleanColl = collectionName.replace(/s$/, '').toLowerCase();
    return `The ${humanized} value associated with the ${cleanColl}.`;
  }
}
