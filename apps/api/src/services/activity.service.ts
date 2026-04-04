import { ActivityLog } from '../models/activityLog.model';

export class ActivityService {
  static async logActivity(userId: string, action: string, resource: string, details?: string) {
    try {
      await ActivityLog.create({ userId, action, resource, details });
    } catch (e) {
      console.error('Failed to log activity', e);
    }
  }

  static async getRecentActivity(limit = 20, skip = 0) {
    return ActivityLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'email name role')
      .lean();
  }

  static async getActivityCount() {
    return ActivityLog.countDocuments();
  }
}
