import { ActivityLog } from '../models/activityLog.model';

export class ActivityService {
  static async logActivity(userId: string, action: string, resource: string, details?: string) {
    try {
      await ActivityLog.create({ userId, action, resource, details });
    } catch (e) {
      console.error('Failed to log activity', e);
    }
  }

  static async getRecentActivity(limit = 10) {
    return ActivityLog.find().sort({ createdAt: -1 }).limit(limit).populate('userId', 'email role').lean();
  }
}
