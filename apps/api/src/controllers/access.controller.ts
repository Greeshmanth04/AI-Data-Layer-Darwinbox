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
    sendSuccess(res, 200, groups);
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
    sendSuccess(res, 200, users);
  } catch (error) { next(error); }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, role });
    sendSuccess(res, 201, { id: user._id, email: user.email, role: user.role });
  } catch (error) { next(error); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-passwordHash').lean();
    sendSuccess(res, 200, user);
  } catch (error) { next(error); }
};
