import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    sendSuccess(res, 200, result);
  } catch (error) { next(error); }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await AuthService.getMe(req.user._id);
    sendSuccess(res, 200, user);
  } catch (error) { next(error); }
};
