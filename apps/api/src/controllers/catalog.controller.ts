import { Request, Response, NextFunction } from 'express';
import { CatalogService } from '../services/catalog.service';
import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';

export const getCollections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grouped = await CatalogService.getPermittedCollections(req.user._id);
    sendSuccess(res, 200, grouped);
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
    sendSuccess(res, 201, coll);
  } catch (err) { next(err); }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coll = await CollectionMetadata.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');
    sendSuccess(res, 200, coll);
  } catch (err) { next(err); }
};

export const getFieldById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await CatalogService.getPermittedFieldById(req.user._id, req.params.id);
    sendSuccess(res, 200, field);
  } catch (err) { next(err); }
};

export const updateField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id);
    if (!field) throw new AppError(404, 'NOT_FOUND', 'Field not found');
    
    if (req.body.description && !field.isCustom && req.user.role !== 'platform_admin') {
      throw new AppError(403, 'FORBIDDEN', 'Only custom fields can have descriptions updated manually by non-admins');
    }

    Object.assign(field, req.body);
    await field.save();
    
    sendSuccess(res, 200, field);
  } catch (err) { next(err); }
};

export const generateFieldDescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const field = await FieldMetadata.findById(req.params.id).populate('collectionId');
    if (!field || !field.collectionId) throw new AppError(404, 'NOT_FOUND', 'Field not found');

    const collection = field.collectionId as any;
    
    const description = CatalogService.generateHeuristicDescription(field.name, collection.name);
    
    field.description = description;
    await field.save();

    sendSuccess(res, 200, { description });
  } catch (err) { next(err); }
};
