import { Relationship } from '../models/relationship.model';
import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { CatalogService } from './catalog.service';
import { PermissionService } from './permission.service';
import { ActivityService } from './activity.service';

export class RelationshipService {

  static async getPermittedGraph(userId: string) {
    const groupedCollections = await CatalogService.getPermittedCollections(userId);
    const accessibleCollections = Object.values(groupedCollections).flat();
    const accessibleNames = accessibleCollections.map(c => c.name);

    const rawEdges = await Relationship.find({
      sourceCollection: { $in: accessibleNames },
      targetCollection: { $in: accessibleNames }
    }).lean();

    const secureEdges: typeof rawEdges = [];

    for (const edge of rawEdges) {
      const srcPerms = await PermissionService.resolveCollectionPermissions(userId, edge.sourceCollection, false);
      const tgtPerms = await PermissionService.resolveCollectionPermissions(userId, edge.targetCollection, false);

      if (srcPerms && tgtPerms) {
        const srcDenied = srcPerms.effectiveFields.denied.includes(edge.sourceField);
        const srcMissing = srcPerms.effectiveFields.allowed.length > 0 && !srcPerms.effectiveFields.allowed.includes(edge.sourceField);
        
        const tgtDenied = tgtPerms.effectiveFields.denied.includes(edge.targetField);
        const tgtMissing = tgtPerms.effectiveFields.allowed.length > 0 && !tgtPerms.effectiveFields.allowed.includes(edge.targetField);

        if (!srcDenied && !srcMissing && !tgtDenied && !tgtMissing) {
          secureEdges.push(edge);
        }
      }
    }

    return {
      collections: accessibleCollections,
      relationships: secureEdges
    };
  }

  static async autoDetect(userId: string) {
    const collections = await CollectionMetadata.find().lean();
    const fields = await FieldMetadata.find().lean();
    let detectedCount = 0;

    for (const field of fields) {
      const sourceColl = collections.find(c => c._id.toString() === field.collectionId.toString());
      if (!sourceColl) continue;

      if (field.name.endsWith('Id')) {
        const potentialTargetSingular = field.name.slice(0, -2).toLowerCase();
        
        const targetColl = collections.find(c => 
          c.name.toLowerCase() === potentialTargetSingular + 's' || 
          c.name.toLowerCase() === potentialTargetSingular
        );

        if (targetColl && targetColl.name !== sourceColl.name) {
          const exists = await Relationship.exists({
            sourceCollection: sourceColl.name,
            targetCollection: targetColl.name,
            sourceField: field.name,
            targetField: '_id' 
          });

          if (!exists) {
            await Relationship.create({
              sourceCollection: sourceColl.name,
              targetCollection: targetColl.name,
              sourceField: field.name,
              targetField: '_id',
              relationshipType: '1:N',
              isAutoDetected: true
            });
            detectedCount++;
          }
        }
      }
    }

    await ActivityService.logActivity(userId, 'AUTODETECT_GRAPH', `Found ${detectedCount} edges`);
    return detectedCount;
  }
}
