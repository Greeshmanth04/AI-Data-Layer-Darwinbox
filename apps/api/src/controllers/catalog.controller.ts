import { Request, Response, NextFunction } from 'express';
import { CatalogService } from '../services/catalog.service';
import { LLMService } from '../services/llm.service';
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
    await ActivityService.logActivity(req.user._id, 'CREATED_COLLECTION', coll.name);
    sendSuccess(res, 201, coll);
  } catch (err) { next(err); }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');
    await ActivityService.logActivity(req.user._id, 'UPDATED_COLLECTION', coll.name);
    sendSuccess(res, 200, coll);
  } catch (err) { next(err); }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findById(req.params.id);
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');
    await FieldMetadata.deleteMany({ collectionId: coll._id });
    await coll.deleteOne();
    await ActivityService.logActivity(req.user._id, 'DELETED_COLLECTION', coll.name);
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
 * - For ALL fields (standard & custom): aiDescription is populated on creation.
 * - descriptionSource is set to 'ai' (or 'fallback' if Gemini is unreachable).
 * - Manual override is ONLY allowed later for custom fields.
 */
export const createField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findById(req.body.collectionId);
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    // Auto-derive displayName from field name
    const fieldData = {
      ...req.body,
      displayName: req.body.name
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    };

    const field = await FieldMetadata.create(fieldData);

    // ── Auto-generate LLM description right after creation ──
    try {
      const { description } = await LLMService.generateFieldDescription(
        field.name,
        coll.name,
        field.type,
        coll.module,
      );
      field.aiDescription = description;
      field.descriptionSource = 'ai'; // Automatically set source to AI for newly generated content
      await field.save();
    } catch (err) {
      console.error(`[CatalogController] Initial AI generation failed for ${field.name}:`, err);
      // Field remains created with missing description; can be backfilled later
    }

    await ActivityService.logActivity(req.user._id, 'CREATED_FIELD', field.name);
    sendSuccess(res, 201, {
      ...field.toObject(),
      description: field.manualDescription || field.aiDescription || null,
      descriptionSource: field.descriptionSource,
    });
  } catch (err) { next(err); }
};

/**
 * Update field metadata.
 * - descriptionSource tracks whether the active description is AI-generated or manually set.
 * - Manual description override is ONLY permitted for custom fields (isCustom === true).
 * - Standard fields (isCustom === false) cannot have manualDescription set by non-admins.
 */
export const updateField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id);
    if (!field) throw new AppError(404, 'NOT_FOUND', 'Field not found');

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
      
      // If clearing, ensure it's stored as null/empty
      if (isClearing) req.body.manualDescription = null;
    }

    Object.assign(field, req.body);
    await field.save();

    await ActivityService.logActivity(req.user._id, 'UPDATED_FIELD', field.name);
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

    await field.deleteOne();
    await ActivityService.logActivity(req.user._id, 'DELETED_FIELD', field.name);
    sendSuccess(res, 200, { message: 'Field deleted' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// LLM Description Generation
// ─────────────────────────────────────────────────────────────

/**
 * POST /catalog/fields/:id/generate-description
 * Re-generates the LLM description for a single field on demand.
 * Available for ALL fields; stores result as aiDescription.
 * Custom fields retain any existing manualDescription on top.
 */
export const generateFieldDescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id).populate('collectionId');
    if (!field || !field.collectionId) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const collection = field.collectionId as any;

    const { description, source } = await LLMService.generateFieldDescription(
      field.name,
      collection.name,
      field.type,
      collection.module,
    );

    field.aiDescription     = description;
    // Only update descriptionSource to 'ai' if no manualDescription is overriding
    if (!field.manualDescription) {
      field.descriptionSource = 'ai';
    }
    await field.save();

    await ActivityService.logActivity(req.user._id, 'GENERATED_DESCRIPTION', field.name);
    sendSuccess(res, 200, {
      description,
      source,                    // 'ai' | 'fallback' — useful for UI badge
      descriptionSource: field.descriptionSource,
    });
  } catch (err) { next(err); }
};

/**
 * POST /catalog/fields/bulk-generate-descriptions
 * Backfills aiDescription for every field that doesn't have one yet.
 * Restricted to platform_admin. Runs sequentially to avoid Gemini rate limits.
 */
export const bulkGenerateDescriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Broaden the query: target any field that isn't manually set.
    // This allows replacing seeded placeholders ('ai' source but derived) with real Gemini descriptions.
    const fields = await FieldMetadata.find({ 
      $or: [
        { descriptionSource: 'none' },
        { descriptionSource: 'ai' }, // This targets seeded 'ai' placeholders and previous LLM outputs
        { descriptionSource: { $exists: false } }
      ],
      manualDescription: { $in: [null, ''] } // Safety: never overwrite anything with a manual string
    })
      .populate('collectionId')
      .lean();

    if (fields.length === 0) {
      sendSuccess(res, 200, { updated: 0, total: 0, message: 'All fields already have manual overrides or are up to date.' });
      return;
    }

    let updated   = 0;
    let failed    = 0;
    const errors: string[] = [];

    for (const f of fields) {
      try {
        const collection = f.collectionId as any;
        if (!collection) continue;

        const { description } = await LLMService.generateFieldDescription(
          f.name,
          collection.name,
          f.type,
          collection.module,
        );

        const isCustom = f.isCustom;
        const manual = (f as any).manualDescription;

        await FieldMetadata.updateOne(
          { _id: f._id },
          {
            $set: {
              aiDescription: description,
              // Only set source to 'ai' if no manual override exists
              descriptionSource: manual ? 'manual' : 'ai',
            },
          },
        );
        updated++;
      } catch (e) {
        failed++;
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }

    await ActivityService.logActivity(
      req.user._id,
      'BULK_GENERATED_DESCRIPTIONS',
      `${updated} fields updated`,
    );

    sendSuccess(res, 200, {
      total:   fields.length,
      updated,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) { next(err); }
};
