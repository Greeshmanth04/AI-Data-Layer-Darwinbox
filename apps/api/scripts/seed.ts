import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../src/models/user.model';
import { Group } from '../src/models/group.model';
import { UserGroup } from '../src/models/userGroup.model';
import { CollectionMetadata } from '../src/models/collectionMetadata.model';
import { MetricDefinition } from '../src/models/metricDefinition.model';
import { Relationship } from '../src/models/relationship.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/darwinbox_ai';

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    
    // Drop all existing collections to ensure idempotency
    console.log('Dropping existing data securely...');
    const collections = await mongoose.connection.db.collections();
    for (const coll of collections) {
      await coll.drop().catch(() => {});
    }

    console.log('Seeding Users...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);

    const users = await User.insertMany([
      { email: 'admin@darwinbox.io', passwordHash: hash, role: 'platform_admin' },
      { email: 'manager@darwinbox.io', passwordHash: hash, role: 'viewer' },
      { email: 'employee@darwinbox.io', passwordHash: hash, role: 'viewer' }
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
    await CollectionMetadata.insertMany([
      { name: 'employees', displayName: 'Employees', module: 'CORE', description: 'Core employee profile data including contact info, department, and salary.', fields: [
         { name: 'employee_id', type: 'string', description: 'Unique identifier' },
         { name: 'first_name', type: 'string', description: 'Legal first name' },
         { name: 'last_name', type: 'string', description: 'Legal last name' },
         { name: 'email', type: 'string', description: 'Corporate email' },
         { name: 'department', type: 'string', description: 'Assigned cost center' },
         { name: 'salary', type: 'number', description: 'Annual compensation' }
      ]},
      { name: 'positions', displayName: 'Positions', module: 'CORE', description: 'Organizational charting structures and job families.', fields: [
         { name: 'position_id', type: 'string', description: 'Unique ID' },
         { name: 'title', type: 'string', description: 'Job Title' }
      ]},
      { name: 'offers', displayName: 'Offers', module: 'RECRUITMENT', description: 'Accepted offer letters strictly.', fields: []},
      { name: 'leave', displayName: 'Leave', module: 'TIME', description: 'Time-off requests globally.', fields: []},
      { name: 'attendance', displayName: 'Attendance', module: 'TIME', description: 'Clock-in logs safely.', fields: [
         { name: 'employee_id', type: 'string', description: 'Linked employee natively' },
         { name: 'date', type: 'string', description: 'Log date' },
         { name: 'hours', type: 'number', description: 'Duration recorded' }
      ]},
      { name: 'payroll', displayName: 'Payroll', module: 'PAYROLL', description: 'Compensation ledgers strictly.', fields: []}
    ]);

    console.log('Seeding HR Data properly...');
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
