import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';
import { env } from '../config/env';
import { User } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authentication token.'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'User associated with token no longer exists.'));
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Invalid token.'));
    }
    next(err);
  }
};
