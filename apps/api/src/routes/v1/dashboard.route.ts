import { Router } from 'express';
import { getStats, getHealth, getActivity } from '../../controllers/dashboard.controller';
import { authenticateUser } from '../../middleware/auth';

const router = Router();

router.use(authenticateUser);

router.get('/stats', getStats);
router.get('/health', getHealth);
router.get('/activity', getActivity);

export default router;
