import { Router } from 'express';
import { 
  getCollections, getCollectionById, createCollection, updateCollection, deleteCollection,
  getFieldById, updateField, generateFieldDescription, createField, deleteField
} from '../../controllers/catalog.controller';
import { validateRequest } from '../../middleware/validate';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as schemas from '../../validators/catalog.validator';

const router = Router();

router.use(authenticateUser);

router.get('/collections', getCollections);
router.get('/collections/:id', getCollectionById);
router.post('/collections', requireRole(['platform_admin']), validateRequest(schemas.createCollectionSchema), createCollection);
router.put('/collections/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.updateCollectionSchema), updateCollection);
router.delete('/collections/:id', requireRole(['platform_admin']), deleteCollection);

router.post('/fields', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.createFieldSchema), createField);
router.get('/fields/:id', getFieldById);
router.put('/fields/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.updateFieldSchema), updateField);
router.delete('/fields/:id', requireRole(['platform_admin']), deleteField);
router.post('/fields/:id/generate-description', requireRole(['platform_admin', 'data_steward']), generateFieldDescription);

export default router;
