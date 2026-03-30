import { PermissionService } from '../src/services/permission.service';
import { User } from '../src/models/user.model';
import { Group } from '../src/models/group.model';
import { UserGroup } from '../src/models/userGroup.model';

jest.mock('../src/models/user.model');
jest.mock('../src/models/group.model');
jest.mock('../src/models/userGroup.model');

describe('PermissionService Resolution Core', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserBase = { _id: 'u1', role: 'viewer' };

  test('Case 1: Platform Admin completely bypasses checks unconditionally', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ role: 'platform_admin' });
    const resolved = await PermissionService.resolveCollectionPermissions('a', 'employees');
    expect(resolved.canRead).toBe(true);
    expect(resolved.rowFilters.length).toBe(0);
    expect(resolved.effectiveFields.allowed.length).toBe(0);
  });

  test('Case 2: Throws 403 COLLECTION_ACCESS_DENIED if no groups allow reading', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([]);
    (Group.find as jest.Mock).mockResolvedValue([]);

    await expect(PermissionService.resolveCollectionPermissions('u1', 'employees'))
      .rejects.toThrow(/COLLECTION_ACCESS_DENIED/);
  });

  test('Case 3: Single group allows reading without row filters equates to full row access', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([{ groupId: 'g1' }]);
    (Group.find as jest.Mock).mockResolvedValue([{
      permissions: [{ collectionName: 'employees', canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] }]
    }]);

    const resolved = await PermissionService.resolveCollectionPermissions('u1', 'employees');
    expect(resolved.canRead).toBe(true);
    expect(resolved.rowFilters).toEqual([{}]);
  });

  test('Case 4: Empty allowedFields inside canRead resolves to implicit allow all columns inside effective fields', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([{ groupId: 'g1' }]);
    (Group.find as jest.Mock).mockResolvedValue([{
      permissions: [{ collectionName: 'employees', canRead: true, allowedFields: [], deniedFields: ['salary'], rowFilters: [] }]
    }]);

    const resolved = await PermissionService.resolveCollectionPermissions('u1', 'employees');
    expect(resolved.effectiveFields.allowed).toEqual([]);
    expect(resolved.effectiveFields.denied).toEqual(['salary']);
  });

  test('Case 5: Multiple groups unionizing allowed fields comprehensively', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([{ groupId: 'g1' }, { groupId: 'g2' }]);
    (Group.find as jest.Mock).mockResolvedValue([
      { permissions: [{ collectionName: 'employees', canRead: true, allowedFields: ['name'], deniedFields: [], rowFilters: [] }] },
      { permissions: [{ collectionName: 'employees', canRead: true, allowedFields: ['email'], deniedFields: [], rowFilters: [] }] }
    ]);
    const resolved = await PermissionService.resolveCollectionPermissions('u1', 'employees');
    expect(resolved.effectiveFields.allowed).toContain('name');
    expect(resolved.effectiveFields.allowed).toContain('email');
  });

  test('Case 6: Group denying field strictly removes it from allowed field whitelist', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([{ groupId: 'g1' }, { groupId: 'g2' }]);
    (Group.find as jest.Mock).mockResolvedValue([
      { permissions: [{ collectionName: 'employees', canRead: true, allowedFields: ['name', 'salary'], deniedFields: [], rowFilters: [] }] },
      { permissions: [{ collectionName: 'employees', canRead: true, allowedFields: [], deniedFields: ['salary'], rowFilters: [] }] }
    ]);
    const resolved = await PermissionService.resolveCollectionPermissions('u1', 'employees');
    const projection = PermissionService.buildMongoProjection(resolved);
    // In whitelist mode, denied fields are filtered out (no mixed 1/0 projections)
    expect(projection['salary']).toBeUndefined();
    expect(projection['name']).toBe(1);
  });

  test('Case 7: OR logic combining disparate row filters gracefully across groups', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([{ groupId: 'g1' }, { groupId: 'g2' }]);
    (Group.find as jest.Mock).mockResolvedValue([
      { permissions: [{ collectionName: 'emps', canRead: true, rowFilters: [{ field: 'reg', operator: 'equals', value: 'US' }] }] },
      { permissions: [{ collectionName: 'emps', canRead: true, rowFilters: [{ field: 'dept', operator: 'equals', value: 'HR' }] }] }
    ]);

    const resolved = await PermissionService.resolveCollectionPermissions('u1', 'emps');
    const query = PermissionService.buildMongoQuery(resolved);
    expect(query).toEqual({ $or: [{ reg: 'US' }, { dept: 'HR' }] });
  });

  test('Case 8: assertFieldsAccessible throws 403 FIELD_ACCESS_DENIED if metric attempts fetching denied component', () => {
    const resolved: any = { effectiveFields: { allowed: [], denied: ['salary'] } };
    expect(() => PermissionService.assertFieldsAccessible(['name', 'salary'], resolved))
      .toThrow(/FIELD_ACCESS_DENIED/);
  });

  test('Case 9: buildMongoQuery returns {} if ANY overlapping group provides an empty row filter dict', () => {
    const query = PermissionService.buildMongoQuery({ rowFilters: [{ reg: 'US' }, {}] } as any);
    expect(query).toEqual({});
  });

  test('Case 10: AND operator aggregation natively emitted if a single group possesses multiple internal row filters', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUserBase);
    (UserGroup.find as jest.Mock).mockResolvedValue([{ groupId: 'g1' }]);
    (Group.find as jest.Mock).mockResolvedValue([
      {
        permissions: [{
          collectionName: 'emps', canRead: true, rowFilters: [
            { field: 'reg', operator: 'equals', value: 'US' },
            { field: 'stat', operator: 'equals', value: 'Active' }
          ]
        }]
      }
    ]);
    const resolved = await PermissionService.resolveCollectionPermissions('u1', 'emps');
    const query = PermissionService.buildMongoQuery(resolved);
    expect(query).toEqual({ "$or": [{ "$and": [{ reg: "US" }, { stat: "Active" }] }] });
  });
});
