import mongoose, { Schema, Document } from 'mongoose';

export type RowFilterOperator = 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte';

export interface IRowFilter {
  field: string;
  operator: RowFilterOperator;
  value: any;
}

export interface ICollectionPermission {
  collectionId: mongoose.Types.ObjectId;
  canRead: boolean;
  allowedFields: string[];
  deniedFields: string[];
  rowFilters: IRowFilter[];
}

export interface IUserGroup extends Document {
  name: string;
  description?: string;
  members: mongoose.Types.ObjectId[];
  permissions: ICollectionPermission[];
}

const RowFilterSchema = new Schema<IRowFilter>({
  field: { type: String, required: true },
  operator: {
    type: String,
    enum: ['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte'],
    required: true
  },
  value: { type: Schema.Types.Mixed, required: true }
}, { _id: false });

const CollectionPermissionSchema = new Schema<ICollectionPermission>({
  collectionId: { type: Schema.Types.ObjectId, ref: 'CollectionMetadata', required: true },
  canRead: { type: Boolean, default: false },
  allowedFields: [{ type: String }],
  deniedFields: [{ type: String }],
  rowFilters: { type: [RowFilterSchema], default: [] }
}, { _id: false });

const UserGroupSchema = new Schema<IUserGroup>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  members: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  permissions: { type: [CollectionPermissionSchema], default: [] }
}, { timestamps: true });

export const UserGroup = mongoose.model<IUserGroup>('UserGroup', UserGroupSchema, 'usergroups');
