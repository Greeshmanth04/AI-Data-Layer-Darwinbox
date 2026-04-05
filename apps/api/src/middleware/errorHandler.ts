import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (req.log && typeof req.log.error === 'function') {
    req.log.error(err);
  } else {
    console.error('Unhandled Server Error:', err);
  }

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message);
  }

  // Handle Mongoose CastError (invalid ObjectId, common for "" inputs)
  if (err.name === 'CastError') {
    return sendError(res, 400, 'INVALID_PARAMETER', `Invalid data provided for field: ${(err as any).path}`);
  }

  // Handle MongoDB Unique Constraint violations (e.g. Field already exists)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {}).join(', ');
    return sendError(res, 400, 'ALREADY_EXISTS', `An entry with this ${field || 'value'} already exists.`);
  }

  // Fallback for untracked server panics
  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred on the server.');
};
