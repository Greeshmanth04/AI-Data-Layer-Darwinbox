import { Request, Response, NextFunction } from 'express';
import { MetricService } from '../services/metric.service';
import { MetricDefinition } from '../models/metricDefinition.model';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import { ActivityService } from '../services/activity.service';
import { CatalogService } from '../services/catalog.service';
import { LLMService } from '../services/llm.service';

export const getMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const skip = (page - 1) * limit;

    const metrics = await MetricDefinition.find()
      .sort({ category: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
      
    // Metrics frontend explicitly relies on bare array right now, so we must return just the array to avoid breaking the UI for the moment until UI adjusts to pagination block
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

    metric.lastComputedValue = result;
    metric.lastComputedAt = new Date();
    
    if (!metric.history) metric.history = [];
    metric.history.unshift({ value: result, timestamp: metric.lastComputedAt });
    if (metric.history.length > 5) metric.history.pop();

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

export const generateFormula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;

    // Fetch schema context (permission-aware) for the current user
    const schema = await CatalogService.getDictionary(req.user._id);

    if (!schema || schema.length === 0) {
      throw new AppError(400, 'NO_SCHEMA', 'No collections available. Please ensure the data catalog has been synced.');
    }

    // Generate formula via LLM (with heuristic fallback)
    const { formula, source, error } = await LLMService.generateMetricFormula(prompt, schema);

    // Validate the generated formula using existing validation logic
    let valid = true;
    let validationError: string | null = null;
    try {
      await MetricService.validateSyntax(formula);
    } catch (err: any) {
      valid = false;
      validationError = err.message || 'Generated formula failed validation';
    }

    sendSuccess(res, 200, { formula, source, valid, validationError, debugError: error });
  } catch (err) { next(err); }
};

