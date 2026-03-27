import { Router } from 'express';
import { getGraph, createRelationship, updateRelationship, deleteRelationship, autoDetect } from '../../controllers/relationship.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validateRequest } from '../../middleware/validate';
import { createRelationshipSchema, updateRelationshipSchema } from '../../validators/relationship.validator';

const router = Router();

router.use(authenticateUser);

router.get('/', getGraph);

router.post('/', requireRole(['platform_admin', 'data_steward']), validateRequest(createRelationshipSchema), createRelationship);
router.put('/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(updateRelationshipSchema), updateRelationship);
router.delete('/:id', requireRole(['platform_admin', 'data_steward']), deleteRelationship);
router.post('/auto-detect', requireRole(['platform_admin', 'data_steward']), autoDetect);

export default router;
