import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../src/models/user.model';
import { Group } from '../src/models/group.model';
import { UserGroup } from '../src/models/userGroup.model';
import { CollectionMetadata } from '../src/models/collectionMetadata.model';
import { MetricDefinition } from '../src/models/metricDefinition.model';
import { Relationship } from '../src/models/relationship.model';
import { FieldMetadata } from '../src/models/fieldMetadata.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/darwinbox_ai';

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    
    // Drop all existing collections to ensure idempotency
    console.log('Dropping existing data securely...');
    if (!mongoose.connection.db) throw new Error("DB execution invalid natively");
    const collections = await mongoose.connection.db.collections();
    for (const coll of collections) {
      await coll.drop().catch(() => {});
    }

    console.log('Seeding Users...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);

    const users = await User.insertMany([
      { email: 'admin@darwinbox.io', passwordHash: hash, role: 'platform_admin', status: 'active' },
      { email: 'manager@darwinbox.io', passwordHash: hash, role: 'viewer', status: 'active' },
      { email: 'employee@darwinbox.io', passwordHash: hash, role: 'viewer', status: 'active' }
    ]);

    console.log('Seeding Groups & Permissions...');
    const groups = await Group.insertMany([
      { name: 'Global Administrators', description: 'Full access matrix', permissions: [] },
      { name: 'HR Managers', description: 'Access to Regional HR data securely', permissions: [
          { collectionName: 'employees', canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] },
          { collectionName: 'payroll', canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] }
      ]},
      { name: 'Standard Employees', description: 'Restricted field-level view', permissions: [
          { collectionName: 'employees', canRead: true, allowedFields: ['first_name', 'last_name', 'email', 'department'], deniedFields: ['salary'], rowFilters: [] }
      ]}
    ]);

    await UserGroup.insertMany([
      { userId: users[0]._id, groupId: groups[0]._id },
      { userId: users[1]._id, groupId: groups[1]._id },
      { userId: users[2]._id, groupId: groups[2]._id }
    ]);

    console.log('Seeding Collection Metadata...');
    const collectionsToSeed = [
      { name: 'employees', displayName: 'Employees', module: 'CORE', description: 'Core employee profile data including contact info, department, and salary.', fields: [
         { name: 'employee_id', type: 'string', isCustom: false },
         { name: 'first_name', type: 'string', isCustom: false },
         { name: 'last_name', type: 'string', isCustom: false },
         { name: 'email', type: 'string', isCustom: false },
         { name: 'department', type: 'string', isCustom: true, manualDescription: 'Mapped organizational domain explicitly' },
         { name: 'salary', type: 'number', isCustom: true }
      ]},
      { name: 'positions', displayName: 'Positions', module: 'CORE', description: 'Organizational charting structures and job families.', fields: [
         { name: 'position_id', type: 'string', isCustom: false },
         { name: 'title', type: 'string', isCustom: false }
      ]},
      { name: 'offers', displayName: 'Offers', module: 'RECRUITMENT', description: 'Accepted offer letters strictly.', fields: []},
      { name: 'leave', displayName: 'Leave', module: 'TIME', description: 'Time-off requests globally.', fields: [
         { name: 'leave_id', type: 'string', isCustom: false, isForeignKey: false },
         { name: 'employee_id', type: 'string', isCustom: false, isForeignKey: true },
         { name: 'days', type: 'number', isCustom: false, isForeignKey: false }
      ]},
      { name: 'attendance', displayName: 'Attendance', module: 'TIME', description: 'Clock-in logs safely.', fields: [
         { name: 'employee_id', type: 'string', isCustom: false, isForeignKey: true },
         { name: 'date', type: 'string', isCustom: false, isForeignKey: false },
         { name: 'hours', type: 'number', isCustom: false, isForeignKey: false }
      ]},
      { name: 'payroll', displayName: 'Payroll', module: 'PAYROLL', description: 'Compensation ledgers strictly.', fields: [
         { name: 'pay_id', type: 'string', isCustom: false, isForeignKey: false },
         { name: 'employee_id', type: 'string', isCustom: false, isForeignKey: true },
         { name: 'amount', type: 'number', isCustom: false, isForeignKey: false }
      ]}
    ];

    for (const c of collectionsToSeed) {
       const coll = await CollectionMetadata.create({ name: c.name, displayName: c.displayName, module: c.module, description: c.description });
       if (c.fields.length > 0) {
         const fieldDocs = c.fields.map(f => ({
            collectionId: coll._id,
            name: f.name,
            displayName: f.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: f.type,
            isCustom: f.isCustom,
            isForeignKey: (f as any).isForeignKey || false,
            aiDescription: `Extracted ${f.name} attribute natively`,
            manualDescription: (f as any).manualDescription || undefined,
            tags: f.isCustom ? ['Custom'] : ['Standard']
         }));
         await FieldMetadata.insertMany(fieldDocs);
       }
    }

    console.log('Seeding HR Data properly...');
    if (!mongoose.connection.db) throw new Error("DB execution invalid natively");
    const db = mongoose.connection.db;
    
    // Seed 20 mocked records for Employees
    const employeeData = Array.from({ length: 20 }).map((_, i) => ({
       employee_id: `EMP-${i+100}`, first_name: `User${i}`, last_name: `TestName${i}`, email: `user${i}@darwinbox.io`, department: i % 2 === 0 ? 'Engineering' : 'Sales', salary: 60000 + (i * 1500)
    }));
    await db.collection('employees').insertMany(employeeData);

    // Seed 20 mocked records for Positions
    const positionsData = Array.from({ length: 20 }).map((_, i) => ({
       position_id: `POS-${i+100}`, title: `Engineer L${(i%5)+1}`
    }));
    await db.collection('positions').insertMany(positionsData);

    // Offers
    const offersData = Array.from({ length: 20 }).map((_, i) => ({
       offer_id: `OFF-${i+100}`, status: 'Accepted'
    }));
    await db.collection('offers').insertMany(offersData);

    // Leave
    const leaveData = Array.from({ length: 20 }).map((_, i) => ({
       leave_id: `LV-${i+100}`, employee_id: `EMP-${i+100}`, days: (i%3)+1 
    }));
    await db.collection('leave').insertMany(leaveData);

    // Attendance
    const attendanceData = Array.from({ length: 20 }).map((_, i) => ({
       log_id: `ATT-${i+100}`, employee_id: `EMP-${i+100}`, date: new Date().toISOString(), hours: 8
    }));
    await db.collection('attendance').insertMany(attendanceData);

    // Payroll
    const payrollData = Array.from({ length: 20 }).map((_, i) => ({
       pay_id: `PAY-${i+100}`, employee_id: `EMP-${i+100}`, amount: 5000 + (i*100)
    }));
    await db.collection('payroll').insertMany(payrollData);

    console.log('Seeding completed elegantly and robustly. Platform ready natively.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
