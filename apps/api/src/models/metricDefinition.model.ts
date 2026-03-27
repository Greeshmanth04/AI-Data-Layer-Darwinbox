import mongoose, { Schema, Document } from 'mongoose';

export interface IMetricDefinition extends Document {
  name: string;
  formula: string;
  baseCollection: string;
  description?: string;
}

const MetricDefinitionSchema = new Schema<IMetricDefinition>({
  name: { type: String, required: true, unique: true },
  formula: { type: String, required: true },
  baseCollection: { type: String, required: true },
  description: { type: String }
}, { timestamps: true });

export const MetricDefinition = mongoose.model<IMetricDefinition>('MetricDefinition', MetricDefinitionSchema);
