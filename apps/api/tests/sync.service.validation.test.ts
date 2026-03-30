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

    describe('validateForeignKeyIntegrity', () => {
        const mockSource = { _id: 'c1', name: 'employees' };
        const mockTarget = { _id: 'c2', name: 'departments' };

        test('should throw if orphaned values exist', async () => {
            (CollectionMetadata.findById as jest.Mock)
                .mockReturnValueOnce({ lean: () => Promise.resolve(mockSource) })
                .mockReturnValueOnce({ lean: () => Promise.resolve(mockTarget) });

            const mockDb = {
                collection: jest.fn().mockImplementation((name) => ({
                    distinct: jest.fn().mockImplementation((fieldName) => {
                        if (name === 'employees') return Promise.resolve(['D1', 'D2', 'DORPHAN']);
                        if (name === 'departments') return Promise.resolve(['D1', 'D2']);
                        return Promise.resolve([]);
                    })
                }))
            };
            (FieldMetadata as any).db = { db: mockDb };

            await expect(SyncService.validateForeignKeyIntegrity('c1', 'dept_id', 'c2', 'id'))
                .rejects.toThrow(/do not exist in 'departments.id'/);
        });

        test('should pass if all values exist in target', async () => {
            (CollectionMetadata.findById as jest.Mock)
                .mockReturnValueOnce({ lean: () => Promise.resolve(mockSource) })
                .mockReturnValueOnce({ lean: () => Promise.resolve(mockTarget) });

            const mockDb = {
                collection: jest.fn().mockImplementation((name) => ({
                    distinct: jest.fn().mockImplementation((fieldName) => {
                        if (name === 'employees') return Promise.resolve(['D1', 'D2']);
                        if (name === 'departments') return Promise.resolve(['D1', 'D2', 'D3']);
                        return Promise.resolve([]);
                    })
                }))
            };
            (FieldMetadata as any).db = { db: mockDb };

            await expect(SyncService.validateForeignKeyIntegrity('c1', 'dept_id', 'c2', 'id'))
                .resolves.not.toThrow();
        });
    });
});
