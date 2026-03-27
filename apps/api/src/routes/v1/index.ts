import { Router } from 'express';
import healthRoute from './health.route';

import authRoute from './auth.route';
import accessRoute from './access.route';
import catalogRoute from './catalog.route';

const router = Router();

// Mount V1 Domain Routes
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/access', accessRoute);
router.use('/catalog', catalogRoute);

export default router;
