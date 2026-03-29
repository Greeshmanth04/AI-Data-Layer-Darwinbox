import mongoose, { Schema, Document } from 'mongoose';

export interface IRelationship extends Document {
  sourceCollection: string;
  targetCollection: string;
  sourceField: string;
  targetField: string;
  label?: string;
  relationshipType: '1:1' | '1:N' | 'M:N';
  isAutoDetected: boolean;
}

const RelationshipSchema = new Schema<IRelationship>({
  sourceCollection: { type: String, required: true },
  targetCollection: { type: String, required: true },
  sourceField: { type: String, required: true },
  targetField: { type: String, required: true },
  label: { type: String },
  relationshipType: { type: String, enum: ['1:1', '1:N', 'M:N'], default: '1:N' },
  isAutoDetected: { type: Boolean, default: false }
}, { timestamps: true });

RelationshipSchema.index({ sourceCollection: 1, targetCollection: 1, sourceField: 1, targetField: 1 }, { unique: true });

export const Relationship = mongoose.model<IRelationship>('Relationship', RelationshipSchema);
