import { SyncService } from '../src/services/sync.service';
import { FieldMetadata } from '../src/models/fieldMetadata.model';
import { Relationship } from '../src/models/relationship.model';
import { CollectionMetadata } from '../src/models/collectionMetadata.model';

jest.mock('../src/models/fieldMetadata.model');
jest.mock('../src/models/relationship.model');
jest.mock('../src/models/collectionMetadata.model');

describe('SyncService Bidirectional Sync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('syncRelationshipToField (Mapper -> Catalog)', () => {
        test('should update source field with FK metadata', async () => {
            const mockField = {
                _id: 'f1',
                save: jest.fn().mockResolvedValue(true)
            };
            // Mock first call for sourceField (no .lean())
            // Mock second call for targetField (with .lean())
            (FieldMetadata.findById as jest.Mock)
                .mockResolvedValueOnce(mockField)
                .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: 'f2', fieldName: 'id' }) });

            (CollectionMetadata.findById as jest.Mock).mockReturnValue({ lean: () => Promise.resolve({ _id: 'c2' }) });

            await SyncService.syncRelationshipToField({
                sourceCollectionId: 'c1',
                targetCollectionId: 'c2',
                sourceFieldId: 'f1',
                targetFieldId: 'f2',
                label: 'Test Label',
                relationshipType: 'one-to-many'
            });

            expect(FieldMetadata.findById).toHaveBeenCalledWith('f1');
            expect((mockField as any).isForeignKey).toBe(true);
            expect((mockField as any).relationshipLabel).toBe('Test Label');
            expect(mockField.save).toHaveBeenCalled();
        });
    });

    describe('syncFieldToRelationship (Catalog -> Mapper)', () => {
        test('should upsert relationship when field has FK config', async () => {
            const mockField: any = {
                _id: 'f1',
                collectionId: 'c1',
                isForeignKey: true,
                targetCollectionId: 'c2',
                targetFieldId: 'f2',
                relationshipLabel: 'Label',
                relationshipType: 'one-to-one'
            };

            (CollectionMetadata.findById as jest.Mock)
                .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: 'c1', name: 'S' }) })
                .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: 'c2', name: 'T' }) });
            
            (FieldMetadata.findById as jest.Mock).mockReturnValue({ lean: () => Promise.resolve({ _id: 'f2', fieldName: 'id' }) });

            await SyncService.syncFieldToRelationship(mockField);

            expect(Relationship.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ sourceFieldId: 'f1' }),
                expect.objectContaining({ relationshipType: 'one-to-one' }),
                expect.any(Object)
            );
        });

        test('should remove relationship when FK is disabled', async () => {
            const mockField: any = {
                _id: 'f1',
                collectionId: 'c1',
                isForeignKey: false
            };

            (CollectionMetadata.findById as jest.Mock).mockReturnValue({ lean: () => Promise.resolve({ _id: 'c1' }) });

            await SyncService.syncFieldToRelationship(mockField);

            expect(Relationship.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ sourceFieldId: 'f1' }));
        });
    });
});
