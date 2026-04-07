import { Relationship } from '../models/relationship.model';
import { CollectionMetadata } from '../models/collectionMetadata.model';
import { FieldMetadata } from '../models/fieldMetadata.model';
import { CatalogService } from './catalog.service';
import { PermissionService } from './permission.service';
import { ActivityService } from './activity.service';
import { SyncService } from './sync.service';
import { AppError } from '../utils/errors';

export class RelationshipService {

  static async getPermittedGraph(userId: string) {
    const groupedCollections = await CatalogService.getPermittedCollections(userId);
    const accessibleCollections = Object.values(groupedCollections).flat();
    const accessibleIds = accessibleCollections.map(c => c._id);
    const slugMap = new Map();
    accessibleCollections.forEach(c => slugMap.set(c._id.toString(), c.slug));

    const rawEdges = await Relationship.find({
      sourceCollectionId: { $in: accessibleIds },
      targetCollectionId: { $in: accessibleIds }
    }).lean();

    const fields = await FieldMetadata.find({ collectionId: { $in: accessibleIds } }).lean();
    const fieldMap = new Map();
    fields.forEach(f => fieldMap.set(f._id.toString(), f.fieldName));

    const secureEdges: any[] = [];

    for (const edge of rawEdges) {
      const sourceSlug = slugMap.get(edge.sourceCollectionId.toString());
      const targetSlug = slugMap.get(edge.targetCollectionId.toString());

      if (!sourceSlug || !targetSlug) continue;

      const srcPerms = await PermissionService.resolveCollectionPermissions(userId, sourceSlug, false);
      const tgtPerms = await PermissionService.resolveCollectionPermissions(userId, targetSlug, false);

      const sourceFieldName = fieldMap.get(edge.sourceFieldId.toString());
      const targetFieldName = fieldMap.get(edge.targetFieldId.toString());

      if (srcPerms && tgtPerms && sourceFieldName && targetFieldName) {
        const srcDenied = srcPerms.effectiveFields.denied.includes(sourceFieldName);
        const srcMissing = srcPerms.effectiveFields.allowed.length > 0 && !srcPerms.effectiveFields.allowed.includes(sourceFieldName);

        const tgtDenied = tgtPerms.effectiveFields.denied.includes(targetFieldName);
        const tgtMissing = tgtPerms.effectiveFields.allowed.length > 0 && !tgtPerms.effectiveFields.allowed.includes(targetFieldName);

        if (!srcDenied && !srcMissing && !tgtDenied && !tgtMissing) {
          secureEdges.push({
            ...edge,
            sourceCollection: sourceSlug,
            targetCollection: targetSlug,
            sourceField: sourceFieldName,
            targetField: targetFieldName
          });
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
      if (!field.isPrimaryKey && field.fieldName.toLowerCase().endsWith('id') && !field.isForeignKey) {
        // e.g. employee_id → employee
        const baseName = field.fieldName.replace(/_id$/i, '').replace(/Id$/i, '');
        const potentialTargetSingular = baseName.toLowerCase();

        const targetColl = collections.find(c =>
          c.slug.toLowerCase() === potentialTargetSingular + 's' ||
          c.slug.toLowerCase() === potentialTargetSingular
        );

        if (targetColl && targetColl.slug !== sourceColl.slug) {
          const pkField = fields.find(f => f.collectionId.toString() === targetColl._id.toString() && f.isPrimaryKey);

          if (pkField) {
            const exists = await Relationship.exists({
              sourceCollectionId: sourceColl._id,
              sourceFieldId: field._id
            });

            if (!exists) {
              const edge = await Relationship.create({
                sourceCollectionId: sourceColl._id,
                targetCollectionId: targetColl._id,
                sourceFieldId: field._id,
                targetFieldId: pkField._id,
                relationshipType: 'one-to-many',
                isAutoDetected: true,
                label: `${sourceColl.slug}.${field.fieldName} → ${targetColl.slug}.${pkField.fieldName}`
              });
              detectedEdges.push(edge);
            }
          }
        }
      }
    }

    await ActivityService.logActivity(userId, 'AUTODETECT_GRAPH', `Found ${detectedEdges.length} edges`);
    return detectedEdges;
  }

  static async createRelationship(userId: string, data: any) {
    const { sourceCollectionId, targetCollectionId, sourceFieldId, targetFieldId } = data;

    const sColl = await CollectionMetadata.findById(sourceCollectionId).lean();
    const tColl = await CollectionMetadata.findById(targetCollectionId).lean();
    if (!sColl || !tColl) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Source or Target collection not found');
    }

    const sField = await FieldMetadata.findById(sourceFieldId).lean();
    const tField = await FieldMetadata.findById(targetFieldId).lean();
    if (!sField || !tField) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Source or Target field not found');
    }

    await SyncService.validateForeignKeyTarget(String(tColl._id), String(tField._id));
    await SyncService.validateRelationshipDataTypes(String(sField._id), String(tField._id));
    await SyncService.validateRelationshipCardinality(
      sColl._id, String(sField._id),
      tColl._id, String(tField._id),
      data.relationshipType || 'one-to-many'
    );


    const edge = await Relationship.create({ ...data, isAutoDetected: false });

    try {
      await SyncService.syncRelationshipToField({
        sourceCollectionId: String(edge.sourceCollectionId),
        targetCollectionId: String(edge.targetCollectionId),
        sourceFieldId: String(edge.sourceFieldId),
        targetFieldId: String(edge.targetFieldId),
        label: edge.label,
        relationshipType: edge.relationshipType,
      });
    } catch (syncErr) {
      console.error('[RelationshipService] Sync to catalog failed on create:', syncErr);
    }

    await ActivityService.logActivity(userId, 'CREATED_EDGE', `${edge.sourceCollectionId} to ${edge.targetCollectionId}`);
    return edge;
  }

  static async updateRelationship(userId: string, edgeId: string, data: any) {
    const { sourceCollectionId, targetCollectionId, sourceFieldId, targetFieldId } = data;

    const sColl = sourceCollectionId ? await CollectionMetadata.findById(sourceCollectionId).lean() : null;
    const tColl = targetCollectionId ? await CollectionMetadata.findById(targetCollectionId).lean() : null;

    if (sColl && tColl && sourceFieldId && targetFieldId) {
      const sField = await FieldMetadata.findById(sourceFieldId).lean();
      const tField = await FieldMetadata.findById(targetFieldId).lean();

      if (sField && tField) {
        await SyncService.validateForeignKeyTarget(String(tColl._id), String(tField._id));
        await SyncService.validateRelationshipDataTypes(String(sField._id), String(tField._id));
        await SyncService.validateRelationshipCardinality(
          sColl._id, String(sField._id),
          tColl._id, String(tField._id),
          data.relationshipType || 'one-to-many'
        );

      }
    }

    const edge = await Relationship.findByIdAndUpdate(edgeId, data, { new: true }).lean();
    if (!edge) throw new AppError(404, 'NOT_FOUND', 'Relationship not found');

    try {
      await SyncService.syncRelationshipToField({
        sourceCollectionId: String(edge.sourceCollectionId),
        targetCollectionId: String(edge.targetCollectionId),
        sourceFieldId: String(edge.sourceFieldId),
        targetFieldId: String(edge.targetFieldId),
        label: edge.label,
        relationshipType: edge.relationshipType,
      });
    } catch (syncErr) {
      console.error('[RelationshipService] Sync to catalog failed on update:', syncErr);
    }

    await ActivityService.logActivity(userId, 'UPDATED_EDGE', edge._id.toString());
    return edge;
  }

  static async deleteRelationship(userId: string, edgeId: string) {
    const edge = await Relationship.findById(edgeId).lean();
    if (!edge) throw new AppError(404, 'NOT_FOUND', 'Relationship not found');

    await Relationship.findByIdAndDelete(edgeId);

    try {
      await SyncService.syncRelationshipDeletion({
        sourceCollectionId: String(edge.sourceCollectionId),
        sourceFieldId: String(edge.sourceFieldId),
      });
    } catch (syncErr) {
      console.error('[RelationshipService] Sync to catalog failed on delete:', syncErr);
    }

    await ActivityService.logActivity(userId, 'DELETED_EDGE', edgeId);
  }
}
