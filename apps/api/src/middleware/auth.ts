import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  // Skeleton implementation: verify auth token mapping internally
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authentication token.'));
  }
  
  // Phase 2 will implement JWT decoding and DB user lookup here
  next();
};
