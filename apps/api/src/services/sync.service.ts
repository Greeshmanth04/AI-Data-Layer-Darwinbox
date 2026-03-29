import { FieldMetadata, IFieldMetadata } from '../models/fieldMetadata.model';
import { Relationship } from '../models/relationship.model';
import { CollectionMetadata } from '../models/collectionMetadata.model';

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
  // Helpers
  // ─────────────────────────────────────────────────────────────

  /** Map relationship type between the two schemas */
  static catalogTypeToRelType(t?: string): '1:1' | '1:N' | 'M:N' {
    switch (t) {
      case 'one-to-one':  return '1:1';
      case 'one-to-many': return '1:N';
      case 'many-to-one': return 'M:N';
      default:            return '1:N';
    }
  }

  static relTypeToCatalogType(t?: string): 'one-to-one' | 'one-to-many' | 'many-to-one' {
    switch (t) {
      case '1:1': return 'one-to-one';
      case '1:N': return 'one-to-many';
      case 'M:N': return 'many-to-one';
      default:    return 'one-to-many';
    }
  }

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
      sourceCollection: sourceColl.name,
      sourceField: field.name,
    };

    const relData = {
      sourceCollection: sourceColl.name,
      targetCollection: targetColl.name,
      sourceField: field.name,
      targetField: targetField.name,
      label: field.relationshipLabel || `${sourceColl.name}.${field.name} → ${targetColl.name}.${targetField.name}`,
      relationshipType: this.catalogTypeToRelType(field.relationshipType),
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
      sourceCollection: sourceColl.name,
      sourceField: field.name,
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
    sourceCollection: string;
    targetCollection: string;
    sourceField: string;
    targetField: string;
    label?: string;
    relationshipType?: string;
  }): Promise<void> {
    // Find source collection + field
    const sourceColl = await CollectionMetadata.findOne({ name: rel.sourceCollection }).lean();
    if (!sourceColl) return;

    const sourceField = await FieldMetadata.findOne({
      collectionId: sourceColl._id,
      name: rel.sourceField,
    });
    if (!sourceField) return;

    // Find target collection + field
    const targetColl = await CollectionMetadata.findOne({ name: rel.targetCollection }).lean();
    if (!targetColl) return;

    let targetField = await FieldMetadata.findOne({
      collectionId: targetColl._id,
      name: rel.targetField,
    }).lean();

    // Update the source field with FK info
    sourceField.isForeignKey = true;
    sourceField.targetCollectionId = targetColl._id as any;
    sourceField.targetFieldId = targetField ? targetField._id as any : undefined;
    sourceField.relationshipLabel = rel.label || `${rel.sourceCollection}.${rel.sourceField} → ${rel.targetCollection}.${rel.targetField}`;
    sourceField.relationshipType = this.relTypeToCatalogType(rel.relationshipType);

    await sourceField.save();
  }

  /**
   * After a relationship is deleted in the Relationship Mapper,
   * check if the source field is still involved in any remaining relationship.
   * If not, clear its FK metadata.
   */
  static async syncRelationshipDeletion(rel: {
    sourceCollection: string;
    sourceField: string;
  }): Promise<void> {
    // Check if any other relationships still reference this source field
    const remaining = await Relationship.countDocuments({
      sourceCollection: rel.sourceCollection,
      sourceField: rel.sourceField,
    });

    if (remaining > 0) return; // Still referenced — keep FK flag

    // Clear FK metadata on the source field
    const sourceColl = await CollectionMetadata.findOne({ name: rel.sourceCollection }).lean();
    if (!sourceColl) return;

    await FieldMetadata.updateOne(
      { collectionId: sourceColl._id, name: rel.sourceField },
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
    const sourceColl = await CollectionMetadata.findById(field.collectionId).lean();
    if (!sourceColl) return;

    // Delete relationships where this field is the source
    await Relationship.deleteMany({
      sourceCollection: sourceColl.name,
      sourceField: field.name,
    });

    // Also clean any relationships pointing TO this field
    await Relationship.deleteMany({
      targetCollection: sourceColl.name,
      targetField: field.name,
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
  static async onCollectionDeleted(collectionName: string): Promise<void> {
    // Delete all relationships involving this collection
    await Relationship.deleteMany({
      $or: [
        { sourceCollection: collectionName },
        { targetCollection: collectionName },
      ],
    });

    // Find the collection ID to clean FK target references
    // (The collection may already be deleted, so guard)
    const coll = await CollectionMetadata.findOne({ name: collectionName }).lean();
    if (coll) {
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

import mongoose from 'mongoose';
