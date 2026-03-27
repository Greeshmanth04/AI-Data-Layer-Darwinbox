import mongoose, { Schema, Document } from 'mongoose';

export interface IFieldMetadata extends Document {
  collectionId: mongoose.Types.ObjectId;
  name: string;
  displayName: string;
  type: string;
  isCustom: boolean;
  description?: string;
  tags: string[];
}

const FieldMetadataSchema = new Schema<IFieldMetadata>({
  collectionId: { type: Schema.Types.ObjectId, ref: 'CollectionMetadata', required: true },
  name: { type: String, required: true },
  displayName: { type: String, required: true },
  type: { type: String, required: true },
  isCustom: { type: Boolean, default: false },
  description: { type: String },
  tags: { type: [String], default: [] }
}, { timestamps: true });

FieldMetadataSchema.index({ collectionId: 1, name: 1 }, { unique: true });
FieldMetadataSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const FieldMetadata = mongoose.model<IFieldMetadata>('FieldMetadata', FieldMetadataSchema);
