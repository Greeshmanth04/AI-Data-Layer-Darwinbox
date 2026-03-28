import { Router } from 'express';
import healthRoute from './health.route';

import authRoute from './auth.route';
import accessRoute from './access.route';
import catalogRoute from './catalog.route';
import dashboardRoute from './dashboard.route';
import relationshipRoute from './relationship.route';
import metricRoute from './metric.route';
import dataRoute from './data.route';

const router = Router();

// Mount V1 Domain Routes
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/access', accessRoute);
router.use('/catalog', catalogRoute);
router.use('/dashboard', dashboardRoute);
router.use('/relationships', relationshipRoute);
router.use('/metrics', metricRoute);
router.use('/data', dataRoute);

export default router;
