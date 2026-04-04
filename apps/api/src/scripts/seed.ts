import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const MONGODB_URI = env.MONGODB_URI || 'mongodb://localhost:27017/darwinbox_ai';

// --------------------------------------------------
// HELPERS
// --------------------------------------------------
const genId = (seed: string): mongoose.Types.ObjectId => {
  const hash = require('crypto').createHash('md5').update(seed).digest('hex');
  return new mongoose.Types.ObjectId(hash.substring(0, 24));
};

const upsert = async (db: mongoose.mongo.Db, collName: string, filter: any, doc: any) => {
  const { _id, ...updateDoc } = doc;
  const update: any = { $set: updateDoc };
  if (_id) update.$setOnInsert = { _id };

  return await db.collection(collName).findOneAndUpdate(
    filter,
    update,
    { upsert: true, returnDocument: 'after' }
  );
};

// --------------------------------------------------
// DEFINITIONS
// --------------------------------------------------

const metadata = [
  {
    slug: 'employees', name: 'Employees', module: 'Core', description: 'Central HR employee directory', fields: [
      { fieldName: 'employee_id', dataType: 'string', isPrimaryKey: true, isCustom: false, tags: ['identifier'] },
      { fieldName: 'first_name', dataType: 'string', isPrimaryKey: false, isCustom: false },
      { fieldName: 'last_name', dataType: 'string', isPrimaryKey: false, isCustom: false },
      { fieldName: 'email', dataType: 'string', isPrimaryKey: false, isCustom: false },
      { fieldName: 'phone', dataType: 'string', isPrimaryKey: false, isCustom: false },
      { fieldName: 'date_of_joining', dataType: 'date', isPrimaryKey: false, isCustom: false },
      { fieldName: 'employment_status', dataType: 'string', isPrimaryKey: false, isCustom: false },
      { fieldName: 'department', dataType: 'string', isPrimaryKey: false, isCustom: true, tags: ['org'] },
      { fieldName: 'designation', dataType: 'string', isPrimaryKey: false, isCustom: true },
      { fieldName: 'region', dataType: 'string', isPrimaryKey: false, isCustom: true },
      { fieldName: 'manager_id', dataType: 'string', isPrimaryKey: false, isForeignKey: true, isCustom: false },
      { fieldName: 'position_id', dataType: 'string', isPrimaryKey: false, isForeignKey: true, isCustom: false },
      { fieldName: 'salary', dataType: 'number', isPrimaryKey: false, isCustom: true }
    ]
  },
  {
    slug: 'positions', name: 'Positions', module: 'Core', description: 'Available roles inside the organization', fields: [
      { fieldName: 'position_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
      { fieldName: 'title', dataType: 'string', isCustom: false },
      { fieldName: 'department', dataType: 'string', isCustom: true },
      { fieldName: 'location', dataType: 'string', isCustom: true },
      { fieldName: 'employment_type', dataType: 'string', isCustom: false },
      { fieldName: 'level', dataType: 'string', isCustom: true },
      { fieldName: 'hiring_manager_id', dataType: 'string', isForeignKey: true, isCustom: false }
    ]
  },
  {
    slug: 'offers', name: 'Offers', module: 'Recruitment', description: 'Candidate offers and pipeline details', fields: [
      { fieldName: 'offer_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
      { fieldName: 'candidate_name', dataType: 'string', isCustom: false },
      { fieldName: 'email', dataType: 'string', isCustom: false },
      { fieldName: 'position_id', dataType: 'string', isForeignKey: true, isCustom: false },
      { fieldName: 'offered_salary', dataType: 'number', isCustom: true },
      { fieldName: 'status', dataType: 'string', isCustom: false },
      { fieldName: 'offer_date', dataType: 'date', isCustom: false },
      { fieldName: 'joining_date', dataType: 'date', isCustom: false }
    ]
  },
  {
    slug: 'leave', name: 'Leave', module: 'Time', description: 'PTO and sickness balances', fields: [
      { fieldName: 'leave_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
      { fieldName: 'employee_id', dataType: 'string', isForeignKey: true, isCustom: false },
      { fieldName: 'leave_type', dataType: 'string', isCustom: false },
      { fieldName: 'start_date', dataType: 'date', isCustom: false },
      { fieldName: 'end_date', dataType: 'date', isCustom: false },
      { fieldName: 'days', dataType: 'number', isCustom: false },
      { fieldName: 'status', dataType: 'string', isCustom: false },
      { fieldName: 'applied_on', dataType: 'date', isCustom: false }
    ]
  },
  {
    slug: 'attendance', name: 'Attendance', module: 'Time', description: 'Daily clock-in logs', fields: [
      { fieldName: 'attendance_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
      { fieldName: 'employee_id', dataType: 'string', isForeignKey: true, isCustom: false },
      { fieldName: 'date', dataType: 'date', isCustom: false },
      { fieldName: 'check_in', dataType: 'string', isCustom: false },
      { fieldName: 'check_out', dataType: 'string', isCustom: false },
      { fieldName: 'status', dataType: 'string', isCustom: false },
      { fieldName: 'work_mode', dataType: 'string', isCustom: true },
      { fieldName: 'hours_worked', dataType: 'number', isCustom: false }
    ]
  },
  {
    slug: 'payroll', name: 'Payroll', module: 'Payroll', description: 'Monthly payment compensations', fields: [
      { fieldName: 'payroll_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
      { fieldName: 'employee_id', dataType: 'string', isForeignKey: true, isCustom: false },
      { fieldName: 'pay_period', dataType: 'string', isCustom: false },
      { fieldName: 'basic_salary', dataType: 'number', isCustom: true },
      { fieldName: 'hra', dataType: 'number', isCustom: true },
      { fieldName: 'bonus', dataType: 'number', isCustom: true },
      { fieldName: 'deductions', dataType: 'number', isCustom: true },
      { fieldName: 'net_salary', dataType: 'number', isCustom: true },
      { fieldName: 'payment_status', dataType: 'string', isCustom: false }
    ]
  }
];

// --------------------------------------------------
// MAIN EXECUTION
// --------------------------------------------------
async function seed() {
  console.log('🌱 Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  console.log('✅ Connected.');

  // 1. Metadata Seed (Collections & Fields)
  console.log('📦 Seeding PRD standard Collections & Fields...');

  // Clean up stale metadata to ensure PK/FK flags are fresh
  await db.collection('fields').drop().catch(() => {});
  await db.collection('fieldmetadatas').drop().catch(() => {});  // legacy name cleanup
  await db.collection('collections').drop().catch(() => {});
  await db.collection('collectionmetadatas').drop().catch(() => {});  // legacy name cleanup
  await db.collection('relationships').drop().catch(() => {});
  await db.collection('metrics').drop().catch(() => {});

  for (const group of metadata) {
    const collId = genId(`COLL_${group.slug}`);
    await upsert(db, 'collections', { slug: group.slug }, {
      _id: collId,
      slug: group.slug,
      name: group.name,
      module: group.module,
      description: group.description,
      recordCount: 20,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    for (const f of group.fields) {
      const fieldId = genId(`FIELD_${group.slug}_${f.fieldName}`);
      const humanName = f.fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const entity = group.name.toLowerCase().replace(/s$/, '');

      // Resolve FK target IDs if applicable
      let targetCollectionId: mongoose.Types.ObjectId | undefined;
      let targetFieldId: mongoose.Types.ObjectId | undefined;
      let relationshipLabel: string | undefined;
      let relationshipType: string | undefined;

      if (f.isForeignKey) {
        // Resolve FK targets from the relationship definitions
        const relMatch = seedRelationships.find(
          r => r.sCol === group.slug && r.sField === f.fieldName
        );
        if (relMatch) {
          targetCollectionId = genId(`COLL_${relMatch.tCol}`);
          targetFieldId = genId(`FIELD_${relMatch.tCol}_${relMatch.tField}`);
          relationshipLabel = relMatch.label;
          relationshipType = relMatch.type;
        }
      }

      await upsert(db, 'fields', { collectionId: collId, fieldName: f.fieldName }, {
        _id: fieldId,
        collectionId: collId,
        fieldName: f.fieldName,
        displayName: humanName,
        dataType: f.dataType,
        isPrimaryKey: !!f.isPrimaryKey,
        isForeignKey: !!f.isForeignKey,
        isCustom: !!f.isCustom,
        ...(targetCollectionId ? { targetCollectionId } : {}),
        ...(targetFieldId ? { targetFieldId } : {}),
        ...(relationshipLabel ? { relationshipLabel } : {}),
        ...(relationshipType ? { relationshipType } : {}),
        aiDescription: `The ${f.dataType} value for ${humanName} within the ${entity} record mapping.`,
        manualDescription: f.isCustom ? `Custom verified description for ${humanName}.` : null,
        descriptionSource: f.isCustom ? 'manual' : 'ai',
        exampleValues: (f as any).exampleValues || [],
        tags: (f as any).tags || ['general']
      });
    }
  }

  // 2. HR Data Seed
  console.log('📄 Seeding Raw HR Data (20 Items each via idempotent upsert)...');
  const positions = Array.from({ length: 20 }, (_, i) => ({
    position_id: `POS-${String(i + 1).padStart(3, '0')}`,
    title: i === 0 ? 'CEO' : i < 5 ? 'Director' : 'Engineer',
    department: i < 5 ? 'Executive' : 'Engineering',
    location: i % 2 === 0 ? 'North' : 'South',
    employment_type: 'Full-time',
    level: `L${(i % 5) + 1}`,
    hiring_manager_id: i > 0 ? `EMP-001` : null
  }));
  for (const pos of positions) {
    await upsert(db, 'positions', { position_id: pos.position_id }, pos);
  }

  const employees = Array.from({ length: 20 }, (_, i) => ({
    employee_id: `EMP-${String(i + 1).padStart(3, '0')}`,
    first_name: `Emp${i + 1}`,
    last_name: 'Test',
    email: `emp${i + 1}@darwinbox.io`,
    phone: `+1-555-00${i}`,
    date_of_joining: new Date(2022, i % 12, 1),
    employment_status: 'active',
    department: positions[i].department,
    designation: positions[i].title,
    region: positions[i].location,
    manager_id: i > 0 ? `EMP-001` : null,
    position_id: positions[i].position_id,
    salary: 50000 + (i * 2000)
  }));
  for (const emp of employees) {
    await upsert(db, 'employees', { employee_id: emp.employee_id }, emp);
  }

  const offers = Array.from({ length: 20 }, (_, i) => ({
    offer_id: `OFF-${String(i + 1).padStart(3, '0')}`,
    candidate_name: `Candidate ${i}`,
    email: `cand${i}@test.com`,
    position_id: positions[i].position_id,
    offered_salary: 80000 + (1000 * i),
    status: 'accepted',
    offer_date: new Date(),
    joining_date: new Date()
  }));
  for (const offer of offers) {
    await upsert(db, 'offers', { offer_id: offer.offer_id }, offer);
  }

  const leave = Array.from({ length: 20 }, (_, i) => ({
    leave_id: `LV-${String(i + 1).padStart(3, '0')}`,
    employee_id: employees[i].employee_id,
    leave_type: 'Annual',
    start_date: new Date(),
    end_date: new Date(),
    days: 2,
    status: 'approved',
    applied_on: new Date()
  }));
  for (const l of leave) {
    await upsert(db, 'leave', { leave_id: l.leave_id }, l);
  }

  const attendance = Array.from({ length: 20 }, (_, i) => ({
    attendance_id: `ATT-${String(i + 1).padStart(3, '0')}`,
    employee_id: employees[i].employee_id,
    date: new Date(),
    check_in: '09:00',
    check_out: '17:00',
    status: 'present',
    work_mode: 'Office',
    hours_worked: 8
  }));
  for (const att of attendance) {
    await upsert(db, 'attendance', { attendance_id: att.attendance_id }, att);
  }

  const payroll = Array.from({ length: 20 }, (_, i) => ({
    payroll_id: `PAY-${String(i + 1).padStart(3, '0')}`,
    employee_id: employees[i].employee_id,
    pay_period: 'Oct-2023',
    basic_salary: 50000,
    hra: 20000,
    bonus: 5000,
    deductions: 5000,
    net_salary: 70000,
    payment_status: 'paid'
  }));
  for (const pay of payroll) {
    await upsert(db, 'payroll', { payroll_id: pay.payroll_id }, pay);
  }

  // 3. Relationships Seed — uses ObjectID bindings
  console.log('🔗 Seeding Relationships (ObjectIds matching MongoDB generic mappings)...');
  for (const r of seedRelationships) {
    const sCollId = genId(`COLL_${r.sCol}`);
    const tCollId = genId(`COLL_${r.tCol}`);
    const sFieldId = genId(`FIELD_${r.sCol}_${r.sField}`);
    const tFieldId = genId(`FIELD_${r.tCol}_${r.tField}`);

    await upsert(db, 'relationships', {
      sourceCollectionId: sCollId,
      sourceFieldId: sFieldId,
      targetCollectionId: tCollId,
      targetFieldId: tFieldId,
    }, {
      sourceCollectionId: sCollId,
      targetCollectionId: tCollId,
      sourceFieldId: sFieldId,
      targetFieldId: tFieldId,
      label: r.label,
      relationshipType: r.type,
      isAutoDetected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 4. Metrics Seed
  console.log('📊 Seeding Metrics strictly to PRD schema...');
  const mtx = [
    { name: 'Active Headcount', formula: 'COUNT(employees WHERE employment_status = "active")', category: 'Core', cols: ['employees'] },
    { name: 'Average Net Salary', formula: 'AVG(payroll.net_salary)', category: 'Payroll', cols: ['payroll'] },
    { name: 'Total Payroll Cost', formula: 'SUM(payroll.net_salary)', category: 'Payroll', cols: ['payroll'] },
    { name: 'Approved Leave Count', formula: 'COUNT(leave WHERE status = "approved")', category: 'Time', cols: ['leave'] },
    { name: 'Engineering Avg Salary', formula: 'AVG(payroll.net_salary WHERE employees.department = "Engineering")', category: 'Core', cols: ['payroll', 'employees'] }
  ];
  for (const m of mtx) {
    const collObjIds = m.cols.map(c => genId(`COLL_${c}`));
    await upsert(db, 'metrics', { name: m.name }, {
      _id: genId(`METRIC_${m.name.replace(/\s/g, '_')}`),
      name: m.name,
      formula: m.formula,
      description: `Description for ${m.name}`,
      category: m.category,
      collectionIds: collObjIds,
      lastComputedValue: m.name.includes('Count') ? 18 : 70000,
      lastComputedAt: new Date()
    });
  }

  // 5. Security & Access Control (PRD 11.7 Seed Permission Groups)
  console.log('🛡️ Seeding PRD 11.7 mandatory Permission Groups...');

  // Clean up stale groups/users to ensure seed permissions fully overwrite any UI changes
  await db.collection('groups').drop().catch(() => {});
  await db.collection('usergroups').drop().catch(() => {});
  await db.collection('users').drop().catch(() => {});

  const pwd = await bcrypt.hash('darwinbox123', 10);

  // Create Groups
  const hrPerms = metadata.map(m => ({
    collectionId: genId(`COLL_${m.slug}`),
    canRead: true,
    allowedFields: [],
    deniedFields: [],
    rowFilters: []
  }));

  await upsert(db, 'usergroups', { name: 'HR Admins' }, {
    _id: genId('G_HR'),
    name: 'HR Admins',
    description: 'Full data access across all HR modules',
    permissions: hrPerms,
    members: []
  });

  const payrollPerms = [
    {
      collectionId: genId('COLL_employees'),
      canRead: true,
      allowedFields: [],
      deniedFields: ['salary'],
      rowFilters: []
    },
    {
      collectionId: genId('COLL_payroll'),
      canRead: true,
      allowedFields: [],
      deniedFields: [],
      rowFilters: []
    }
  ];

  await upsert(db, 'usergroups', { name: 'Payroll Team' }, {
    _id: genId('G_PAY'),
    name: 'Payroll Team',
    description: 'Sensitive employee data masked, full payroll control',
    permissions: payrollPerms,
    members: []
  });

  const regionalPerms = [
    {
      collectionId: genId('COLL_employees'),
      canRead: true,
      allowedFields: [],
      deniedFields: ['salary', 'designation', 'manager_id'],
      rowFilters: [{ field: 'region', operator: 'eq', value: 'South' }]
    },
    {
      collectionId: genId('COLL_leave'),
      canRead: true,
      allowedFields: [],
      deniedFields: [],
      rowFilters: []
    }
  ];

  await upsert(db, 'usergroups', { name: 'Regional Viewer' }, {
    _id: genId('G_REGIONAL'),
    name: 'Regional Viewer',
    description: 'South Branch Context Only with mandatory masking',
    permissions: regionalPerms,
    members: []
  });

  // Create PRD-mandated Users
  const userSeeds = [
    { _id: genId('U_ADMIN'), email: 'admin@darwinbox.io', name: 'System Admin', role: 'platform_admin', status: 'active' },
    { _id: genId('U_HR'), email: 'hr@darwinbox.io', name: 'Lead Steward', role: 'data_steward', status: 'active', groups: ['G_HR'] },
    { _id: genId('U_PAYROLL'), email: 'analyst@darwinbox.io', name: 'Payroll Lead', role: 'analyst', status: 'active', groups: ['G_PAY'] },
    { _id: genId('U_SOUTH'), email: 'south@darwinbox.io', name: 'South Branch Viewer', role: 'viewer', status: 'active', groups: ['G_REGIONAL'] },
  ];

  for (const u of userSeeds) {
    const groupIdsForUser = ((u as any).groups || []).map((g: string) => genId(g));
    
    await upsert(db, 'users', { email: u.email }, {
      _id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      passwordHash: pwd,
      groupIds: groupIdsForUser,
      createdAt: new Date()
    });

    if ((u as any).groups) {
      for (const gKey of (u as any).groups) {
        await db.collection('usergroups').updateOne(
          { _id: genId(gKey) },
          { $addToSet: { members: u._id } }
        );
      }
    }
  }

  console.log('✅ Entire Idempotent Seed Complete against PRD v1.0 specifications');
  process.exit(0);
}

// Relationship definitions for seed (used both by field FK metadata and relationship records)
const seedRelationships = [
  { sCol: 'employees', tCol: 'positions', sField: 'position_id', tField: 'position_id', type: 'many-to-one', label: 'Employee holds Position' },
  { sCol: 'leave', tCol: 'employees', sField: 'employee_id', tField: 'employee_id', type: 'many-to-one', label: 'Leave for Employee' },
  { sCol: 'attendance', tCol: 'employees', sField: 'employee_id', tField: 'employee_id', type: 'many-to-one', label: 'Attendance for Employee' },
  { sCol: 'payroll', tCol: 'employees', sField: 'employee_id', tField: 'employee_id', type: 'many-to-one', label: 'Payroll for Employee' },
  { sCol: 'offers', tCol: 'positions', sField: 'position_id', tField: 'position_id', type: 'many-to-one', label: 'Offer for Position' },
  { sCol: 'employees', tCol: 'employees', sField: 'manager_id', tField: 'employee_id', type: 'many-to-one', label: 'Employee to Manager' },
  { sCol: 'positions', tCol: 'employees', sField: 'hiring_manager_id', tField: 'employee_id', type: 'many-to-one', label: 'Hiring Manager for Position' },
];

seed().catch(err => {
  console.error('Fatal Seed Error:', err);
  process.exit(1);
});
