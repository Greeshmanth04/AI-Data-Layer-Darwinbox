import { Request, Response, NextFunction } from 'express';
import { RelationshipService } from '../services/relationship.service';
import { Relationship } from '../models/relationship.model';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import { ActivityService } from '../services/activity.service';

export const getGraph = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const graph = await RelationshipService.getPermittedGraph(req.user._id);
    sendSuccess(res, 200, graph);
  } catch (err) { next(err); }
};

export const createRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const edge = await Relationship.create({ ...req.body, isAutoDetected: false });
    await ActivityService.logActivity(req.user._id, 'CREATED_EDGE', `${edge.sourceCollection} to ${edge.targetCollection}`);
    sendSuccess(res, 201, edge);
  } catch (err) { next(err); }
};

export const updateRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const edge = await Relationship.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!edge) throw new AppError(404, 'NOT_FOUND', 'Relationship not found');
    await ActivityService.logActivity(req.user._id, 'UPDATED_EDGE', edge._id.toString());
    sendSuccess(res, 200, edge);
  } catch (err) { next(err); }
};

export const deleteRelationship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await Relationship.findByIdAndDelete(req.params.id);
    await ActivityService.logActivity(req.user._id, 'DELETED_EDGE', req.params.id);
    sendSuccess(res, 200, null, 'Deleted successfully');
  } catch (err) { next(err); }
};

export const autoDetect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detectedEdges = await RelationshipService.autoDetect(req.user._id);
    sendSuccess(res, 200, { detectedEdges });
  } catch (err) { next(err); }
};
