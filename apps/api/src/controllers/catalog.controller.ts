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
    await CatalogService.deleteCollection(req.user._id, req.params.id);
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
    const field = await CatalogService.createField(req.user._id, req.body);
    sendSuccess(res, 201, field);
  } catch (err) { next(err); }
};

/**
 * Update field metadata.
 * Handles PK/FK changes with bidirectional sync to Relationship Mapper.
 */
export const updateField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await CatalogService.updateField(req.user._id, req.params.id, req.body, req.user.role);
    sendSuccess(res, 200, field);
  } catch (err) { next(err); }
};

export const deleteField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await CatalogService.deleteField(req.user._id, req.params.id);
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
