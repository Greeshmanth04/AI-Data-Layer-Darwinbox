import { Router } from 'express';
import { 
  getGroups, createGroup, updateGroup, deleteGroup,
  updateGroupMembers, getGroupPermissions, updateCollectionPermission, deleteCollectionPermission,
  getUsers, createUser, updateUser
} from '../../controllers/access.controller';
import { validateRequest } from '../../middleware/validate';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as schemas from '../../validators/access.validator';

const router = Router();

router.use(authenticateUser, requireRole(['platform_admin']));

// Groups
router.get('/groups', getGroups);
router.post('/groups', validateRequest(schemas.createGroupSchema), createGroup);
router.put('/groups/:id', validateRequest(schemas.updateGroupSchema), updateGroup);
router.delete('/groups/:id', deleteGroup);

// Members
router.put('/groups/:id/members', validateRequest(schemas.updateGroupMembersSchema), updateGroupMembers);

// Permissions
router.get('/groups/:id/permissions', getGroupPermissions);
router.put('/groups/:id/permissions/:collId', validateRequest(schemas.updatePermissionSchema), updateCollectionPermission);
router.delete('/groups/:id/permissions/:collId', deleteCollectionPermission);

// Users
router.get('/users', getUsers);
router.post('/users', validateRequest(schemas.createUserSchema), createUser);
router.put('/users/:id', validateRequest(schemas.updateUserSchema), updateUser);

export default router;
