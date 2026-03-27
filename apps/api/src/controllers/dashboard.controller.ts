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
    const activity = await DashboardService.getActivity();
    sendSuccess(res, 200, activity);
  } catch (err) { next(err); }
};
