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
      // Layer 1: Collection access
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.name, false);
      if (resolved && resolved.canRead) {
        const { allowed, denied } = resolved.effectiveFields;
        const collFields = allFields.filter(f => String(f.collectionId) === String(coll._id));

        // Layer 2: Count only permitted fields
        const permittedCount = collFields.filter(f => {
          if (denied.includes(f.name)) return false;
          if (allowed.length > 0 && !allowed.includes(f.name)) return false;
          return true;
        }).length;

        const db = (FieldMetadata.db as any).db;

        // Layer 3: Count only row-accessible documents
        const rowQuery = PermissionService.buildMongoQuery(resolved);
        const estimatedRecords = db
          ? await db.collection(coll.name).countDocuments(rowQuery).catch(() => 0)
          : 0;
        
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

    // Layer 1: Collection access check (throwOnDeny = true — server enforces, never the client)
    const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.name, true);
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 'You do not have permission to view this collection');
    }

    // Layer 2: Build field projection using resolved rules
    const { allowed, denied } = resolved.effectiveFields;
    
    const filter: any = { collectionId: collId };
    if (searchQuery) filter.$text = { $search: searchQuery };

    const fields = await FieldMetadata.find(filter).lean();
    
    // Filter field metadata to only permitted fields (Layer 2)
    const permittedFields = fields.filter(f => {
      if (denied.includes(f.name)) return false;
      if (allowed.length > 0 && !allowed.includes(f.name)) return false;
      return true;
    }).map(f => ({
      ...f,
      description: (f as any).manualDescription || (f as any).aiDescription || null
    }));

    const db = (FieldMetadata.db as any).db;

    // Layer 3: Count only documents satisfying row filters
    const rowQuery = PermissionService.buildMongoQuery(resolved);
    const estimatedRecords = db
      ? await db.collection(coll.name).countDocuments(rowQuery).catch(() => 0)
      : 0;

    return { 
      ...coll, 
      fields: permittedFields, 
      estimatedRecords,
      _rowFilter: Object.keys(rowQuery).length > 0 ? rowQuery : null
    };
  }

  static async getPermittedFieldById(userId: string, fieldId: string) {
    const field = await FieldMetadata.findById(fieldId).populate('collectionId').lean();
    if (!field || !field.collectionId) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const collection = field.collectionId as any;

    // Layer 1: Collection access
    const resolved = await PermissionService.resolveCollectionPermissions(userId, collection.name, true);
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 'Access denied to parent collection');
    }

    // Layer 2: Explicit field-level assertion
    PermissionService.assertFieldsAccessible([field.name], resolved);

    return { ...field, description: (field as any).manualDescription || (field as any).aiDescription || null };
  }

  static generateHeuristicDescription(fieldName: string, collectionName: string): string {
    const humanized = fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();
    const cleanColl = collectionName.replace(/s$/, '').toLowerCase();
    return `The ${humanized} value associated with the ${cleanColl}.`;
  }

  static async getDictionary(userId: string) {
    const collections = await CollectionMetadata.find().lean();
    const allFields = await FieldMetadata.find().lean();
    
    const dictionary = [];
    
    for (const coll of collections) {
      // Layer 1: Collection access
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.name, false);
      if (resolved && resolved.canRead) {
        const { allowed, denied } = resolved.effectiveFields;
        const collFields = allFields.filter(f => String(f.collectionId) === String(coll._id));

        // Layer 2: Only expose permitted field names in dictionary
        const permittedFields = collFields.filter(f => {
          if (denied.includes(f.name)) return false;
          if (allowed.length > 0 && !allowed.includes(f.name)) return false;
          return true;
        }).map(f => f.name);
        
        dictionary.push({ name: coll.name, fields: permittedFields });
      }
    }
    
    return dictionary;
  }
}
