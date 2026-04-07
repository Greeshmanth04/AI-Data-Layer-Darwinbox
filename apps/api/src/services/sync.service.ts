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
   * Validate that the source and target fields share the same data type.
   * A relationship between fields of different types is semantically invalid
   * and will produce incorrect JOIN results at query time.
   */
  static async validateRelationshipDataTypes(
    sourceFieldId: string,
    targetFieldId: string
  ): Promise<void> {
    const [sourceField, targetField] = await Promise.all([
      FieldMetadata.findById(sourceFieldId).lean(),
      FieldMetadata.findById(targetFieldId).lean(),
    ]);

    if (!sourceField || !targetField) return; // Already caught by caller

    const srcType = sourceField.dataType;
    const tgtType = targetField.dataType;

    if (srcType && tgtType && srcType !== tgtType) {
      throw new AppError(
        400,
        'RELATIONSHIP_DATA_TYPE_MISMATCH',
        `Data type mismatch: source field '${sourceField.fieldName}' is '${srcType}' but target field '${targetField.fieldName}' is '${tgtType}'. Both fields must share the same data type to form a valid relationship.`
      );
    }
  }


  // ─────────────────────────────────────────────────────────────
  // Relationship Cardinality Validation
  // ─────────────────────────────────────────────────────────────

  /**
   * Detect the actual cardinality of a relationship by querying real MongoDB data.
   *
   * Algorithm:
   *   - sourceUnique: all values in source field are distinct (no duplicates)
   *   - targetUnique: all values in target field are distinct (no duplicates)
   *
   *   sourceUnique AND targetUnique  → one-to-one
   *   NOT sourceUnique AND targetUnique → one-to-many   (many source rows → one target row)
   *   sourceUnique AND NOT targetUnique → many-to-one   (one source row → many target rows)
   *   NOT sourceUnique AND NOT targetUnique → many-to-many
   *
   * Returns null when there is not enough data to make a determination (empty collections).
   */
  private static async detectActualCardinality(
    sourceSlug: string,
    sourceFieldName: string,
    targetSlug: string,
    targetFieldName: string
  ): Promise<'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many' | null> {
    const db = (FieldMetadata.db as any).db;
    if (!db) return null;

    try {
      const [srcTotal, srcDistinct, tgtTotal, tgtDistinct] = await Promise.all([
        db.collection(sourceSlug).countDocuments({ [sourceFieldName]: { $ne: null, $exists: true } }),
        (async () => {
          const vals = await db.collection(sourceSlug).distinct(sourceFieldName, { [sourceFieldName]: { $ne: null, $exists: true } });
          return vals.length;
        })(),
        db.collection(targetSlug).countDocuments({ [targetFieldName]: { $ne: null, $exists: true } }),
        (async () => {
          const vals = await db.collection(targetSlug).distinct(targetFieldName, { [targetFieldName]: { $ne: null, $exists: true } });
          return vals.length;
        })(),
      ]);

      // Not enough data — skip validation
      if (srcTotal === 0 || tgtTotal === 0) return null;

      const sourceUnique = srcTotal === srcDistinct;
      const targetUnique = tgtTotal === tgtDistinct;

      if (sourceUnique && targetUnique) return 'one-to-one';
      if (!sourceUnique && targetUnique) return 'one-to-many';
      if (sourceUnique && !targetUnique) return 'many-to-one';
      return 'many-to-many';
    } catch {
      return null; // Non-blocking: if query fails, skip
    }
  }

  /**
   * Validate that the requested relationship type matches the actual data cardinality.
   * Throws INVALID_RELATIONSHIP_TYPE with a helpful detected-type message on mismatch.
   * Silently skips when collections have no data.
   */
  static async validateRelationshipCardinality(
    sourceCollectionId: string | mongoose.Types.ObjectId,
    sourceFieldId: string,
    targetCollectionId: string | mongoose.Types.ObjectId,
    targetFieldId: string,
    requestedType: string
  ): Promise<void> {
    const [sourceColl, targetColl, sourceField, targetField] = await Promise.all([
      CollectionMetadata.findById(sourceCollectionId).lean(),
      CollectionMetadata.findById(targetCollectionId).lean(),
      FieldMetadata.findById(sourceFieldId).lean(),
      FieldMetadata.findById(targetFieldId).lean(),
    ]);

    if (!sourceColl || !targetColl || !sourceField || !targetField) return;

    const detected = await this.detectActualCardinality(
      sourceColl.slug, sourceField.fieldName,
      targetColl.slug, targetField.fieldName
    );

    if (!detected) return; // No data — skip

    if (detected !== requestedType) {
      const friendlyMap: Record<string, string> = {
        'one-to-one': '1:1  (One-to-One)',
        'one-to-many': '1:N  (One-to-Many)',
        'many-to-one': 'N:1  (Many-to-One)',
        'many-to-many': 'N:N  (Many-to-Many)',
      };
      throw new AppError(
        400,
        'INVALID_RELATIONSHIP_TYPE',
        `Relationship type mismatch: you selected '${friendlyMap[requestedType] || requestedType}' but the actual data cardinality is '${friendlyMap[detected]}'. ` +
        `Please choose '${friendlyMap[detected]}' or adjust the fields to match the intended cardinality.`
      );
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

  // ─────────────────────────────────────────────────────────────
  // Data Quality — Field Type Value Validation
  // ─────────────────────────────────────────────────────────────

  /**
   * Validate that actual MongoDB document values match each field's configured dataType.
   *
   * Type check rules:
   *   string   → typeof v === 'string'
   *   number   → typeof v === 'number'
   *   boolean  → typeof v === 'boolean'
   *   date     → instanceof Date || isNaN(Date.parse(v)) === false
   *   objectid → 24-char hex string or BSON ObjectId
   *
   * null / undefined values are ignored (not counted as mismatches).
   */
  static async validateFieldDataTypes(
    collectionId: string | mongoose.Types.ObjectId
  ): Promise<Array<{
    fieldName: string;
    dataType: string;
    typeMismatchCount: number;
    sampleInvalidValues: string[];
  }>> {
    const coll = await CollectionMetadata.findById(collectionId).lean();
    if (!coll) return [];

    const fields = await FieldMetadata.find({ collectionId }).lean();
    if (fields.length === 0) return [];

    const db = (FieldMetadata.db as any).db;
    if (!db) return [];

    const isValidForType = (value: any, dataType: string): boolean => {
      switch (dataType) {
        case 'string':
          return typeof value === 'string';
        case 'number':
          return typeof value === 'number';
        case 'boolean':
          return typeof value === 'boolean';
        case 'date':
          if (value instanceof Date) return true;
          if (typeof value === 'string') return !isNaN(Date.parse(value));
          return false;
        case 'objectid':
        case 'reference': {
          const s = String(value);
          return /^[a-fA-F0-9]{24}$/.test(s) || (typeof value === 'object' && value !== null && value._bsontype === 'ObjectId');
        }
        default:
          return true; // Unknown types are not validated
      }
    };

    const reports = [];

    for (const field of fields) {
      try {
        // Fetch all non-null values for this field from the real collection
        const docs: any[] = await db.collection(coll.slug)
          .find(
            { [field.fieldName]: { $ne: null, $exists: true } },
            { projection: { [field.fieldName]: 1, _id: 0 } }
          )
          .limit(5000) // Cap to avoid memory issues on large collections
          .toArray();

        const invalidValues: string[] = [];

        for (const doc of docs) {
          const value = doc[field.fieldName];
          if (value === null || value === undefined) continue;

          if (!isValidForType(value, field.dataType)) {
            const repr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const truncated = repr.length > 80 ? repr.substring(0, 80) + '…' : repr;
            if (!invalidValues.includes(truncated)) {
              invalidValues.push(truncated);
            }
          }
        }

        if (invalidValues.length > 0) {
          reports.push({
            fieldName: field.fieldName,
            dataType: field.dataType,
            typeMismatchCount: invalidValues.length,
            sampleInvalidValues: invalidValues.slice(0, 5),
          });
        } else {
          reports.push({
            fieldName: field.fieldName,
            dataType: field.dataType,
            typeMismatchCount: 0,
            sampleInvalidValues: [],
          });
        }
      } catch (err: any) {
        console.warn(`[SyncService] Type validation failed for field '${field.fieldName}':`, err.message);
      }
    }

    return reports;
  }

  /**
   * Validate that a field is not simultaneously PK and FK.
   */
  static validateNotBothPkAndFk(isPrimaryKey?: boolean, isForeignKey?: boolean): void {
    if (isPrimaryKey && isForeignKey) {
      throw new AppError(400, 'VALIDATION_FAILED', 'A field cannot be both a Primary Key and a Foreign Key');
    }
  }
}
