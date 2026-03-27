import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export class AuthService {
  static async login(email: string, passwordString: string) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');

    const isMatch = await bcrypt.compare(passwordString, user.passwordHash);
    if (!isMatch) throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');

    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, env.JWT_SECRET, { expiresIn: '12h' });
    
    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      },
      token
    };
  }

  static async getMe(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return user;
  }
}
