import { SyncService } from '../src/services/sync.service';
import { CollectionMetadata } from '../src/models/collectionMetadata.model';
import { FieldMetadata } from '../src/models/fieldMetadata.model';
import { AppError } from '../src/utils/errors';

jest.mock('../src/models/collectionMetadata.model');
jest.mock('../src/models/fieldMetadata.model');

describe('SyncService Validation', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validatePrimaryKeyData', () => {
        const mockCollection = { _id: 'c1', name: 'employees' };

        test('should throw 400 if duplicate values exist', async () => {
            (CollectionMetadata.findById as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve(mockCollection)
            });

            const mockDb = {
                collection: jest.fn().mockReturnThis(),
                aggregate: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([{ _id: 'E001', count: 2 }])
            };
            (FieldMetadata as any).db = { db: mockDb };

            await expect(SyncService.validatePrimaryKeyData('c1', 'emp_id'))
                .rejects.toThrow(/Cannot mark 'emp_id' as Primary Key/);
        });

        test('should pass if no duplicates exist', async () => {
            (CollectionMetadata.findById as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve(mockCollection)
            });

            const mockDb = {
                collection: jest.fn().mockReturnThis(),
                aggregate: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockResolvedValue([])
            };
            (FieldMetadata as any).db = { db: mockDb };

            await expect(SyncService.validatePrimaryKeyData('c1', 'emp_id'))
                .resolves.not.toThrow();
        });
    });

    describe('validateForeignKeyTarget', () => {
        test('should throw if target field is not a PK', async () => {
            (CollectionMetadata.findById as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve({ name: 'departments' })
            });
            (FieldMetadata.findById as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve({ collectionId: 'coll_dept', isPrimaryKey: false, name: 'id' })
            });

            await expect(SyncService.validateForeignKeyTarget('coll_dept', 'f1'))
                .rejects.toThrow(/is not a Primary Key/);
        });

        test('should pass if target field is a PK', async () => {
            (CollectionMetadata.findById as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve({ name: 'departments' })
            });
            (FieldMetadata.findById as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve({ collectionId: 'coll_dept', isPrimaryKey: true, name: 'id' })
            });

            await expect(SyncService.validateForeignKeyTarget('coll_dept', 'f1'))
                .resolves.not.toThrow();
        });
    });


    describe('validateNotBothPkAndFk', () => {
        test('should throw 400 if both are true', () => {
            expect(() => SyncService.validateNotBothPkAndFk(true, true))
                .toThrow(AppError);
            try {
                SyncService.validateNotBothPkAndFk(true, true);
            } catch (err: any) {
                expect(err.statusCode).toBe(400);
                expect(err.code).toBe('VALIDATION_FAILED');
            }
        });

        test('should pass if only one or none is true', () => {
            expect(() => SyncService.validateNotBothPkAndFk(true, false)).not.toThrow();
            expect(() => SyncService.validateNotBothPkAndFk(false, true)).not.toThrow();
            expect(() => SyncService.validateNotBothPkAndFk(false, false)).not.toThrow();
        });
    });
});
