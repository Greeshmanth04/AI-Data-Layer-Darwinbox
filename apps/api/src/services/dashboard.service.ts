import mongoose from 'mongoose';
import { CatalogService } from './catalog.service';
import { ActivityService } from './activity.service';
import { UserGroup } from '../models/userGroup.model';
import { MetricDefinition } from '../models/metricDefinition.model';

export class DashboardService {
  static async getStats(userId: string) {
    const grouped = await CatalogService.getPermittedCollections(userId);
    const readableCollections = Object.values(grouped).flat();

    let totalFields = 0;
    let documentedFields = 0;
    const coverageBreakdown = [];

    for (const coll of readableCollections) {
      const detail = await CatalogService.getPermittedCollectionById(userId, coll._id.toString());
      const sfCount = detail.fields.length;
      const dfCount = detail.fields.filter((f: any) => f.description && f.description.trim() !== '').length;
      
      totalFields += sfCount;
      documentedFields += dfCount;

      const totalRecords = await mongoose.connection.db!.collection(coll.slug).countDocuments();

      coverageBreakdown.push({
        _id: coll._id,
        collectionName: coll.name,
        schemaFields: sfCount,
        documentedFields: dfCount,
        coveragePercentage: sfCount === 0 ? 0 : Math.round((dfCount / sfCount) * 100),
        totalRecords
      });
    }

    const activeMetricsCount = await MetricDefinition.countDocuments();
    const userGroupsCount = await UserGroup.countDocuments();

    return {
      totalCollections: readableCollections.length,
      totalFields,
      documentationCoverage: totalFields === 0 ? 0 : Math.round((documentedFields / totalFields) * 100),
      activeMetrics: activeMetricsCount,
      userGroups: userGroupsCount,
      coverageBreakdown
    };
  }

  static async getHealth(userId: string) {
    const grouped = await CatalogService.getPermittedCollections(userId);
    const readableCollections = Object.values(grouped).flat();
    
    const undocumentedFields: string[] = [];
    const unassignedCollections: string[] = [];

    for (const coll of readableCollections) {
      const detail = await CatalogService.getPermittedCollectionById(userId, coll._id.toString());
      const missing = detail.fields.filter((f: any) => !f.description || f.description.trim() === '');
      missing.forEach((f: any) => undocumentedFields.push(`${coll.name}.${f.name}`));

      const hasPermission = await UserGroup.exists({ "permissions.collectionId": coll._id, "permissions.canRead": true });
      if (!hasPermission) unassignedCollections.push(coll.name);
    }

    const allMetrics = await MetricDefinition.find().lean();
    const readableMetrics = allMetrics.filter(m => 
      !m.collectionIds?.length || m.collectionIds.some(id => readableCollections.some(c => c._id.toString() === id.toString()))
    );
    // Require metrics to have at least 1 preview evaluation to be considered "previewed"
    const metricsNoPreview = readableMetrics.filter(m => !m.lastComputedAt).map(m => m.name);

    return {
      undocumentedFields,
      unassignedCollections,
      metricsNoPreview
    };
  }

  static async getActivity() {
    return ActivityService.getRecentActivity(20);
  }
}
