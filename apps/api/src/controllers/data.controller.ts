import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PermissionService } from '../services/permission.service';
import { AppError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

export const getCollectionData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionName } = req.params;
    
    // Explicit safety checks
    if (!collectionName) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing collectionName parameter.');
    }
    
    // Safety check that middleware ran: The enforceCollectionAccess middleware MUST attach req.permissions 
    // before it reaches the controller. If we reach here and it's undefined, the route is improperly mounted.
    if (!req.permissions) {
      throw new AppError(500, 'SERVER_ERROR', 'Security enforcement middleware bypassed unexpectedly.');
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new AppError(500, 'DB_ERROR', 'Database connection not available.');
    }

    // LAYER 2: Field Restrictions (projection natively omitting fields like strictly defined salary)
    const projection = PermissionService.buildMongoProjection(req.permissions);
    
    // LAYER 3: Row Level Filters (query bounds natively mapping eq/lt/neq schema logic)
    const matchQuery = PermissionService.buildMongoQuery(req.permissions);

    // Pagination logic (protects raw collection scans)
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const skip = parseInt(req.query.skip as string) || 0;

    const data = await db.collection(collectionName)
      .find(matchQuery)
      .project(projection)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Attach total structurally scoped limit counts dynamically so the frontend knows mapping structures
    const totalRecords = await db.collection(collectionName).countDocuments(matchQuery);

    sendSuccess(res, 200, {
      data,
      pagination: {
        total: totalRecords,
        skip,
        limit,
        hasMore: (skip + data.length) < totalRecords
      }
    });

  } catch (err) {
    next(err);
  }
};
