import { Request, Response, NextFunction } from 'express';
import { CatalogService } from '../services/catalog.service';
import { LLMService } from '../services/llm.service';
import { SyncService } from '../services/sync.service';
import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { ActivityService } from '../services/activity.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';

// ─────────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────────

export const getCollections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grouped = await CatalogService.getPermittedCollections(req.user._id);
    sendSuccess(res, 200, grouped);
  } catch (err) { next(err); }
};

export const getDictionary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dictionary = await CatalogService.getDictionary(req.user._id);
    sendSuccess(res, 200, dictionary);
  } catch (err) { next(err); }
};

export const getCollectionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await CatalogService.getPermittedCollectionById(req.user._id, req.params.id, req.query.search as string);
    sendSuccess(res, 200, data);
  } catch (err) { next(err); }
};

export const createCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.create(req.body);
    await ActivityService.logActivity(req.user._id, 'CREATED_COLLECTION', coll.slug);
    sendSuccess(res, 201, coll);
  } catch (err) { next(err); }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');
    await ActivityService.logActivity(req.user._id, 'UPDATED_COLLECTION', coll.slug);
    sendSuccess(res, 200, coll);
  } catch (err) { next(err); }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findById(req.params.id);
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    // Cascade: delete relationships and clean FK references in other collections
    await SyncService.onCollectionDeleted(coll.slug);

    await FieldMetadata.deleteMany({ collectionId: coll._id });
    await coll.deleteOne();
    await ActivityService.logActivity(req.user._id, 'DELETED_COLLECTION', coll.slug);
    sendSuccess(res, 200, { message: 'Collection deleted' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────

export const getFieldById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await CatalogService.getPermittedFieldById(req.user._id, req.params.id);
    sendSuccess(res, 200, field);
  } catch (err) { next(err); }
};

/**
 * Create a new field and immediately auto-generate an LLM description.
 * Supports PK/FK configuration with bidirectional sync.
 */
export const createField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findById(req.body.collectionId);
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    // Validate: cannot be both PK and FK
    SyncService.validateNotBothPkAndFk(req.body.isPrimaryKey, req.body.isForeignKey);

    // ── PK data validation: check actual data uniqueness ──
    if (req.body.isPrimaryKey) {
      await SyncService.validatePrimaryKeyData(req.body.collectionId, req.body.fieldName);
    }

    // ── FK validation: target must be PK + referential integrity ──
    if (req.body.isForeignKey) {
      if (!req.body.targetCollectionId || !req.body.targetFieldId) {
        throw new AppError(400, 'FK_VALIDATION_FAILED', 'Foreign Key requires a target collection and target field');
      }
      await SyncService.validateForeignKeyTarget(req.body.targetCollectionId, req.body.targetFieldId);

      // Resolve target field name for integrity check
      const targetField = await FieldMetadata.findById(req.body.targetFieldId).lean();
      if (targetField) {
        await SyncService.validateForeignKeyIntegrity(
          req.body.collectionId, req.body.fieldName,
          req.body.targetCollectionId, targetField.fieldName
        );
      }
    }

    // Auto-derive displayName from fieldName if not provided
    const fieldData = {
      ...req.body,
      displayName: req.body.displayName || req.body.fieldName
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    };

    const field = await FieldMetadata.create(fieldData);

    // ── PK uniqueness enforcement ──
    if (field.isPrimaryKey) {
      await SyncService.enforcePrimaryKeyUniqueness(field.collectionId, field._id);
    }

    // ── FK → Relationship sync ──
    if (field.isForeignKey && field.targetCollectionId && field.targetFieldId) {
      await SyncService.syncFieldToRelationship(field);
    }

    // ── Initialize the new field to null in all existing documents ──
    try {
      const db = (FieldMetadata.db as any).db;
      if (db) {
        await db.collection(coll.slug).updateMany(
          { [field.fieldName]: { $exists: false } },
          { $set: { [field.fieldName]: null } },
        );
      }
    } catch (err) {
      console.error(`[CatalogController] Failed to initialize field ${field.fieldName} with null:`, err);
    }

    // ── Auto-generate LLM description right after creation ──
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
      console.error(`[CatalogController] Initial AI generation failed for ${field.fieldName}:`, err);
    }

    await ActivityService.logActivity(req.user._id, 'CREATED_FIELD', field.fieldName);
    sendSuccess(res, 201, {
      ...field.toObject(),
      description: field.manualDescription || field.aiDescription || null,
      descriptionSource: field.descriptionSource,
    });
  } catch (err) { next(err); }
};

/**
 * Update field metadata.
 * Handles PK/FK changes with bidirectional sync to Relationship Mapper.
 */
export const updateField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id);
    if (!field) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    // Determine effective PK/FK values after the update
    const newIsPk = req.body.isPrimaryKey !== undefined ? req.body.isPrimaryKey : field.isPrimaryKey;
    const newIsFk = req.body.isForeignKey !== undefined ? req.body.isForeignKey : field.isForeignKey;

    // Validate: cannot be both PK and FK
    SyncService.validateNotBothPkAndFk(newIsPk, newIsFk);

    // ── PK data validation: check actual data uniqueness when turning PK on ──
    if (newIsPk && !field.isPrimaryKey) {
      await SyncService.validatePrimaryKeyData(field.collectionId, field.fieldName);
    }

    // ── FK validation: target must be PK + referential integrity ──
    if (newIsFk) {
      const effectiveTargetCollId = req.body.targetCollectionId || (field.targetCollectionId ? String(field.targetCollectionId) : undefined);
      const effectiveTargetFieldId = req.body.targetFieldId || (field.targetFieldId ? String(field.targetFieldId) : undefined);

      if (effectiveTargetCollId && effectiveTargetFieldId) {
        await SyncService.validateForeignKeyTarget(effectiveTargetCollId, effectiveTargetFieldId);

        // Resolve target field name for integrity check
        const targetField = await FieldMetadata.findById(effectiveTargetFieldId).lean();
        if (targetField) {
          await SyncService.validateForeignKeyIntegrity(
            field.collectionId, field.fieldName,
            effectiveTargetCollId, targetField.fieldName
          );
        }
      }
    }

    // Guard: only custom fields can have manual descriptions updated
    const hasDescriptionUpdate =
      req.body.description !== undefined || req.body.manualDescription !== undefined;

    if (hasDescriptionUpdate && !field.isCustom && req.user.role !== 'platform_admin') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only Custom Extension Fields can have descriptions manually overridden',
      );
    }

    // Remap 'description' → 'manualDescription' for clean storage
    if (req.body.description !== undefined) {
      req.body.manualDescription = req.body.description;
      delete req.body.description;
    }

    // Track source: if manualDescription is being set/cleared, update source accordingly
    if (req.body.manualDescription !== undefined) {
      const isClearing = !req.body.manualDescription || req.body.manualDescription.trim() === '';
      req.body.descriptionSource = !isClearing
        ? 'manual'
        : (field.aiDescription ? 'ai' : 'none');

      if (isClearing) req.body.manualDescription = null;
    }

    // Detect whether FK config has changed
    const wasFk = field.isForeignKey;
    const hadTarget = !!field.targetCollectionId;

    Object.assign(field, req.body);

    // ── PK uniqueness enforcement ──
    if (field.isPrimaryKey && req.body.isPrimaryKey === true) {
      await SyncService.enforcePrimaryKeyUniqueness(field.collectionId, field._id);
    }

    // If FK was turned off, clear target metadata
    if (req.body.isForeignKey === false) {
      field.targetCollectionId = undefined;
      field.targetFieldId = undefined;
      field.relationshipLabel = undefined;
      field.relationshipType = undefined;
    }

    await field.save();

    // ── FK → Relationship sync ──
    const isFkNow = field.isForeignKey;
    const hasTargetNow = !!field.targetCollectionId && !!field.targetFieldId;

    if (isFkNow && hasTargetNow) {
      // FK is active with target config — upsert relationship
      await SyncService.syncFieldToRelationship(field);
    } else if (wasFk && !isFkNow) {
      // FK was turned off — remove relationship
      await SyncService.removeRelationshipForField(field);
    }

    await ActivityService.logActivity(req.user._id, 'UPDATED_FIELD', field.fieldName);
    sendSuccess(res, 200, {
      ...field.toObject(),
      description: field.manualDescription || field.aiDescription || null,
      descriptionSource: field.descriptionSource,
    });
  } catch (err) { next(err); }
};

export const deleteField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id);
    if (!field) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    // Cascade: remove related relationships and clean FK references
    await SyncService.onFieldDeleted(field);

    await field.deleteOne();
    await ActivityService.logActivity(req.user._id, 'DELETED_FIELD', field.fieldName);
    sendSuccess(res, 200, { message: 'Field deleted' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// LLM Description Generation
// ─────────────────────────────────────────────────────────────

/**
 * POST /catalog/fields/:id/generate-description
 * Re-generates the LLM description for a single field on demand.
 */
export const generateFieldDescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id).populate('collectionId');
    if (!field || !field.collectionId) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const collection = field.collectionId as any;

    const { description, source } = await LLMService.generateFieldDescription(
      field.fieldName,
      collection.name,
      field.dataType,
      collection.module,
    );

    field.aiDescription = description;
    if (!field.manualDescription) {
      field.descriptionSource = 'ai';
    }
    await field.save();

    await ActivityService.logActivity(req.user._id, 'GENERATED_DESCRIPTION', field.fieldName);
    sendSuccess(res, 200, {
      description,
      source,
      descriptionSource: field.descriptionSource,
    });
  } catch (err) { next(err); }
};

/**
 * POST /catalog/fields/bulk-generate-descriptions
 * Backfills aiDescription for every field that doesn't have one yet.
 */
export const bulkGenerateDescriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = await FieldMetadata.find({
      $or: [
        { descriptionSource: 'none' },
        { descriptionSource: 'ai' },
        { descriptionSource: { $exists: false } }
      ],
      manualDescription: { $in: [null, ''] }
    })
      .populate('collectionId')
      .lean();

    if (fields.length === 0) {
      sendSuccess(res, 200, { updated: 0, total: 0, message: 'All fields already have manual overrides or are up to date.' });
      return;
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const f of fields) {
      try {
        const collection = f.collectionId as any;
        if (!collection) continue;

        const { description } = await LLMService.generateFieldDescription(
          f.fieldName,
          collection.name,
          f.dataType,
          collection.module,
        );

        const manual = (f as any).manualDescription;

        await FieldMetadata.updateOne(
          { _id: f._id },
          {
            $set: {
              aiDescription: description,
              descriptionSource: manual ? 'manual' : 'ai',
            },
          },
        );
        updated++;
      } catch (e) {
        failed++;
        errors.push(`${f.fieldName}: ${(e as Error).message}`);
      }
    }

    await ActivityService.logActivity(
      req.user._id,
      'BULK_GENERATED_DESCRIPTIONS',
      `${updated} fields updated`,
    );

    sendSuccess(res, 200, {
      total: fields.length,
      updated,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) { next(err); }
};
