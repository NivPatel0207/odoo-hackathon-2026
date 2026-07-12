require('dotenv').config();
const mongoose = require('mongoose');
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const Trip = require('./models/Trip');
const FuelLog = require('./models/FuelLog');
const Expense = require('./models/Expense');
const Maintenance = require('./models/Maintenance');

const clearDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🌱 Connected to MongoDB to clear data...');

    // Clear all existing data EXCEPT Users
    await Promise.all([
      Vehicle.deleteMany({}),
      Driver.deleteMany({}),
      Trip.deleteMany({}),
      FuelLog.deleteMany({}),
      Expense.deleteMany({}),
      Maintenance.deleteMany({})
    ]);
    
    console.log('🗑️  Successfully cleared all Vehicles, Drivers, Trips, FuelLogs, Expenses, and Maintenance logs!');
    console.log('👤 (User accounts were kept so you can still log in)');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Clear failed:', err);
    process.exit(1);
  }
};

clearDb();
