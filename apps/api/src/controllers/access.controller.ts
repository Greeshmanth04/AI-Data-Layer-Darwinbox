import { Request, Response, NextFunction } from 'express';
import { Group } from '../models/group.model';
import { User } from '../models/user.model';
import { UserGroup } from '../models/userGroup.model';
import { sendSuccess } from '../utils/response';
import bcrypt from 'bcryptjs';

// Groups
export const getGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await Group.find().lean();
    const userGroups = await UserGroup.find().lean();
    
    const enrichedGroups = groups.map(g => {
      const gUsers = userGroups.filter(ug => String(ug.groupId) === String(g._id));
      return {
        ...g,
        memberCount: gUsers.length,
        userIds: gUsers.map(ug => ug.userId)
      };
    });
    sendSuccess(res, 200, enrichedGroups);
  } catch (error) { next(error); }
};

export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await Group.create(req.body);
    sendSuccess(res, 201, group);
  } catch (error) { next(error); }
};

export const updateGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await Group.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    sendSuccess(res, 200, group);
  } catch (error) { next(error); }
};

export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    await UserGroup.deleteMany({ groupId: req.params.id });
    sendSuccess(res, 200, null, 'Deleted successfully');
  } catch (error) { next(error); }
};

export const updateGroupMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const { userIds } = req.body;
    await UserGroup.deleteMany({ groupId });
    if (userIds && userIds.length > 0) {
      const inserts = userIds.map((uid: string) => ({ userId: uid, groupId }));
      await UserGroup.insertMany(inserts);
    }
    sendSuccess(res, 200, null, 'Members synced successfully');
  } catch (error) { next(error); }
};

// Permissions
export const getGroupPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await Group.findById(req.params.id).lean();
    sendSuccess(res, 200, group?.permissions || []);
  } catch (error) { next(error); }
};

export const updateCollectionPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, collId } = req.params;
    const payload = { collectionName: collId, ...req.body };
    const group = await Group.findById(id);
    if (group) {
        const existingIdx = group.permissions.findIndex(p => p.collectionName === collId);
        if (existingIdx >= 0) group.permissions[existingIdx] = payload;
        else group.permissions.push(payload);
        await group.save();
    }
    sendSuccess(res, 200, group);
  } catch (error) { next(error); }
};

export const deleteCollectionPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, collId } = req.params;
    const group = await Group.findById(id);
    if (group) {
        group.permissions = group.permissions.filter(p => p.collectionName !== collId);
        await group.save();
    }
    sendSuccess(res, 200, null, 'Permission dropped successfully');
  } catch (error) { next(error); }
};

// Users
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find().select('-passwordHash').lean();
    const userGroups = await UserGroup.find().lean();
    
    const enrichedUsers = users.map(u => ({
      ...u,
      groupIds: userGroups.filter(ug => String(ug.userId) === String(u._id)).map(ug => ug.groupId)
    }));
    sendSuccess(res, 200, enrichedUsers);
  } catch (error) { next(error); }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, name } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, passwordHash, role });
    sendSuccess(res, 201, { id: user._id, email: user.email, name: user.name, role: user.role });
  } catch (error) { next(error); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, name, groupIds } = req.body;
    const updateData: any = {};
    if (role) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-passwordHash').lean();
    
    if (groupIds) {
      await UserGroup.deleteMany({ userId: req.params.id });
      if (groupIds.length > 0) {
        const inserts = groupIds.map((gid: string) => ({ userId: req.params.id, groupId: gid }));
        await UserGroup.insertMany(inserts);
      }
    }
    
    sendSuccess(res, 200, user);
  } catch (error) { next(error); }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-passwordHash').lean();
    sendSuccess(res, 200, user, `User status updated to ${status}`);
  } catch (error) { next(error); }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await UserGroup.deleteMany({ userId: req.params.id });
    sendSuccess(res, 200, null, 'User deleted successfully');
  } catch (error) { next(error); }
};
