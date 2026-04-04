import { Request, Response, NextFunction } from 'express';
import { MetricService } from '../services/metric.service';
import { MetricDefinition } from '../models/metricDefinition.model';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import { ActivityService } from '../services/activity.service';

export const getMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await MetricDefinition.find().sort({ category: 1, name: 1 }).lean();
    sendSuccess(res, 200, metrics);
  } catch (err) { next(err); }
};

export const createMetric = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await MetricService.validateSyntax(req.body.formula);
    const metric = await MetricDefinition.create(req.body);
    await ActivityService.logActivity(req.user._id, 'CREATED_METRIC', metric.name);
    sendSuccess(res, 201, metric);
  } catch (err) { next(err); }
};

export const updateMetric = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body.formula) await MetricService.validateSyntax(req.body.formula);
    const metric = await MetricDefinition.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!metric) throw new AppError(404, 'NOT_FOUND', 'Metric not found');
    await ActivityService.logActivity(req.user._id, 'UPDATED_METRIC', metric.name);
    sendSuccess(res, 200, metric);
  } catch (err) { next(err); }
};

export const deleteMetric = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = await MetricDefinition.findByIdAndDelete(req.params.id);
    if (!metric) throw new AppError(404, 'NOT_FOUND', 'Metric not found');
    await ActivityService.logActivity(req.user._id, 'DELETED_METRIC', req.params.id);
    sendSuccess(res, 200, null, 'Deleted successfully');
  } catch (err) { next(err); }
};

export const previewMetricBody = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await MetricService.previewFormula(req.body.formula, req.user._id);
    sendSuccess(res, 200, { result });
  } catch (err) { next(err); }
};

export const previewMetricId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = await MetricDefinition.findById(req.params.id);
    if (!metric) throw new AppError(404, 'NOT_FOUND', 'Metric not found');

    const result = await MetricService.previewFormula(metric.formula, req.user._id);

    // Cache latest computed value
    metric.lastComputedValue = result;
    metric.lastComputedAt = new Date();
    await metric.save();

    await ActivityService.logActivity(req.user._id, 'PREVIEWED_METRIC', metric.name);
    sendSuccess(res, 200, { result });
  } catch (err) { next(err); }
};

export const validateMetricId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = await MetricDefinition.findById(req.params.id);
    if (!metric) throw new AppError(404, 'NOT_FOUND', 'Metric not found');
    const tokens = await MetricService.validateSyntax(metric.formula);
    sendSuccess(res, 200, { valid: true, extractedTokens: tokens });
  } catch (err) { next(err); }
};
