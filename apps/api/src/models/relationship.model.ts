import mongoose, { Schema, Document } from 'mongoose';

export interface IRelationship extends Document {
  sourceCollectionId: mongoose.Types.ObjectId;
  targetCollectionId: mongoose.Types.ObjectId;
  sourceFieldId: mongoose.Types.ObjectId;
  targetFieldId: mongoose.Types.ObjectId;
  label?: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-one';
  isAutoDetected: boolean;
}

const RelationshipSchema = new Schema<IRelationship>({
  sourceCollectionId: { type: Schema.Types.ObjectId, ref: 'CollectionMetadata', required: true },
  targetCollectionId: { type: Schema.Types.ObjectId, ref: 'CollectionMetadata', required: true },
  sourceFieldId: { type: Schema.Types.ObjectId, ref: 'FieldMetadata', required: true },
  targetFieldId: { type: Schema.Types.ObjectId, ref: 'FieldMetadata', required: true },
  label: { type: String },
  relationshipType: { type: String, enum: ['one-to-one', 'one-to-many', 'many-to-one'], default: 'one-to-many' },
  isAutoDetected: { type: Boolean, default: false }
}, { timestamps: true });

RelationshipSchema.index({ sourceCollectionId: 1, targetCollectionId: 1, sourceFieldId: 1, targetFieldId: 1 }, { unique: true });

export const Relationship = mongoose.model<IRelationship>('Relationship', RelationshipSchema, 'relationships');
