import { Router } from 'express';
import { login, getMe } from '../../controllers/auth.controller';
import { validateRequest } from '../../middleware/validate';
import { loginSchema } from '../../validators/auth.validator';
import { authenticateUser } from '../../middleware/auth';

const router = Router();
router.post('/login', validateRequest(loginSchema), login);
router.get('/me', authenticateUser, getMe);

export default router;
