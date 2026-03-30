import * as RelationshipController from '../src/controllers/relationship.controller';
import { SyncService } from '../src/services/sync.service';
import { CollectionMetadata } from '../src/models/collectionMetadata.model';
import { FieldMetadata } from '../src/models/fieldMetadata.model';
import { Relationship } from '../src/models/relationship.model';
import { AppError } from '../src/utils/errors';

jest.mock('../src/services/sync.service');
jest.mock('../src/models/collectionMetadata.model');
jest.mock('../src/models/fieldMetadata.model');
jest.mock('../src/models/relationship.model');
jest.mock('../src/services/activity.service');

describe('RelationshipController Validation', () => {
    let mockReq: any;
    let mockRes: any;
    let next: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            user: { _id: 'u1' },
            body: {
                sourceCollection: 'employees',
                targetCollection: 'departments',
                sourceField: 'dept_id',
                targetField: 'id'
            },
            params: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    test('createRelationship should throw if source collection not found', async () => {
        (CollectionMetadata.findOne as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(null) });

        const { createRelationship } = require('../src/controllers/relationship.controller');
        await createRelationship(mockReq, mockRes, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].message).toContain('Source or Target collection not found');
    });

    test('createRelationship should call SyncService validations', async () => {
        (CollectionMetadata.findOne as jest.Mock)
            .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: 's1', name: 'employees' }) })
            .mockReturnValueOnce({ lean: () => Promise.resolve({ _id: 't1', name: 'departments' }) });

        (FieldMetadata.findOne as jest.Mock)
            .mockReturnValueOnce({ lean: () => Promise.resolve({ name: 'dept_id' }) })
            .mockReturnValueOnce({ lean: () => Promise.resolve({ name: 'id' }) });

        (Relationship.create as jest.Mock).mockResolvedValue({ toObject: () => ({}) });

        const { createRelationship } = require('../src/controllers/relationship.controller');
        await createRelationship(mockReq, mockRes, next);

        expect(SyncService.validateForeignKeyTarget).toHaveBeenCalled();
        expect(SyncService.validateForeignKeyIntegrity).toHaveBeenCalled();
        expect(Relationship.create).toHaveBeenCalled();
    });
});
