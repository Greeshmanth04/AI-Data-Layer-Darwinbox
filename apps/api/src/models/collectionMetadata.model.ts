import mongoose, { Schema, Document } from 'mongoose';

export interface ICollectionMetadata extends Document {
  name: string;
  displayName: string;
  module: string;
  description?: string;
}

const CollectionMetadataSchema = new Schema<ICollectionMetadata>({
  name: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  module: { type: String, required: true },
  description: { type: String }
}, { timestamps: true });

export const CollectionMetadata = mongoose.model<ICollectionMetadata>('CollectionMetadata', CollectionMetadataSchema);
