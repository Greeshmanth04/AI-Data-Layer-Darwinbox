import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  req.log.error(err);

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message);
  }

  // Fallback for untracked server panics
  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred on the server.');
};
