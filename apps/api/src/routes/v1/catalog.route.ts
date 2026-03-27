import { Router } from 'express';
import { 
  getCollections, getCollectionById, createCollection, updateCollection,
  getFieldById, updateField, generateFieldDescription
} from '../../controllers/catalog.controller';
import { validateRequest } from '../../middleware/validate';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as schemas from '../../validators/catalog.validator';

const router = Router();

router.use(authenticateUser);

router.get('/collections', getCollections);
router.get('/collections/:id', getCollectionById);
router.post('/collections', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.createCollectionSchema), createCollection);
router.put('/collections/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.updateCollectionSchema), updateCollection);

router.get('/fields/:id', getFieldById);
router.put('/fields/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.updateFieldSchema), updateField);
router.post('/fields/:id/generate-description', requireRole(['platform_admin', 'data_steward']), generateFieldDescription);

export default router;
