import { Router } from 'express';
import { 
  getCollections, getCollectionById, createCollection, updateCollection, deleteCollection,
  getFieldById, updateField, generateFieldDescription, createField, deleteField,
  getDictionary, bulkGenerateDescriptions
} from '../../controllers/catalog.controller';
import { validateRequest } from '../../middleware/validate';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as schemas from '../../validators/catalog.validator';

const router = Router();

router.use(authenticateUser);

// Dictionary — Layer 1+2 enforced inside getDictionary via PermissionService per-collection
router.get('/dictionary', getDictionary);

// Collections — Layer 1 enforced by service; Layer 2+3 applied per collection
router.get('/collections', getCollections);

// Single collection — all three layers enforced:
// Layer 1: collection access check
// Layer 2: field projection applied (permittedFields)
// Layer 3: row-count scoped to row query
router.get('/collections/:id', getCollectionById);

router.post('/collections', requireRole(['platform_admin']), validateRequest(schemas.createCollectionSchema), createCollection);
router.put('/collections/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.updateCollectionSchema), updateCollection);
router.delete('/collections/:id', requireRole(['platform_admin']), deleteCollection);

// ── Field routes ─────────────────────────────────────────────────────────────

// Bulk backfill — must come BEFORE /:id routes to avoid route collision
router.post(
  '/fields/bulk-generate-descriptions',
  requireRole(['platform_admin', 'data_steward']),
  bulkGenerateDescriptions,
);

router.post('/fields', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.createFieldSchema), createField);

// Single field read — Layer 1+2 enforced inside getPermittedFieldById
router.get('/fields/:id', getFieldById);

router.put('/fields/:id', requireRole(['platform_admin', 'data_steward']), validateRequest(schemas.updateFieldSchema), updateField);
router.delete('/fields/:id', requireRole(['platform_admin']), deleteField);

// Re-generate description on demand — available to any authenticated user who can view the field
router.post('/fields/:id/generate-description', generateFieldDescription);

export default router;
