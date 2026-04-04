    import mongoose, { Schema, Document } from 'mongoose';

export interface ICollectionMetadata extends Document {
  slug: string;
  name: string;
  module: 'Core' | 'Recruitment' | 'Time' | 'Payroll';
  description?: string;
  recordCount: number;
}

const CollectionMetadataSchema = new Schema<ICollectionMetadata>({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  module: { type: String, required: true, enum: ['Core', 'Recruitment', 'Time', 'Payroll'] },
  description: { type: String },
  recordCount: { type: Number, default: 0 }
}, { timestamps: true });

export const CollectionMetadata = mongoose.model<ICollectionMetadata>('CollectionMetadata', CollectionMetadataSchema, 'collections');
