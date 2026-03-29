import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export class AuthService {
  static async register(email: string, passwordString: string, name?: string) {
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError(400, 'BAD_REQUEST', 'Email already in use');

    const passwordHash = await bcrypt.hash(passwordString, 10);
    const user = await User.create({
      email,
      name,
      passwordHash,
      role: 'viewer',
      status: 'pending' // Default strict lifecycle
    });

    return {
      id: user._id,
      email: user.email,
      status: user.status
    };
  }

  static async login(email: string, passwordString: string) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');

    const isMatch = await bcrypt.compare(passwordString, user.passwordHash);
    if (!isMatch) throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');

    if (user.status === 'pending') throw new AppError(403, 'FORBIDDEN', 'Account is pending administrator approval');
    if (user.status === 'blocked') throw new AppError(403, 'FORBIDDEN', 'Account has been blocked');
    if (user.status === 'rejected') throw new AppError(403, 'FORBIDDEN', 'Account request was rejected');

    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, env.JWT_SECRET, { expiresIn: '12h' });
    
    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status
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
