import mongoose, { Schema, Document } from 'mongoose';

export interface IRowFilter {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt';
  value: any;
}

export interface ICollectionPermission {
  collectionName: string;
  canRead: boolean;
  allowedFields: string[];
  deniedFields: string[];
  rowFilters: IRowFilter[];
}

export interface IGroup extends Document {
  name: string;
  description?: string;
  permissions: ICollectionPermission[];
}

const RowFilterSchema = new Schema<IRowFilter>({
  field: { type: String, required: true },
  operator: { type: String, enum: ['equals', 'contains', 'in', 'gt', 'lt'], required: true },
  value: { type: Schema.Types.Mixed, required: true }
}, { _id: false });

const CollectionPermissionSchema = new Schema<ICollectionPermission>({
  collectionName: { type: String, required: true },
  canRead: { type: Boolean, default: false },
  allowedFields: [{ type: String }],
  deniedFields: [{ type: String }],
  rowFilters: { type: [RowFilterSchema], default: [] }
}, { _id: false });

const GroupSchema = new Schema<IGroup>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: { type: [CollectionPermissionSchema], default: [] }
}, { timestamps: true });

export const Group = mongoose.model<IGroup>('Group', GroupSchema);
