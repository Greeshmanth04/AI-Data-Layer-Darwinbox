import { CatalogService } from './catalog.service';
import { ActivityService } from './activity.service';
import { Group } from '../models/group.model';
import { MetricDefinition } from '../models/metricDefinition.model';

export class DashboardService {
  static async getStats(userId: string) {
    const grouped = await CatalogService.getPermittedCollections(userId);
    const readableCollections = Object.values(grouped).flat();

    let totalFields = 0;
    let documentedFields = 0;

    for (const coll of readableCollections) {
      const detail = await CatalogService.getPermittedCollectionById(userId, coll._id.toString());
      totalFields += detail.fields.length;
      documentedFields += detail.fields.filter(f => f.description && f.description.trim() !== '').length;
    }

    return {
      totalCollections: readableCollections.length,
      totalFields,
      documentationCoverage: totalFields === 0 ? 0 : Math.round((documentedFields / totalFields) * 100)
    };
  }

  static async getHealth(userId: string) {
    const grouped = await CatalogService.getPermittedCollections(userId);
    const readableCollections = Object.values(grouped).flat();
    
    const undocumentedFields: string[] = [];
    const unassignedCollections: string[] = [];

    for (const coll of readableCollections) {
      const detail = await CatalogService.getPermittedCollectionById(userId, coll._id.toString());
      const missing = detail.fields.filter(f => !f.description || f.description.trim() === '');
      missing.forEach(f => undocumentedFields.push(`${coll.name}.${f.name}`));

      const hasPermission = await Group.exists({ "permissions.collectionName": coll.name, "permissions.canRead": true });
      if (!hasPermission) unassignedCollections.push(coll.name);
    }

    const allMetrics = await MetricDefinition.find().lean();
    const readableMetrics = allMetrics.filter(m => readableCollections.some(c => c.name === m.baseCollection));
    const metricsNoPreview = readableMetrics.filter(m => !m.description).map(m => m.name);

    return {
      undocumentedFields,
      unassignedCollections,
      metricsNoPreview
    };
  }

  static async getActivity() {
    return ActivityService.getRecentActivity(10);
  }
}
