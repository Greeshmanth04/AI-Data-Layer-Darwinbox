import mongoose, { Schema, Document } from 'mongoose';

export interface IUserGroup extends Document {
  userId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
}

const UserGroupSchema = new Schema<IUserGroup>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true }
}, { timestamps: true });

UserGroupSchema.index({ userId: 1, groupId: 1 }, { unique: true });

export const UserGroup = mongoose.model<IUserGroup>('UserGroup', UserGroupSchema);
