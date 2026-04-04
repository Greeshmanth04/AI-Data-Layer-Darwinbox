import { Request, Response, NextFunction } from 'express';
import { RelationshipService } from '../services/relationship.service';
import { SyncService } from '../services/sync.service';
import { Relationship } from '../models/relationship.model';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import { ActivityService } from '../services/activity.service';
import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';

export const getGraph = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const graph = await RelationshipService.getPermittedGraph(req.user._id);
    sendSuccess(res, 200, graph);
  } catch (err) { next(err); }
};

export const createRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceCollectionId, targetCollectionId, sourceFieldId, targetFieldId } = req.body;

    // ── Validation: Check Integrity ──
    const sColl = await CollectionMetadata.findById(sourceCollectionId).lean();
    const tColl = await CollectionMetadata.findById(targetCollectionId).lean();
    if (!sColl || !tColl) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Source or Target collection not found');
    }

    const sField = await FieldMetadata.findById(sourceFieldId).lean();
    const tField = await FieldMetadata.findById(targetFieldId).lean();
    if (!sField || !tField) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Source or Target field not found');
    }

    // 1. Target must be PK
    await SyncService.validateForeignKeyTarget(String(tColl._id), String(tField._id));

    // 2. Referential integrity check
    await SyncService.validateForeignKeyIntegrity(sColl._id, sField.fieldName, tColl._id, tField.fieldName);

    const edge = await Relationship.create({ ...req.body, isAutoDetected: false });

    // Sync → Data Catalog: mark source field as FK
    try {
      await SyncService.syncRelationshipToField({
        sourceCollectionId: String(edge.sourceCollectionId),
        targetCollectionId: String(edge.targetCollectionId),
        sourceFieldId: String(edge.sourceFieldId),
        targetFieldId: String(edge.targetFieldId),
        label: edge.label,
        relationshipType: edge.relationshipType,
      });
    } catch (syncErr) {
      console.error('[RelationshipController] Sync to catalog failed on create:', syncErr);
    }

    await ActivityService.logActivity(req.user._id, 'CREATED_EDGE', `${edge.sourceCollectionId} to ${edge.targetCollectionId}`);
    sendSuccess(res, 201, edge);
  } catch (err) { next(err); }
};

export const updateRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceCollectionId, targetCollectionId, sourceFieldId, targetFieldId } = req.body;

    const sColl = sourceCollectionId ? await CollectionMetadata.findById(sourceCollectionId).lean() : null;
    const tColl = targetCollectionId ? await CollectionMetadata.findById(targetCollectionId).lean() : null;

    if (sColl && tColl && sourceFieldId && targetFieldId) {
      const sField = await FieldMetadata.findById(sourceFieldId).lean();
      const tField = await FieldMetadata.findById(targetFieldId).lean();

      if (sField && tField) {
        // 1. Target must be PK
        await SyncService.validateForeignKeyTarget(String(tColl._id), String(tField._id));

        // 2. Referential integrity check
        await SyncService.validateForeignKeyIntegrity(sColl._id, sField.fieldName, tColl._id, tField.fieldName);
      }
    }

    const edge = await Relationship.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!edge) throw new AppError(404, 'NOT_FOUND', 'Relationship not found');

    // Sync → Data Catalog: update FK metadata on source field
    try {
      await SyncService.syncRelationshipToField({
        sourceCollectionId: String(edge.sourceCollectionId),
        targetCollectionId: String(edge.targetCollectionId),
        sourceFieldId: String(edge.sourceFieldId),
        targetFieldId: String(edge.targetFieldId),
        label: edge.label,
        relationshipType: edge.relationshipType,
      });
    } catch (syncErr) {
      console.error('[RelationshipController] Sync to catalog failed on update:', syncErr);
    }

    await ActivityService.logActivity(req.user._id, 'UPDATED_EDGE', edge._id.toString());
    sendSuccess(res, 200, edge);
  } catch (err) { next(err); }
};

export const deleteRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Capture before deleting so we can sync back to catalog
    const edge = await Relationship.findById(req.params.id).lean();
    if (!edge) throw new AppError(404, 'NOT_FOUND', 'Relationship not found');

    await Relationship.findByIdAndDelete(req.params.id);

    // Sync → Data Catalog: clear FK flag if no remaining relationships
    try {
      await SyncService.syncRelationshipDeletion({
        sourceCollectionId: String(edge.sourceCollectionId),
        sourceFieldId: String(edge.sourceFieldId),
      });
    } catch (syncErr) {
      console.error('[RelationshipController] Sync to catalog failed on delete:', syncErr);
    }

    await ActivityService.logActivity(req.user._id, 'DELETED_EDGE', req.params.id);
    sendSuccess(res, 200, null, 'Deleted successfully');
  } catch (err) { next(err); }
};

export const autoDetect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detectedEdges = await RelationshipService.autoDetect(req.user._id);

    // Sync all auto-detected edges to catalog FK fields
    for (const edge of detectedEdges) {
      try {
        await SyncService.syncRelationshipToField({
          sourceCollectionId: String(edge.sourceCollectionId),
          targetCollectionId: String(edge.targetCollectionId),
          sourceFieldId: String(edge.sourceFieldId),
          targetFieldId: String(edge.targetFieldId),
          label: edge.label,
          relationshipType: edge.relationshipType,
        });
      } catch (syncErr) {
        console.error('[RelationshipController] Sync to catalog failed on auto-detect:', syncErr);
      }
    }

    sendSuccess(res, 200, { detectedEdges });
  } catch (err) { next(err); }
};
