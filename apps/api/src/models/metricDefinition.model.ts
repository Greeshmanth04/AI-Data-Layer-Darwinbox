import mongoose, { Schema, Document } from 'mongoose';

export interface IMetricDefinition extends Document {
  name: string;
  formula: string;
  description?: string;
  category?: string;
  collectionIds: mongoose.Types.ObjectId[];
  lastComputedValue?: any;
  lastComputedAt?: Date;
  history: { value: any; timestamp: Date }[];
}

const MetricDefinitionSchema = new Schema<IMetricDefinition>({
  name: { type: String, required: true, unique: true },
  formula: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  collectionIds: { type: [Schema.Types.ObjectId], ref: 'CollectionMetadata', default: [] },
  lastComputedValue: { type: Schema.Types.Mixed },
  lastComputedAt: { type: Date },
  history: {
    type: [{
      value: { type: Schema.Types.Mixed, required: true },
      timestamp: { type: Date, required: true }
    }],
    default: []
  }
}, { timestamps: true });

export const MetricDefinition = mongoose.model<IMetricDefinition>('MetricDefinition', MetricDefinitionSchema, 'metrics');
