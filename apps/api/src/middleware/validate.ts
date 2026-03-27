import { AnyZodObject, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMsg = error.errors.map(e => e.message).join(', ');
        return sendError(res, 400, 'VALIDATION_ERROR', `Invalid request: ${errorMsg}`);
      }
      return next(error);
    }
  };
};
