import { Response } from 'express';

export const sendSuccess = (res: Response, statusCode: number, data: any, message?: string) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

export const sendError = (res: Response, statusCode: number, code: string, message: string) => {
  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
};
