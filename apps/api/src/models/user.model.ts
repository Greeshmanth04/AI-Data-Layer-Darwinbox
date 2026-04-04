import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name?: string;
  passwordHash: string;
  role: 'platform_admin' | 'data_steward' | 'analyst' | 'viewer';
  groupIds: mongoose.Types.ObjectId[];
  status: 'pending' | 'active' | 'rejected' | 'blocked';
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['platform_admin', 'data_steward', 'analyst', 'viewer'], default: 'viewer' },
  groupIds: { type: [Schema.Types.ObjectId], ref: 'UserGroup', default: [] },
  status: { type: String, enum: ['pending', 'active', 'rejected', 'blocked'], default: 'pending' }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema, 'users');
