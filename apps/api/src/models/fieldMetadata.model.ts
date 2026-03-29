import mongoose, { Schema, Document } from 'mongoose';

export interface IFieldMetadata extends Document {
  collectionId: mongoose.Types.ObjectId;
  name: string;
  displayName: string;
  type: string;
  isCustom: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  targetCollectionId?: mongoose.Types.ObjectId;
  targetFieldId?: mongoose.Types.ObjectId;
  relationshipLabel?: string;
  relationshipType?: 'one-to-one' | 'one-to-many' | 'many-to-one';
  aiDescription?: string;
  manualDescription?: string;
  descriptionSource: 'ai' | 'manual' | 'none';
  tags: string[];
}

const FieldMetadataSchema = new Schema<IFieldMetadata>({
  collectionId: { type: Schema.Types.ObjectId, ref: 'CollectionMetadata', required: true },
  name: { type: String, required: true },
  displayName: { type: String, required: true },
  type: { type: String, required: true },
  isCustom: { type: Boolean, default: false },
  isPrimaryKey: { type: Boolean, default: false },
  isForeignKey: { type: Boolean, default: false },
  targetCollectionId: { type: Schema.Types.ObjectId, ref: 'CollectionMetadata' },
  targetFieldId: { type: Schema.Types.ObjectId, ref: 'FieldMetadata' },
  relationshipLabel: { type: String },
  relationshipType: { type: String, enum: ['one-to-one', 'one-to-many', 'many-to-one'] },
  aiDescription: { type: String },
  manualDescription: { type: String },
  descriptionSource: { type: String, enum: ['ai', 'manual', 'none'], default: 'none' },
  tags: { type: [String], default: [] }
}, { timestamps: true });

FieldMetadataSchema.index({ collectionId: 1, name: 1 }, { unique: true });
FieldMetadataSchema.index({ name: 'text', aiDescription: 'text', manualDescription: 'text', tags: 'text' });

export const FieldMetadata = mongoose.model<IFieldMetadata>('FieldMetadata', FieldMetadataSchema);
