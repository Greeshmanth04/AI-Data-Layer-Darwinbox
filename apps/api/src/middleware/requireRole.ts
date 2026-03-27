import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'User not authenticated.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient role permissions for this action.'));
    }

    next();
  };
};
