import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { PermissionService } from './permission.service';
import { LLMService } from './llm.service';
import { AppError } from '../utils/errors';

export class CatalogService {

  static async getPermittedCollections(userId: string) {
    const userCtx = await PermissionService.getResolutionContext(userId);
    const collections = await CollectionMetadata.find().lean();
    const permitted = [];
    const allFields = await FieldMetadata.find().lean();

    for (const coll of collections) {
      // Layer 1: Collection access
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.slug, false, userCtx);
      if (resolved && resolved.canRead) {
        const { allowed, denied } = resolved.effectiveFields;
        const collFields = allFields.filter(f => String(f.collectionId) === String(coll._id));

        // Layer 2: Count only permitted fields
        const permittedCount = collFields.filter(f => {
          if (denied.includes(f.fieldName)) return false;
          if (allowed.length > 0 && !allowed.includes(f.fieldName)) return false;
          return true;
        }).length;

        const db = (FieldMetadata.db as any).db;

        // Layer 3: Count only row-accessible documents
        const rowQuery = PermissionService.buildMongoQuery(resolved);
        const estimatedRecords = db
          ? await db.collection(coll.slug).countDocuments(rowQuery).catch(() => 0)
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
    const userCtx = await PermissionService.getResolutionContext(userId);
    const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.slug, true, userCtx);
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 'You do not have permission to view this collection');
    }

    // Layer 2: Build field projection using resolved rules
    const { allowed, denied } = resolved.effectiveFields;

    const filter: any = { collectionId: collId };
    if (searchQuery) {
      filter.$text = { $search: searchQuery };
    }

    const fields = await FieldMetadata.find(filter).lean();

    // Filter field metadata to only permitted fields (Layer 2)
    const permittedFields = fields.filter(f => {
      if (denied.includes(f.fieldName)) return false;
      if (allowed.length > 0 && !allowed.includes(f.fieldName)) return false;
      return true;
    }).map(f => {
      const manual = (f as any).manualDescription;
      const ai = (f as any).aiDescription;
      let source = (f as any).descriptionSource || 'none';

      // Self-healing: if source is 'none' but data exists, infer it
      if (source === 'none') {
        if (manual) source = 'manual';
        else if (ai) source = 'ai';
      }

      return {
        ...f,
        description: manual || ai || null,
        descriptionSource: source,
      };
    });

    const db = (FieldMetadata.db as any).db;

    // Layer 3: Count only documents satisfying row filters
    const rowQuery = PermissionService.buildMongoQuery(resolved);
    const estimatedRecords = db
      ? await db.collection(coll.slug).countDocuments(rowQuery).catch(() => 0)
      : 0;

    // Fetch up to 3 sample documents with field projection applied
    const sampleProjection = PermissionService.buildMongoProjection(resolved);
    const samples = db
      ? await db.collection(coll.slug).find(rowQuery).project(sampleProjection).limit(3).toArray().catch(() => [])
      : [];

    return {
      ...coll,
      fields: permittedFields,
      estimatedRecords,
      samples,
      _rowFilter: Object.keys(rowQuery).length > 0 ? rowQuery : null
    };
  }

  static async getPermittedFieldById(userId: string, fieldId: string) {
    const field = await FieldMetadata.findById(fieldId).populate('collectionId').lean();
    if (!field || !field.collectionId) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const collection = field.collectionId as any;

    // Layer 1: Collection access
    const userCtx = await PermissionService.getResolutionContext(userId);
    const resolved = await PermissionService.resolveCollectionPermissions(userId, collection.slug, true, userCtx);
    if (!resolved || !resolved.canRead) {
      throw new AppError(403, 'COLLECTION_ACCESS_DENIED', 'Access denied to parent collection');
    }

    // Layer 2: Explicit field-level assertion
    PermissionService.assertFieldsAccessible([field.fieldName], resolved);

    const manual = (field as any).manualDescription;
    const ai = (field as any).aiDescription;
    let source = (field as any).descriptionSource || 'none';

    if (source === 'none') {
      if (manual) source = 'manual';
      else if (ai) source = 'ai';
    }

    return {
      ...field,
      description: manual || ai || null,
      descriptionSource: source,
    };
  }

  /**
   * Generate a description for a single field using the real LLM.
   * Returns both the description text and the resolved source ('ai' | 'fallback').
   */
  static async generateDescription(
    fieldName: string,
    collectionName: string,
    fieldType: string,
    module: string,
  ): Promise<{ description: string; source: 'ai' | 'fallback' }> {
    return LLMService.generateFieldDescription(fieldName, collectionName, fieldType, module);
  }

  static async getDictionary(userId: string) {
    const userCtx = await PermissionService.getResolutionContext(userId);
    const collections = await CollectionMetadata.find().lean();
    const allFields = await FieldMetadata.find().lean();

    const dictionary = [];

    for (const coll of collections) {
      // Layer 1: Collection access
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.slug, false, userCtx);
      if (resolved && resolved.canRead) {
        const { allowed, denied } = resolved.effectiveFields;
        const collFields = allFields.filter(f => String(f.collectionId) === String(coll._id));

        // Layer 2: Only expose permitted field names in dictionary
        const permittedFields = collFields.filter(f => {
          if (denied.includes(f.fieldName)) return false;
          if (allowed.length > 0 && !allowed.includes(f.fieldName)) return false;
          return true;
        }).map(f => f.fieldName);

        dictionary.push({ name: coll.name, slug: coll.slug, fields: permittedFields });
      }
    }

    return dictionary;
  }
}

