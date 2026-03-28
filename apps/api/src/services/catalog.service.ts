import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { PermissionService } from './permission.service';
import { AppError } from '../utils/errors';

export class CatalogService {
  
  static async getPermittedCollections(userId: string) {
    const collections = await CollectionMetadata.find().lean();
    const permitted = [];
    const allFields = await FieldMetadata.find().lean();

    for (const coll of collections) {
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.name, false);
      if (resolved && resolved.canRead) {
        const { allowed, denied } = resolved.effectiveFields;
        const collFields = allFields.filter(f => String(f.collectionId) === String(coll._id));
        const permittedCount = collFields.filter(f => {
          if (denied.includes(f.name)) return false;
          if (allowed.length > 0 && !allowed.includes(f.name)) return false;
          return true;
        }).length;
        const db = (FieldMetadata.db as any).db;
        const estimatedRecords = db ? await db.collection(coll.name).estimatedDocumentCount().catch(() => 0) : 0;
        
        permitted.push({ ...coll, fieldCount: permittedCount, estimatedRecords });
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
    }).map(f => ({
      ...f,
      description: (f as any).manualDescription || (f as any).aiDescription || null
    }));

    const db = (FieldMetadata.db as any).db;
    const estimatedRecords = db ? await db.collection(coll.name).estimatedDocumentCount().catch(() => 0) : 0;

    return { ...coll, fields: permittedFields, estimatedRecords };
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
    return { ...field, description: (field as any).manualDescription || (field as any).aiDescription || null };
  }

  static generateHeuristicDescription(fieldName: string, collectionName: string): string {
    const humanized = fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();
    const cleanColl = collectionName.replace(/s$/, '').toLowerCase();
    return `The ${humanized} value associated with the ${cleanColl}.`;
  }
}
