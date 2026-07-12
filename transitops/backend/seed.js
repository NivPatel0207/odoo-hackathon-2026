require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const Trip = require('./models/Trip');
const FuelLog = require('./models/FuelLog');
const Expense = require('./models/Expense');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🌱 Connected to MongoDB for seeding...');

    // Clear all existing data
    await Promise.all([
      User.deleteMany({}),
      Vehicle.deleteMany({}),
      Driver.deleteMany({}),
      Trip.deleteMany({}),
      FuelLog.deleteMany({}),
      Expense.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing data');

    // Create Users
    const users = await User.create([
      { name: 'Fleet Manager', email: 'manager@transitops.com', passwordHash: 'password123', role: 'fleet_manager' },
      { name: 'Dispatcher Dave', email: 'dispatcher@transitops.com', passwordHash: 'password123', role: 'dispatcher' },
      { name: 'Safety Sara', email: 'safety@transitops.com', passwordHash: 'password123', role: 'safety_officer' },
      { name: 'Finance Frank', email: 'analyst@transitops.com', passwordHash: 'password123', role: 'financial_analyst' }
    ]);
    console.log('👤 Created 4 users');

    // Create Vehicles
    const vehicles = await Vehicle.create([
      { name: 'Van-01', registrationNumber: 'GJ01AB1234', vehicleType: 'van', maxLoadCapacity: 800, odometer: 15000, acquisitionCost: 850000, region: 'North', status: 'available' },
      { name: 'Truck-02', registrationNumber: 'GJ01CD5678', vehicleType: 'truck', maxLoadCapacity: 5000, odometer: 42000, acquisitionCost: 2500000, region: 'South', status: 'available' },
      { name: 'Van-03', registrationNumber: 'GJ02EF9012', vehicleType: 'van', maxLoadCapacity: 600, odometer: 8000, acquisitionCost: 750000, region: 'East', status: 'available' },
      { name: 'Pickup-04', registrationNumber: 'GJ03GH3456', vehicleType: 'pickup', maxLoadCapacity: 1200, odometer: 22000, acquisitionCost: 1200000, region: 'West', status: 'available' },
      { name: 'Tanker-05', registrationNumber: 'GJ04IJ7890', vehicleType: 'tanker', maxLoadCapacity: 8000, odometer: 67000, acquisitionCost: 4500000, region: 'Central', status: 'available' }
    ]);
    console.log('🚛 Created 5 vehicles');

    // Create Drivers
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 1);

    const drivers = await Driver.create([
      { name: 'Ravi Kumar', licenseNumber: 'GJ0120230001', licenseCategory: 'C', licenseExpiryDate: futureDate, contactNumber: '9876543210', safetyScore: 95, status: 'available' },
      { name: 'Suresh Patel', licenseNumber: 'GJ0120220002', licenseCategory: 'D', licenseExpiryDate: futureDate, contactNumber: '9876543211', safetyScore: 88, status: 'available' },
      { name: 'Amit Shah', licenseNumber: 'GJ0220200003', licenseCategory: 'B', licenseExpiryDate: futureDate, contactNumber: '9876543212', safetyScore: 72, status: 'available' },
      { name: 'Dinesh Rao', licenseNumber: 'GJ0320190004', licenseCategory: 'C', licenseExpiryDate: futureDate, contactNumber: '9876543213', safetyScore: 60, status: 'available' },
      { name: 'Expired Driver', licenseNumber: 'GJ0420180005', licenseCategory: 'B', licenseExpiryDate: expiredDate, contactNumber: '9876543214', safetyScore: 50, status: 'available' }
    ]);
    console.log('👨‍✈️ Created 5 drivers (1 with expired license for testing)');

    // Create sample completed trips sequentially to avoid tripCode collision
    const completedTrips = [];
    const tripData = [
      {
        source: 'Ahmedabad', destination: 'Surat',
        vehicle: vehicles[0]._id, driver: drivers[0]._id,
        cargoWeight: 450, plannedDistance: 265, actualDistance: 268, fuelConsumed: 35, revenue: 15000,
        status: 'completed', completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        source: 'Surat', destination: 'Mumbai',
        vehicle: vehicles[1]._id, driver: drivers[1]._id,
        cargoWeight: 3200, plannedDistance: 290, actualDistance: 295, fuelConsumed: 110, revenue: 48000,
        status: 'completed', completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        source: 'Ahmedabad', destination: 'Vadodara',
        vehicle: vehicles[2]._id, driver: drivers[2]._id,
        cargoWeight: 300, plannedDistance: 110, actualDistance: 112, fuelConsumed: 15, revenue: 8000,
        status: 'completed', completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ];

    for (const data of tripData) {
      completedTrips.push(await Trip.create(data));
    }
    console.log('🚗 Created 3 completed trips');

    // Create a draft trip
    await Trip.create({
      source: 'Rajkot', destination: 'Bhavnagar',
      vehicle: vehicles[3]._id, driver: drivers[3]._id,
      cargoWeight: 800, plannedDistance: 180,
      status: 'draft'
    });
    console.log('📋 Created 1 draft trip');

    // Create fuel logs
    await FuelLog.create([
      { vehicle: vehicles[0]._id, trip: completedTrips[0]._id, date: completedTrips[0].completedAt, liters: 35, cost: 3325 },
      { vehicle: vehicles[1]._id, trip: completedTrips[1]._id, date: completedTrips[1].completedAt, liters: 110, cost: 10450 },
      { vehicle: vehicles[2]._id, trip: completedTrips[2]._id, date: completedTrips[2].completedAt, liters: 15, cost: 1425 }
    ]);
    console.log('⛽ Created fuel logs');

    // Create expenses
    await Expense.create([
      { vehicle: vehicles[0]._id, expenseType: 'toll', amount: 450, date: new Date(), description: 'Ahmedabad-Surat expressway tolls' },
      { vehicle: vehicles[1]._id, expenseType: 'toll', amount: 680, date: new Date(), description: 'Surat-Mumbai highway tolls' },
      { vehicle: vehicles[4]._id, expenseType: 'insurance', amount: 28000, date: new Date(), description: 'Annual insurance premium' }
    ]);
    console.log('💰 Created expenses');

    console.log('\n✅ Seeding complete! Login credentials:');
    console.log('   Fleet Manager  : manager@transitops.com   / password123');
    console.log('   Dispatcher     : dispatcher@transitops.com / password123');
    console.log('   Safety Officer : safety@transitops.com    / password123');
    console.log('   Financial Analyst: analyst@transitops.com / password123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
