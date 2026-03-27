import { Router } from 'express';
import healthRoute from './health.route';

const router = Router();

// Mount V1 Domain Routes
router.use('/health', healthRoute);

// Future implementation domains will map here

export default router;
