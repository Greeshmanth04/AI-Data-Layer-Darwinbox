import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import mongoose from 'mongoose';

export const getHealth = (req: Request, res: Response) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  
  sendSuccess(res, 200, {
    status: isDbConnected ? 'UP' : 'DEGRADED',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
};
