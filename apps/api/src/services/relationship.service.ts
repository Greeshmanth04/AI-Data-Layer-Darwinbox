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
    const detectedEdges = [];

    for (const field of fields) {
      const sourceColl = collections.find(c => c._id.toString() === field.collectionId.toString());
      if (!sourceColl) continue;

      // Auto-identify fields that look like IDs and aren't already foreign keys
      if (!field.isPrimaryKey && field.name.toLowerCase().endsWith('id') && !field.isForeignKey) {
        // e.g. employee_id -> employee
        const baseName = field.name.replace(/_id$/i, '').replace(/Id$/i, '');
        const potentialTargetSingular = baseName.toLowerCase();
        
        const targetColl = collections.find(c => 
          c.name.toLowerCase() === potentialTargetSingular + 's' || 
          c.name.toLowerCase() === potentialTargetSingular
        );

        if (targetColl && targetColl.name !== sourceColl.name) {
          // Attempt to find the target's primary key name, or default to generic '_id' (wait, usually PRD uses specific IDs)
          const pkField = fields.find(f => f.collectionId.toString() === targetColl._id.toString() && f.isPrimaryKey);
          const targetFieldName = pkField ? pkField.name : '_id';

          const exists = await Relationship.exists({
            sourceCollection: sourceColl.name,
            sourceField: field.name
          });

          if (!exists) {
            const edge = await Relationship.create({
              sourceCollection: sourceColl.name,
              targetCollection: targetColl.name,
              sourceField: field.name,
              targetField: targetFieldName,
              relationshipType: '1:N',
              isAutoDetected: true,
              label: `${sourceColl.name}.${field.name} → ${targetColl.name}.${targetFieldName}`
            });
            detectedEdges.push(edge);
          }
        }
      }
    }

    await ActivityService.logActivity(userId, 'AUTODETECT_GRAPH', `Found ${detectedEdges.length} edges`);
    return detectedEdges;
  }
}
