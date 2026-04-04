import { FieldMetadata, IFieldMetadata } from '../models/fieldMetadata.model';
import { Relationship } from '../models/relationship.model';
import { CollectionMetadata } from '../models/collectionMetadata.model';
import { AppError } from '../utils/errors';
import mongoose from 'mongoose';

/**
 * SyncService — bidirectional sync between Data Catalog (FieldMetadata) and
 * Relationship Mapper (Relationship collection).
 *
 * Direction A: Catalog → Relationship Mapper
 *   When a field's FK config changes, create/update/delete the matching Relationship.
 *
 * Direction B: Relationship Mapper → Catalog
 *   When a relationship is created/updated/deleted, update the source field's FK metadata.
 */
export class SyncService {

  // ─────────────────────────────────────────────────────────────
  // Direction A: Catalog → Relationship Mapper
  // ─────────────────────────────────────────────────────────────

  /**
   * After a field is created or updated with FK configuration, ensure the
   * corresponding Relationship record exists and is up-to-date.
   */
  static async syncFieldToRelationship(field: IFieldMetadata): Promise<void> {
    if (!field.isForeignKey || !field.targetCollectionId || !field.targetFieldId) {
      // FK was turned off or incomplete — remove any existing relationship
      await this.removeRelationshipForField(field);
      return;
    }

    // Resolve names from IDs
    const sourceColl = await CollectionMetadata.findById(field.collectionId).lean();
    const targetColl = await CollectionMetadata.findById(field.targetCollectionId).lean();
    const targetField = await FieldMetadata.findById(field.targetFieldId).lean();

    if (!sourceColl || !targetColl || !targetField) {
      console.warn('[SyncService] Cannot resolve collection/field names for FK sync');
      return;
    }

    const filter = {
      sourceCollectionId: sourceColl._id,
      sourceFieldId: field._id,
    };

    const relData = {
      sourceCollectionId: sourceColl._id,
      targetCollectionId: targetColl._id,
      sourceFieldId: field._id,
      targetFieldId: targetField._id,
      label: field.relationshipLabel || `${sourceColl.name}.${field.fieldName} → ${targetColl.name}.${targetField.fieldName}`,
      relationshipType: field.relationshipType || 'one-to-many',
      isAutoDetected: false,
    };

    // Upsert: if a relationship already exists for this source field, update it
    await Relationship.findOneAndUpdate(filter, relData, { upsert: true, new: true });
  }

  /**
   * Remove any Relationship record that was driven by this field's FK config.
   */
  static async removeRelationshipForField(field: IFieldMetadata): Promise<void> {
    const sourceColl = await CollectionMetadata.findById(field.collectionId).lean();
    if (!sourceColl) return;

    await Relationship.deleteMany({
      sourceCollectionId: sourceColl._id,
      sourceFieldId: field._id,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Direction B: Relationship Mapper → Catalog
  // ─────────────────────────────────────────────────────────────

  /**
   * After a relationship is created or updated in the Relationship Mapper,
   * update the source field to reflect FK status and target metadata.
   */
  static async syncRelationshipToField(rel: {
    sourceCollectionId: string;
    targetCollectionId: string;
    sourceFieldId: string;
    targetFieldId: string;
    label?: string;
    relationshipType?: string;
  }): Promise<void> {
    // Find source field
    const sourceField = await FieldMetadata.findById(rel.sourceFieldId);
    if (!sourceField) return;

    // Find target collection + field
    const targetColl = await CollectionMetadata.findById(rel.targetCollectionId).lean();
    if (!targetColl) return;

    const targetField = await FieldMetadata.findById(rel.targetFieldId).lean();

    // Update the source field with FK info
    sourceField.isForeignKey = true;
    sourceField.targetCollectionId = targetColl._id as any;
    sourceField.targetFieldId = targetField ? targetField._id as any : undefined;
    sourceField.relationshipLabel = rel.label;
    sourceField.relationshipType = rel.relationshipType as any;

    await sourceField.save();
  }

  /**
   * After a relationship is deleted in the Relationship Mapper,
   * check if the source field is still involved in any remaining relationship.
   * If not, clear its FK metadata.
   */
  static async syncRelationshipDeletion(rel: {
    sourceCollectionId: string;
    sourceFieldId: string;
  }): Promise<void> {
    // Check if any other relationships still reference this source field
    const remaining = await Relationship.countDocuments({
      sourceCollectionId: rel.sourceCollectionId,
      sourceFieldId: rel.sourceFieldId,
    });

    if (remaining > 0) return; // Still referenced — keep FK flag

    await FieldMetadata.updateOne(
      { _id: rel.sourceFieldId },
      {
        $set: { isForeignKey: false },
        $unset: {
          targetCollectionId: '',
          targetFieldId: '',
          relationshipLabel: '',
          relationshipType: '',
        },
      }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Cascade Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * When a field is deleted, remove all relationships involving it as source.
   */
  static async onFieldDeleted(field: IFieldMetadata): Promise<void> {
    // Delete relationships where this field is the source
    await Relationship.deleteMany({
      sourceFieldId: field._id,
    });

    // Also clean any relationships pointing TO this field
    await Relationship.deleteMany({
      targetFieldId: field._id,
    });

    // Clean FK flags on any other fields that targeted this field
    const otherFKFields = await FieldMetadata.find({ targetFieldId: field._id });
    for (const f of otherFKFields) {
      f.isForeignKey = false;
      f.targetCollectionId = undefined;
      f.targetFieldId = undefined;
      f.relationshipLabel = undefined;
      f.relationshipType = undefined;
      await f.save();
    }
  }

  /**
   * When a collection is deleted, cascade-delete all related relationships
   * and clean FK flags on fields in other collections that pointed to it.
   */
  static async onCollectionDeleted(collectionSlug: string): Promise<void> {
    const coll = await CollectionMetadata.findOne({ slug: collectionSlug }).lean();
    if (!coll) return;

    // Delete all relationships involving this collection
    await Relationship.deleteMany({
      $or: [
        { sourceCollectionId: coll._id },
        { targetCollectionId: coll._id },
      ],
    });

    // Clear FK metadata on any field targeting this collection
    await FieldMetadata.updateMany(
      { targetCollectionId: coll._id },
      {
        $set: { isForeignKey: false },
        $unset: {
          targetCollectionId: '',
          targetFieldId: '',
          relationshipLabel: '',
          relationshipType: '',
        },
      }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PK/FK Validation
  // ─────────────────────────────────────────────────────────────

  /**
   * Validate that the field's values in the actual MongoDB collection are unique.
   * If duplicates exist, the field cannot be designated as a Primary Key.
   */
  static async validatePrimaryKeyData(
    collectionId: string | mongoose.Types.ObjectId,
    fieldName: string
  ): Promise<void> {
    const coll = await CollectionMetadata.findById(collectionId).lean();
    if (!coll) throw new AppError(404, 'NOT_FOUND', 'Collection not found');

    const db = (FieldMetadata.db as any).db;
    if (!db) return; // Skip if no direct DB access (e.g. in tests)

    try {
      // Use aggregation to find duplicate non-null values
      const duplicates = await db.collection(coll.slug).aggregate([
        { $match: { [fieldName]: { $ne: null, $exists: true } } },
        { $group: { _id: `$${fieldName}`, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 5 },
      ]).toArray();

      if (duplicates.length > 0) {
        const examples = duplicates.map((d: any) => d._id).join(', ');
        throw new AppError(
          400,
          'PK_VALIDATION_FAILED',
          `Cannot mark '${fieldName}' as Primary Key: duplicate values found (e.g. ${examples}). A PK field must have unique values.`
        );
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.warn('[SyncService] PK validation query failed:', err.message);
    }
  }

  /**
   * Validate that the FK target field exists and is marked as a Primary Key.
   */
  static async validateForeignKeyTarget(
    targetCollectionId: string,
    targetFieldId: string
  ): Promise<void> {
    const targetColl = await CollectionMetadata.findById(targetCollectionId).lean();
    if (!targetColl) {
      throw new AppError(400, 'FK_VALIDATION_FAILED', 'Target collection does not exist');
    }

    const targetField = await FieldMetadata.findById(targetFieldId).lean();
    if (!targetField) {
      throw new AppError(400, 'FK_VALIDATION_FAILED', 'Target field does not exist');
    }

    if (String(targetField.collectionId) !== String(targetCollectionId)) {
      throw new AppError(400, 'FK_VALIDATION_FAILED', 'Target field does not belong to the selected target collection');
    }

    if (!targetField.isPrimaryKey) {
      throw new AppError(
        400,
        'FK_VALIDATION_FAILED',
        `FK target field '${targetField.fieldName}' is not a Primary Key in '${targetColl.name}'. A Foreign Key must reference a Primary Key field.`
      );
    }
  }

  /**
   * Validate referential integrity: all non-null values in the source field
   * must exist in the target collection's PK field.
   */
  static async validateForeignKeyIntegrity(
    sourceCollectionId: string | mongoose.Types.ObjectId,
    fieldName: string,
    targetCollectionId: string | mongoose.Types.ObjectId,
    targetFieldName: string
  ): Promise<void> {
    const sourceColl = await CollectionMetadata.findById(sourceCollectionId).lean();
    const targetColl = await CollectionMetadata.findById(targetCollectionId).lean();
    if (!sourceColl || !targetColl) return;

    const db = (FieldMetadata.db as any).db;
    if (!db) return; // Skip if no direct DB access

    try {
      // Get distinct non-null values from source field
      const sourceValues: any[] = await db.collection(sourceColl.slug)
        .distinct(fieldName, { [fieldName]: { $ne: null, $exists: true } });

      if (sourceValues.length === 0) return; // No data to check

      // Get distinct values from target PK field
      const targetValues: any[] = await db.collection(targetColl.slug)
        .distinct(targetFieldName, { [targetFieldName]: { $ne: null, $exists: true } });

      const targetSet = new Set(targetValues.map(String));
      const orphaned = sourceValues.filter(v => !targetSet.has(String(v)));

      if (orphaned.length > 0) {
        const examples = orphaned.slice(0, 3).join(', ');
        throw new AppError(
          400,
          'FK_INTEGRITY_FAILED',
          `Referential integrity violation: ${orphaned.length} value(s) in '${fieldName}' do not exist in '${targetColl.name}.${targetFieldName}' (e.g. ${examples}).`
        );
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.warn('[SyncService] FK integrity check failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PK Uniqueness
  // ─────────────────────────────────────────────────────────────

  /**
   * Ensure only one primary key per collection.
   * Auto-unsets the old PK when a new one is designated.
   */
  static async enforcePrimaryKeyUniqueness(
    collectionId: string | mongoose.Types.ObjectId,
    newPkFieldId: string | mongoose.Types.ObjectId
  ): Promise<void> {
    await FieldMetadata.updateMany(
      {
        collectionId,
        isPrimaryKey: true,
        _id: { $ne: newPkFieldId },
      },
      { $set: { isPrimaryKey: false } }
    );
  }

  /**
   * Validate that a field is not simultaneously PK and FK.
   */
  static validateNotBothPkAndFk(isPrimaryKey?: boolean, isForeignKey?: boolean): void {
    if (isPrimaryKey && isForeignKey) {
      throw new Error('A field cannot be both a Primary Key and a Foreign Key');
    }
  }
}
