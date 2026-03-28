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
  return await db.collection(collName).findOneAndUpdate(
    filter, 
    { $set: doc }, 
    { upsert: true, returnDocument: 'after' }
  );
};

// --------------------------------------------------
// DEFINITIONS
// --------------------------------------------------

const metadata = [
  { slug: 'employees', name: 'Employees', module: 'Core', description: 'Central HR employee directory', fields: [
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
    { fieldName: 'position_id', dataType: 'string', isPrimaryKey: false, isForeignKey: true, isCustom: false }
  ]},
  { slug: 'positions', name: 'Positions', module: 'Core', description: 'Available roles inside the organization', fields: [
    { fieldName: 'position_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
    { fieldName: 'title', dataType: 'string', isCustom: false },
    { fieldName: 'department', dataType: 'string', isCustom: true },
    { fieldName: 'location', dataType: 'string', isCustom: true },
    { fieldName: 'employment_type', dataType: 'string', isCustom: false },
    { fieldName: 'level', dataType: 'string', isCustom: true },
    { fieldName: 'hiring_manager_id', dataType: 'string', isForeignKey: true, isCustom: false }
  ]},
  { slug: 'offers', name: 'Offers', module: 'Recruitment', description: 'Candidate offers and pipeline details', fields: [
    { fieldName: 'offer_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
    { fieldName: 'candidate_name', dataType: 'string', isCustom: false },
    { fieldName: 'email', dataType: 'string', isCustom: false },
    { fieldName: 'position_id', dataType: 'string', isForeignKey: true, isCustom: false },
    { fieldName: 'offered_salary', dataType: 'number', isCustom: true },
    { fieldName: 'status', dataType: 'string', isCustom: false },
    { fieldName: 'offer_date', dataType: 'date', isCustom: false },
    { fieldName: 'joining_date', dataType: 'date', isCustom: false }
  ]},
  { slug: 'leave', name: 'Leave', module: 'Time', description: 'PTO and sickness balances', fields: [
    { fieldName: 'leave_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
    { fieldName: 'employee_id', dataType: 'string', isForeignKey: true, isCustom: false },
    { fieldName: 'leave_type', dataType: 'string', isCustom: false },
    { fieldName: 'start_date', dataType: 'date', isCustom: false },
    { fieldName: 'end_date', dataType: 'date', isCustom: false },
    { fieldName: 'days', dataType: 'number', isCustom: false },
    { fieldName: 'status', dataType: 'string', isCustom: false },
    { fieldName: 'applied_on', dataType: 'date', isCustom: false }
  ]},
  { slug: 'attendance', name: 'Attendance', module: 'Time', description: 'Daily clock-in logs', fields: [
    { fieldName: 'attendance_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
    { fieldName: 'employee_id', dataType: 'string', isForeignKey: true, isCustom: false },
    { fieldName: 'date', dataType: 'date', isCustom: false },
    { fieldName: 'check_in', dataType: 'string', isCustom: false },
    { fieldName: 'check_out', dataType: 'string', isCustom: false },
    { fieldName: 'status', dataType: 'string', isCustom: false },
    { fieldName: 'work_mode', dataType: 'string', isCustom: true },
    { fieldName: 'hours_worked', dataType: 'number', isCustom: false }
  ]},
  { slug: 'payroll', name: 'Payroll', module: 'Payroll', description: 'Monthly payment compensations', fields: [
    { fieldName: 'payroll_id', dataType: 'string', isPrimaryKey: true, isCustom: false },
    { fieldName: 'employee_id', dataType: 'string', isForeignKey: true, isCustom: false },
    { fieldName: 'pay_period', dataType: 'string', isCustom: false },
    { fieldName: 'basic_salary', dataType: 'number', isCustom: true },
    { fieldName: 'hra', dataType: 'number', isCustom: true },
    { fieldName: 'bonus', dataType: 'number', isCustom: true },
    { fieldName: 'deductions', dataType: 'number', isCustom: true },
    { fieldName: 'net_salary', dataType: 'number', isCustom: true },
    { fieldName: 'payment_status', dataType: 'string', isCustom: false }
  ]}
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
      await upsert(db, 'fields', { collectionId: collId, fieldName: f.fieldName }, { 
        _id: fieldId,
        collectionId: collId, 
        fieldName: f.fieldName, 
        displayName: f.fieldName.replace(/_/g, ' '), 
        dataType: f.dataType, 
        isPrimaryKey: !!f.isPrimaryKey, 
        isForeignKey: !!f.isForeignKey, 
        isCustom: !!f.isCustom,
        aiDescription: `Semantic auto-description mapping ${f.fieldName}`,
        manualDescription: f.isCustom ? `Admin-added description for ${f.fieldName}` : null,
        exampleValues: ['Sample_1', 'Sample_2'],
        tags: f.tags || ['general']
      });
    }
  }

  // 2. HR Data Seed
  console.log('📄 Seeding Raw HR Data (20 Items each)...');
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
    position_id: positions[i].position_id
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

  // 3. Relationships Seed (Idempotent schema per PRD)
  console.log('🔗 Seeding Relationships strictly to schema...');
  const rels = [
    { sCol: 'employees', tCol: 'positions', sField: 'position_id', tField: 'position_id', type: 'many-to-one', label: 'Employee holds Position' },
    { sCol: 'leave', tCol: 'employees', sField: 'employee_id', tField: 'employee_id', type: 'many-to-one', label: 'Leave for Employee' },
    { sCol: 'attendance', tCol: 'employees', sField: 'employee_id', tField: 'employee_id', type: 'many-to-one', label: 'Attendance for Employee' },
    { sCol: 'payroll', tCol: 'employees', sField: 'employee_id', tField: 'employee_id', type: 'many-to-one', label: 'Payroll for Employee' },
    { sCol: 'offers', tCol: 'positions', sField: 'position_id', tField: 'position_id', type: 'many-to-one', label: 'Offer for Position' },
    { sCol: 'employees', tCol: 'employees', sField: 'manager_id', tField: 'employee_id', type: 'many-to-one', label: 'Employee to Manager' }
  ];
  for (const r of rels) {
    const rId = genId(`REL_${r.sCol}_${r.tCol}_${r.sField}`);
    const srcCollId = genId(`COLL_${r.sCol}`);
    const tgtCollId = genId(`COLL_${r.tCol}`);
    const srcFid = genId(`FIELD_${r.sCol}_${r.sField}`);
    const tgtFid = genId(`FIELD_${r.tCol}_${r.tField}`);
    await upsert(db, 'relationships', { _id: rId }, {
      _id: rId,
      sourceCollectionId: srcCollId,
      sourceFieldId: srcFid,
      targetCollectionId: tgtCollId,
      targetFieldId: tgtFid,
      label: r.label,
      relationshipType: r.type,
      isAutoDetected: true
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
      _id: genId(`METRIC_${m.name.replace(/\s/g,'_')}`),
      name: m.name,
      formula: m.formula,
      description: `Description for ${m.name}`,
      category: m.category,
      collectionIds: collObjIds,
      lastComputedValue: m.name.includes('Count') ? 18 : 70000,
      lastComputedAt: new Date()
    });
  }

  // 5. Users and userGroups Seed
  console.log('🛡️ Seeding Users & _userGroups_ strictly to PRD schema...');
  const pwd = await bcrypt.hash('darwinbox123', 10);
  
  // Create Groups
  const hrPerms = [
    { collectionId: genId('COLL_employees'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] },
    { collectionId: genId('COLL_payroll'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] },
    { collectionId: genId('COLL_positions'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] },
    { collectionId: genId('COLL_leave'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] },
    { collectionId: genId('COLL_attendance'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] },
    { collectionId: genId('COLL_offers'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] }
  ];
  const hrGroupRes = await upsert(db, 'userGroups', { name: 'HR Admins' }, {
    _id: genId('G_HR'), name: 'HR Admins', description: 'Access all Core Data', members: [genId('U_hr')], permissions: hrPerms
  });

  const payPerms = [
    { collectionId: genId('COLL_employees'), canRead: true, allowedFields: [], deniedFields: ['salary'], rowFilters: [] },
    { collectionId: genId('COLL_payroll'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] }
  ];
  const payGroupRes = await upsert(db, 'userGroups', { name: 'Payroll Team' }, {
    _id: genId('G_Pay'), name: 'Payroll Team', description: 'Hide Employee Salary, Full Payroll', members: [genId('U_payroll')], permissions: payPerms
  });

  const regPerms = [
    { collectionId: genId('COLL_employees'), canRead: true, allowedFields: [], deniedFields: ['salary', 'designation', 'manager_id'], rowFilters: [{ field: 'region', operator: 'eq', value: 'South' }] },
    { collectionId: genId('COLL_leave'), canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] }
  ];
  const regGroupRes = await upsert(db, 'userGroups', { name: 'Regional Viewer' }, {
    _id: genId('G_Reg'), name: 'Regional Viewer', description: 'South Branch Context Only', members: [genId('U_south')], permissions: regPerms
  });

  // Create Users
  await upsert(db, 'users', { email: 'admin@darwinbox.io' }, {
    _id: genId('U_admin'), email: 'admin@darwinbox.io', name: 'Platform Admin', role: 'platform_admin', groupIds: [], passwordHash: pwd, createdAt: new Date()
  });
  await upsert(db, 'users', { email: 'hr@darwinbox.io' }, {
    _id: genId('U_hr'), email: 'hr@darwinbox.io', name: 'HR Data Steward', role: 'data_steward', groupIds: [hrGroupRes.value?._id || genId('G_HR')], passwordHash: pwd, createdAt: new Date()
  });
  await upsert(db, 'users', { email: 'analyst@darwinbox.io' }, {
    _id: genId('U_payroll'), email: 'analyst@darwinbox.io', name: 'Payroll Analyst', role: 'analyst', groupIds: [payGroupRes.value?._id || genId('G_Pay')], passwordHash: pwd, createdAt: new Date()
  });
  await upsert(db, 'users', { email: 'south@darwinbox.io' }, {
    _id: genId('U_south'), email: 'south@darwinbox.io', name: 'South Viewer', role: 'viewer', groupIds: [regGroupRes.value?._id || genId('G_Reg')], passwordHash: pwd, createdAt: new Date()
  });

  console.log('✅ Entire Idempotent Seed Complete against native MongoDB collections!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Fatal Seed Error:', err);
  process.exit(1);
});
