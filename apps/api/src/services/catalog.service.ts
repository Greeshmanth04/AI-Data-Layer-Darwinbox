import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { PermissionService } from './permission.service';
import { LLMService } from './llm.service';
import { SyncService } from './sync.service';
import { ActivityService } from './activity.service';
import { AppError } from '../utils/errors';

export class CatalogService {

  static async getPermittedCollections(userId: string) {
    const userCtx = await PermissionService.getResolutionContext(userId);
    const collections = await CollectionMetadata.find().lean();
    const permitted = [];
    const allFields = await FieldMetadata.find().lean();

    for (const coll of collections) {
      // Layer 1: Collection access
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.slug, false, userCtx, coll);
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
      const resolved = await PermissionService.resolveCollectionPermissions(userId, coll.slug, false, userCtx, coll);
      if (resolved && resolved.canRead) {
        const { allowed, denied } = resolved.effectiveFields;
        const collFields = allFields.filter(f => String(f.collectionId) === String(coll._id));

        // Layer 2: Only expose permitted field names in dictionary
        const permittedFields = collFields.filter(f => {
          if (denied.includes(f.fieldName)) return false;
          if (allowed.length > 0 && !allowed.includes(f.fieldName)) return false;
          return true;
        }).map(f => f.fieldName);

        dictionary.push({ _id: coll._id, name: coll.name, slug: coll.slug, fields: permittedFields });
      }
    }
    return dictionary;
  }

  static async deleteCollection(userId: string, collId: string) {
    const coll = await CollectionMetadata.findById(collId);
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    await SyncService.onCollectionDeleted(coll.slug);
    await FieldMetadata.deleteMany({ collectionId: coll._id });
    await coll.deleteOne();
    await ActivityService.logActivity(userId, 'DELETED_COLLECTION', coll.slug);
  }

  static async createField(userId: string, data: any) {
    const coll = await CollectionMetadata.findById(data.collectionId);
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    SyncService.validateNotBothPkAndFk(data.isPrimaryKey, data.isForeignKey);

    if (data.isPrimaryKey) {
      await SyncService.validatePrimaryKeyData(data.collectionId, data.fieldName);
    }

    if (data.isForeignKey) {
      if (!data.targetCollectionId || !data.targetFieldId) {
        throw new AppError(400, 'FK_VALIDATION_FAILED', 'Foreign Key requires a target collection and target field');
      }
      await SyncService.validateForeignKeyTarget(data.targetCollectionId, data.targetFieldId);

      const targetField = await FieldMetadata.findById(data.targetFieldId).lean();
      if (targetField) {
        await SyncService.validateForeignKeyIntegrity(
          data.collectionId, data.fieldName, data.targetCollectionId, targetField.fieldName
        );
      }
    }

    const fieldData = {
      ...data,
      displayName: data.displayName || data.fieldName
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    };

    const field = await FieldMetadata.create(fieldData);

    if (field.isPrimaryKey) {
      await SyncService.enforcePrimaryKeyUniqueness(field.collectionId, field._id);
    }

    if (field.isForeignKey && field.targetCollectionId && field.targetFieldId) {
      await SyncService.syncFieldToRelationship(field);
    }

    try {
      const db = (FieldMetadata.db as any).db;
      if (db) {
        await db.collection(coll.slug).updateMany(
          { [field.fieldName]: { $exists: false } },
          { $set: { [field.fieldName]: null } },
        );
      }
    } catch (err) {
      console.error(`[CatalogService] Failed to initialize field ${field.fieldName} with null:`, err);
    }

    try {
      const { description } = await LLMService.generateFieldDescription(
        field.fieldName,
        coll.name,
        field.dataType,
        coll.module,
      );
      field.aiDescription = description;
      field.descriptionSource = 'ai';
      await field.save();
    } catch (err) {
      console.error(`[CatalogService] Initial AI generation failed for ${field.fieldName}:`, err);
    }

    await ActivityService.logActivity(userId, 'CREATED_FIELD', field.fieldName);
    
    return {
      ...field.toObject(),
      description: field.manualDescription || field.aiDescription || null,
      descriptionSource: field.descriptionSource,
    };
  }

  static async updateField(userId: string, fieldId: string, data: any, userRole: string) {
    const field = await FieldMetadata.findById(fieldId);
    if (!field) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const newIsPk = data.isPrimaryKey !== undefined ? data.isPrimaryKey : field.isPrimaryKey;
    const newIsFk = data.isForeignKey !== undefined ? data.isForeignKey : field.isForeignKey;

    SyncService.validateNotBothPkAndFk(newIsPk, newIsFk);

    if (newIsPk && !field.isPrimaryKey) {
      await SyncService.validatePrimaryKeyData(field.collectionId, field.fieldName);
    }

    if (newIsFk) {
      const effectiveTargetCollId = data.targetCollectionId || (field.targetCollectionId ? String(field.targetCollectionId) : undefined);
      const effectiveTargetFieldId = data.targetFieldId || (field.targetFieldId ? String(field.targetFieldId) : undefined);

      if (effectiveTargetCollId && effectiveTargetFieldId) {
        await SyncService.validateForeignKeyTarget(effectiveTargetCollId, effectiveTargetFieldId);
        const targetField = await FieldMetadata.findById(effectiveTargetFieldId).lean();
        if (targetField) {
          await SyncService.validateForeignKeyIntegrity(
            field.collectionId, field.fieldName, effectiveTargetCollId, targetField.fieldName
          );
        }
      }
    }

    const hasDescriptionUpdate = data.description !== undefined || data.manualDescription !== undefined;

    if (hasDescriptionUpdate && !field.isCustom && userRole !== 'platform_admin') {
      throw new AppError(403, 'FORBIDDEN', 'Only Custom Extension Fields can have descriptions manually overridden');
    }

    if (data.description !== undefined) {
      data.manualDescription = data.description;
      delete data.description;
    }

    if (data.manualDescription !== undefined) {
      const isClearing = !data.manualDescription || data.manualDescription.trim() === '';
      data.descriptionSource = !isClearing ? 'manual' : (field.aiDescription ? 'ai' : 'none');
      if (isClearing) data.manualDescription = null;
    }

    const wasFk = field.isForeignKey;
    Object.assign(field, data);

    if (field.isPrimaryKey && data.isPrimaryKey === true) {
      await SyncService.enforcePrimaryKeyUniqueness(field.collectionId, field._id);
    }

    if (data.isForeignKey === false) {
      field.targetCollectionId = undefined;
      field.targetFieldId = undefined;
      field.relationshipLabel = undefined;
      field.relationshipType = undefined;
    }

    await field.save();

    const isFkNow = field.isForeignKey;
    const hasTargetNow = !!field.targetCollectionId && !!field.targetFieldId;

    if (isFkNow && hasTargetNow) {
      await SyncService.syncFieldToRelationship(field);
    } else if (wasFk && !isFkNow) {
      await SyncService.removeRelationshipForField(field);
    }

    await ActivityService.logActivity(userId, 'UPDATED_FIELD', field.fieldName);
    
    return {
      ...field.toObject(),
      description: field.manualDescription || field.aiDescription || null,
      descriptionSource: field.descriptionSource,
    };
  }

  static async deleteField(userId: string, fieldId: string) {
    const field = await FieldMetadata.findById(fieldId);
    if (!field) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    await SyncService.onFieldDeleted(field);
    await field.deleteOne();
    await ActivityService.logActivity(userId, 'DELETED_FIELD', field.fieldName);
  }
}
