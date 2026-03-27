import mongoose, { Schema, Document } from 'mongoose';

export interface IMetricPreview {
  evaluatedAt: Date;
  result: number;
  evaluatedBy: mongoose.Types.ObjectId;
}

export interface IMetricDefinition extends Document {
  name: string;
  formula: string;
  baseCollection: string;
  description?: string;
  previews: IMetricPreview[];
}

const MetricPreviewSchema = new Schema<IMetricPreview>({
  evaluatedAt: { type: Date, default: Date.now },
  result: { type: Number, required: true },
  evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

const MetricDefinitionSchema = new Schema<IMetricDefinition>({
  name: { type: String, required: true, unique: true },
  formula: { type: String, required: true },
  baseCollection: { type: String, required: true },
  description: { type: String },
  previews: { type: [MetricPreviewSchema], default: [] }
}, { timestamps: true });

export const MetricDefinition = mongoose.model<IMetricDefinition>('MetricDefinition', MetricDefinitionSchema);
