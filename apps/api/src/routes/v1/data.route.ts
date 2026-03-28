import { Router } from 'express';
import { getCollectionData } from '../../controllers/data.controller';
import { authenticateUser } from '../../middleware/auth';
import { enforceCollectionAccess } from '../../middleware/enforcePermissions';

const router = Router();

// Secure all data endpoints explicitly
router.use(authenticateUser);

/**
 * Endpoint dynamically fetching data payload bounds dynamically through native middlewares
 * - Layer 1 is hit inside `enforceCollectionAccess()` inherently mapping the path `collectionName`
 * - Layers 2 and 3 natively map logic within the controller organically!
 */
router.get('/:collectionName', enforceCollectionAccess(), getCollectionData);

export default router;
