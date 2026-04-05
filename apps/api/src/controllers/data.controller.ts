import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PermissionService } from '../services/permission.service';
import { AppError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

export const getCollectionData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionName } = req.params;
    
    if (!collectionName) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing collectionName parameter.');
    }
    
    if (!req.permissions) {
      throw new AppError(500, 'SERVER_ERROR', 'Security enforcement middleware bypassed unexpectedly.');
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new AppError(500, 'DB_ERROR', 'Database connection not available.');
    }

    // Apply Field and Row restrictions based on resolved permissions
    const projection = PermissionService.buildMongoProjection(req.permissions);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const skip = (page - 1) * limit;

    const { limit: _l, page: _p, ...filters } = req.query;

    let matchQuery = PermissionService.buildMongoQuery(req.permissions);

    if (Object.keys(filters).length > 0) {
      // Security: ensure user only filters on fields they can actually see
      PermissionService.assertFieldsAccessible(Object.keys(filters), req.permissions);

      if (Object.keys(matchQuery).length > 0) {
        matchQuery = { $and: [matchQuery, filters] };
      } else {
        matchQuery = filters;
      }
    }

    const data = await db.collection(collectionName)
      .find(matchQuery)
      .project(projection)
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalRecords = await db.collection(collectionName).countDocuments(matchQuery);

    sendSuccess(res, 200, {
      data,
      pagination: {
        total: totalRecords,
        page,
        limit,
        hasMore: (skip + data.length) < totalRecords
      }
    });

  } catch (err) {
    next(err);
  }
};
