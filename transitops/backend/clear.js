require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const Trip = require('./models/Trip');
const FuelLog = require('./models/FuelLog');
const Expense = require('./models/Expense');
const Maintenance = require('./models/Maintenance');
const Settlement = require('./models/Settlement');
const DriverLog = require('./models/DriverLog');
const DriverDocument = require('./models/DriverDocument');
const Incident = require('./models/Incident');
const Notification = require('./models/Notification');
const LocationTelemetry = require('./models/LocationTelemetry');
const AuditLog = require('./models/AuditLog');
const Event = require('./models/Event');
const User = require('./models/User');

const DEFAULT_STAFF = [
  {
    email: 'manager@transitops.com',
    name: 'Fleet Manager',
    role: 'fleet_manager',
    phone: '9999999991'
  },
  {
    email: 'dispatcher@transitops.com',
    name: 'Dispatcher Dave',
    role: 'dispatcher',
    phone: '9999999992'
  },
  {
    email: 'safety@transitops.com',
    name: 'Safety Sara',
    role: 'safety_officer',
    phone: '9999999993'
  },
  {
    email: 'analyst@transitops.com',
    name: 'Finance Frank',
    role: 'financial_analyst',
    phone: '9999999994'
  },
  {
    email: 'nivpatel0207@gmail.com',
    name: 'Niv Patel',
    role: 'fleet_manager',
    phone: '7600964611',
    password: 'niv.7600964611'
  }
];

const DEFAULT_STAFF_EMAILS = DEFAULT_STAFF.map(u => u.email.toLowerCase());

const clearDb = async () => {
  try {
    const isWipeAllUsers = process.argv.includes('--all') || process.argv.includes('--everything');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('🌱 Connected to MongoDB to clear data...');

    // 1. Wipe all standard operational collections via Mongoose models
    await Promise.all([
      Vehicle.deleteMany({}),
      Driver.deleteMany({}),
      Trip.deleteMany({}),
      FuelLog.deleteMany({}),
      Expense.deleteMany({}),
      Maintenance.deleteMany({}),
      Settlement.deleteMany({}),
      DriverLog.deleteMany({}),
      DriverDocument.deleteMany({}),
      Incident.deleteMany({}),
      Notification.deleteMany({}),
      LocationTelemetry.deleteMany({}),
      AuditLog.deleteMany({}),
      Event.deleteMany({})
    ]);

    // 2. Dynamic check: Wipe all raw collections in MongoDB except 'users' (and system collections)
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      if (col.name !== 'users' && !col.name.startsWith('system.')) {
        await mongoose.connection.db.collection(col.name).deleteMany({});
      }
    }

    // 3. User Accounts Wipe & Reset
    if (isWipeAllUsers) {
      // Complete wipe of all users
      await User.collection.deleteMany({});
      console.log('👥 Wiped 100% of all user accounts (--all mode active)');
    } else {
      // A) Delete all users who are NOT the 4 standard staff members (all drivers, all custom team members, test users)
      const deleteResult = await User.collection.deleteMany({
        email: { $nin: DEFAULT_STAFF_EMAILS }
      });
      console.log(`🗑️  Deleted ${deleteResult.deletedCount} non-default / inserted user accounts (drivers, team members)`);

      // B) Reset the 4 default staff accounts to clean factory state
      const salt = await bcrypt.genSalt(12);
      const defaultPasswordHash = await bcrypt.hash('password123', salt);

      for (const staff of DEFAULT_STAFF) {
        const existing = await User.findOne({ email: staff.email.toLowerCase() });

        if (existing) {
          // Reset attributes and remove any inserted fields (like salary, profilePhoto, custom name, etc.)
          await User.collection.updateOne(
            { _id: existing._id },
            {
              $set: {
                name: staff.name,
                email: staff.email.toLowerCase(),
                role: staff.role,
                phone: staff.phone,
                passwordHash: defaultPasswordHash,
                status: 'Active',
                theme: 'system',
                accentColor: 'orange',
                density: 'comfortable',
                fontSize: 'medium',
                animations: true,
                sidebarState: 'expanded',
                deleted: false,
                deletedAt: null,
                deletedBy: null
              },
              $unset: {
                salary: "",
                profilePhoto: "",
                employeeId: "",
                department: "",
                location: "",
                emergencyContact: "",
                address: "",
                dateOfBirth: "",
                joiningDate: "",
                lastLogin: "",
                driverProfileId: ""
              }
            }
          );
        } else {
          // If the default user was missing, create fresh
          await User.collection.insertOne({
            name: staff.name,
            email: staff.email.toLowerCase(),
            role: staff.role,
            phone: staff.phone,
            passwordHash: defaultPasswordHash,
            status: 'Active',
            theme: 'system',
            accentColor: 'orange',
            density: 'comfortable',
            fontSize: 'medium',
            animations: true,
            sidebarState: 'expanded',
            deleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    // 4. Try to flush the in-memory cache of the running server if active
    try {
      const axios = require('axios');
      const port = process.env.PORT || 5000;
      await axios.post(`http://localhost:${port}/api/v1/cache/flush`, {}, { timeout: 1000 });
      console.log('⚡ Server in-memory cache flushed successfully');
    } catch (e) {
      // Server not running or endpoint not yet loaded, which is fine
    }

    console.log('🗑️  Successfully cleared and wiped all inserted data:');
    console.log('   ✓ Payroll & Salary Settlements (Wiped 100%)');
    console.log('   ✓ Trips, Vehicles, Drivers, and Driver Accounts (Wiped 100%)');
    console.log('   ✓ Fuel Logs, Expenses, Maintenance, and ELD Logs (Wiped 100%)');
    console.log('   ✓ Telemetry, Notifications, Incidents, and Audit Logs (Wiped 100%)');
    console.log('   ✓ All added team members and non-default users (Wiped 100%)');
    console.log('   ✓ All inserted salaries, profile edits & temporary data on staff accounts (Reset to factory baseline)');
    console.log('👤 Clean baseline logins available:');
    console.log('   - Fleet Manager   : manager@transitops.com   / password123 (Salary: Unset / ₹0)');
    console.log('   - Dispatcher      : dispatcher@transitops.com / password123 (Salary: Unset / ₹0)');
    console.log('   - Safety Officer  : safety@transitops.com    / password123 (Salary: Unset / ₹0)');
    console.log('   - Finance Frank   : analyst@transitops.com   / password123 (Salary: Unset / ₹0)');

    process.exit(0);
  } catch (err) {
    console.error('❌ Clear failed:', err);
    process.exit(1);
  }
};

clearDb();
