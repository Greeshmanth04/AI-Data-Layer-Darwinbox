import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await DashboardService.getStats(req.user._id);
    sendSuccess(res, 200, stats);
  } catch (err) { next(err); }
};

export const getHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await DashboardService.getHealth(req.user._id);
    sendSuccess(res, 200, health);
  } catch (err) { next(err); }
};

export const getActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const activity = await DashboardService.getActivity(page, limit);
    sendSuccess(res, 200, activity);
  } catch (err) { next(err); }
};
