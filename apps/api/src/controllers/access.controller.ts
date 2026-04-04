import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';
import { UserGroup } from '../models/userGroup.model';
import { sendSuccess } from '../utils/response';
import bcrypt from 'bcryptjs';

// Groups
export const getGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userGroups = await UserGroup.find().lean();
    
    const enrichedGroups = userGroups.map(g => {
      return {
        ...g,
        memberCount: g.members ? g.members.length : 0,
        userIds: g.members || []
      };
    });
    sendSuccess(res, 200, enrichedGroups);
  } catch (error) { next(error); }
};

export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await UserGroup.create(req.body);
    sendSuccess(res, 201, group);
  } catch (error) { next(error); }
};

export const updateGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await UserGroup.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    sendSuccess(res, 200, group);
  } catch (error) { next(error); }
};

export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await UserGroup.findByIdAndDelete(req.params.id);
    sendSuccess(res, 200, null, 'Deleted successfully');
  } catch (error) { next(error); }
};

export const updateGroupMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;
    const { userIds } = req.body;
    await UserGroup.findByIdAndUpdate(groupId, { members: userIds });
    sendSuccess(res, 200, null, 'Members synced successfully');
  } catch (error) { next(error); }
};

// Permissions
export const getGroupPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await UserGroup.findById(req.params.id).lean();
    sendSuccess(res, 200, group?.permissions || []);
  } catch (error) { next(error); }
};

export const updateCollectionPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, collId } = req.params;
    const payload = { collectionId: collId, ...req.body };
    const group = await UserGroup.findById(id);
    if (group) {
        const existingIdx = group.permissions.findIndex((p: any) => p.collectionId?.toString() === collId.toString());
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
    const group = await UserGroup.findById(id);
    if (group) {
        group.permissions = group.permissions.filter((p: any) => p.collectionId?.toString() !== collId.toString());
        await group.save();
    }
    sendSuccess(res, 200, null, 'Permission dropped successfully');
  } catch (error) { next(error); }
};

// Users
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find().select('-passwordHash').lean();
    
    const enrichedUsers = users.map(u => ({
      ...u,
      groupIds: u.groupIds || []
    }));
    sendSuccess(res, 200, enrichedUsers);
  } catch (error) { next(error); }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, name, groupIds } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, passwordHash, role, groupIds: groupIds || [] });
    
    if (groupIds && groupIds.length > 0) {
      await UserGroup.updateMany(
        { _id: { $in: groupIds } },
        { $addToSet: { members: user._id } }
      );
    }
    
    sendSuccess(res, 201, { id: user._id, email: user.email, name: user.name, role: user.role, groupIds: user.groupIds });
  } catch (error) { next(error); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, name, groupIds } = req.body;
    const updateData: any = {};
    if (role) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    if (groupIds) updateData.groupIds = groupIds;
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-passwordHash').lean();
    
    if (groupIds) {
      await UserGroup.updateMany(
        { members: req.params.id },
        { $pull: { members: req.params.id } }
      );
      if (groupIds.length > 0) {
        await UserGroup.updateMany(
          { _id: { $in: groupIds } },
          { $addToSet: { members: req.params.id } }
        );
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
    await UserGroup.updateMany(
        { members: req.params.id },
        { $pull: { members: req.params.id } }
    );
    sendSuccess(res, 200, null, 'User deleted successfully');
  } catch (error) { next(error); }
};
