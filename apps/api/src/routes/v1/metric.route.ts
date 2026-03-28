import { Router } from 'express';
import { 
  getMetrics, createMetric, updateMetric, deleteMetric,
  previewMetricId, previewMetricBody, validateMetricId
} from '../../controllers/metric.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validateRequest } from '../../middleware/validate';
import { metricSchema, metricUpdateSchema, metricFormulaSchema } from '../../validators/metric.validator';

const router = Router();

router.use(authenticateUser);

router.get('/', getMetrics);
router.post('/preview', validateRequest(metricFormulaSchema), previewMetricBody);
router.post('/:id/preview', previewMetricId);
router.post('/:id/validate', validateMetricId);

router.post('/', requireRole(['platform_admin', 'data_steward']), validateRequest(metricSchema), createMetric);
router.put('/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(metricUpdateSchema), updateMetric);
router.delete('/:id', requireRole(['platform_admin', 'data_steward']), deleteMetric);

export default router;
