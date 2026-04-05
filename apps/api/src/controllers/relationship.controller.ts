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
    const edge = await RelationshipService.createRelationship(req.user._id, req.body);
    sendSuccess(res, 201, edge);
  } catch (err) { next(err); }
};

export const updateRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const edge = await RelationshipService.updateRelationship(req.user._id, req.params.id, req.body);
    sendSuccess(res, 200, edge);
  } catch (err) { next(err); }
};

export const deleteRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await RelationshipService.deleteRelationship(req.user._id, req.params.id);
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
