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

  // Fallback for untracked server panics
  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred on the server.');
};
