import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name?: string;
  passwordHash: string;
  role: 'platform_admin' | 'data_steward' | 'viewer';
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['platform_admin', 'data_steward', 'viewer'], default: 'viewer' }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
