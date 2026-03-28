import mongoose, { Schema, Document } from 'mongoose';

export type RowFilterOperator = 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte';

export interface IRowFilter {
  field: string;
  operator: RowFilterOperator;
  value: any; // string | number | string[] | number[]
}

export interface ICollectionPermission {
  collectionName: string;
  canRead: boolean;
  allowedFields: string[];  // empty = all fields allowed
  deniedFields: string[];   // explicit exclusions; overrides allowedFields
  rowFilters: IRowFilter[]; // zero or more conditions (AND-combined)
}

export interface IGroup extends Document {
  name: string;
  description?: string;
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
