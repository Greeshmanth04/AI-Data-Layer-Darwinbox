import mongoose from 'mongoose';
import { MetricService } from '../src/services/metric.service';
import { PermissionService } from '../src/services/permission.service';
import { Relationship } from '../src/models/relationship.model';
import { AppError } from '../src/utils/errors';

jest.mock('../src/services/permission.service');
jest.mock('../src/models/relationship.model');
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      db: {
        collection: jest.fn().mockReturnThis(),
        findOne: jest.fn(),
        aggregate: jest.fn().mockReturnThis(),
        toArray: jest.fn()
      }
    }
  };
});

describe('MetricService - Formula Evaluation', () => {
    const userId = 'u1';

    beforeEach(() => {
        jest.clearAllMocks();
        (PermissionService.resolveCollectionPermissions as jest.Mock).mockResolvedValue({
            canRead: true,
            effectiveFields: { allowed: [], denied: [] },
            rowFilters: []
        });
        (PermissionService.buildMongoQuery as jest.Mock).mockReturnValue({});
    });

    describe('Basic Aggregates', () => {
        test('should evaluate COUNT(employees) correctly', async () => {
            const mockDb = mongoose.connection.db as any;
            mockDb.collection().aggregate().toArray.mockResolvedValue([{ val: 10 }]);

            const formula = 'COUNT(employees)';
            const result = await MetricService.previewFormula(formula, userId);

            expect(result).toBe(10);
            expect(mockDb.collection).toHaveBeenCalledWith('employees');
        });

        test('should evaluate SUM(employees.salary) correctly', async () => {
            const mockDb = mongoose.connection.db as any;
            mockDb.collection().aggregate().toArray.mockResolvedValue([{ val: 50000 }]);

            const formula = 'SUM(employees.salary)';
            const result = await MetricService.previewFormula(formula, userId);

            expect(result).toBe(50000);
            const pipeline = mockDb.collection().aggregate.mock.calls[0][0];
            expect(pipeline).toContainEqual({ $group: { _id: null, val: { $sum: '$salary' } } });
        });
    });

    describe('Filter Predicates (WHERE)', () => {
        test('should evaluate COUNT(employees WHERE status = "Active") correctly', async () => {
            const mockDb = mongoose.connection.db as any;
            mockDb.collection().aggregate().toArray.mockResolvedValue([{ val: 5 }]);

            const formula = 'COUNT(employees WHERE status = "Active")';
            await MetricService.previewFormula(formula, userId);

            const pipeline = mockDb.collection().aggregate.mock.calls[0][0];
            expect(pipeline).toContainEqual({ 
                $match: { status: { $regex: /^Active$/i } } 
            });
        });
    });

    describe('Arithmetic Expressions', () => {
        test('should evaluate (SUM(employees.salary) / COUNT(employees)) correctly', async () => {
            const mockDb = mongoose.connection.db as any;
            // First call for SUM
            mockDb.collection().aggregate().toArray.mockResolvedValueOnce([{ val: 1000 }]);
            // Second call for COUNT
            mockDb.collection().aggregate().toArray.mockResolvedValueOnce([{ val: 10 }]);

            const formula = '(SUM(employees.salary) / COUNT(employees))';
            const result = await MetricService.previewFormula(formula, userId);

            expect(result).toBe(100);
        });
    });

    describe('Permission Enforcement', () => {
        test('should throw FIELD_ACCESS_DENIED if field is restricted', async () => {
            (PermissionService.resolveCollectionPermissions as jest.Mock).mockResolvedValue({
                canRead: true,
                effectiveFields: { allowed: ['name'], denied: ['salary'] },
                rowFilters: []
            });
            (PermissionService.assertFieldsAccessible as jest.Mock).mockImplementation(() => {
                throw new AppError(403, 'FIELD_ACCESS_DENIED', 'Access to field salary is denied');
            });

            const formula = 'SUM(employees.salary)';
            await expect(MetricService.previewFormula(formula, userId)).rejects.toThrow('FIELD_ACCESS_DENIED');
        });

        test('should throw COLLECTION_ACCESS_DENIED if collection is restricted', async () => {
            (PermissionService.resolveCollectionPermissions as jest.Mock).mockResolvedValue({
                canRead: false,
                effectiveFields: { allowed: [], denied: [] },
                rowFilters: []
            });

            const formula = 'COUNT(employees)';
            await expect(MetricService.previewFormula(formula, userId)).rejects.toThrow('COLLECTION_ACCESS_DENIED');
        });
    });

    describe('Cross-Collection References', () => {
        test('should handle cross-collection lookup if relationship exists', async () => {
            const mockDb = mongoose.connection.db as any;
            
            // Mock metadata lookups
            mockDb.collection().findOne
                .mockResolvedValueOnce({ _id: 'c1', slug: 'payroll' }) // query collection
                .mockResolvedValueOnce({ _id: 'c2', slug: 'employees' }) // foreign collection
                .mockResolvedValueOnce({ _id: 'f1', fieldName: 'emp_id' }) // local field
                .mockResolvedValueOnce({ _id: 'f2', fieldName: 'id' }); // remote field

            (Relationship.findOne as jest.Mock).mockReturnValue({
                lean: () => Promise.resolve({
                    sourceCollectionId: 'c1',
                    targetCollectionId: 'c2',
                    sourceFieldId: 'f1',
                    targetFieldId: 'f2'
                })
            });

            mockDb.collection().aggregate().toArray.mockResolvedValue([{ val: 3000 }]);

            const formula = 'SUM(payroll.salary WHERE employees.department = "Engineering")';
            const result = await MetricService.previewFormula(formula, userId);

            expect(result).toBe(3000);
            const pipeline = mockDb.collection().aggregate.mock.calls[0][0];
            // Check for $lookup
            const lookup = pipeline.find((s: any) => s.$lookup);
            expect(lookup).toBeDefined();
            expect(lookup.$lookup.from).toBe('employees');
        });
    });
});
