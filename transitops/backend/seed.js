require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('./models/User');
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

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🌱 Connected to MongoDB for real-life fleet simulation seeding...');

    // 1. Wipe all existing collections cleanly
    await Promise.all([
      User.deleteMany({}),
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

    // Also wipe raw collections to ensure no orphan documents
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      if (!col.name.startsWith('system.')) {
        await mongoose.connection.db.collection(col.name).deleteMany({});
      }
    }
    console.log('🗑️  Clean slate prepared across all 15 MongoDB collections');

    // 2. Seed Team & Staff Users
    const users = await User.create([
      {
        name: 'Fleet Manager',
        email: 'manager@transitops.com',
        passwordHash: 'password123',
        role: 'fleet_manager',
        phone: '9999999991',
        salary: 85000,
        department: 'Fleet Operations',
        employeeId: 'EMP-FM-01',
        location: 'Ahmedabad HQ',
        joiningDate: '2023-01-15',
        status: 'Active'
      },
      {
        name: 'Dispatcher Dave',
        email: 'dispatcher@transitops.com',
        passwordHash: 'password123',
        role: 'dispatcher',
        phone: '9999999992',
        salary: 46000,
        department: 'Dispatch & Routing',
        employeeId: 'EMP-DP-02',
        location: 'Surat Hub',
        joiningDate: '2023-04-10',
        status: 'Active'
      },
      {
        name: 'Safety Sara',
        email: 'safety@transitops.com',
        passwordHash: 'password123',
        role: 'safety_officer',
        phone: '9999999993',
        salary: 48000,
        department: 'Safety & Compliance',
        employeeId: 'EMP-SO-03',
        location: 'Vadodara Office',
        joiningDate: '2023-06-01',
        status: 'Active'
      },
      {
        name: 'Finance Frank',
        email: 'analyst@transitops.com',
        passwordHash: 'password123',
        role: 'financial_analyst',
        phone: '9999999994',
        salary: 54000,
        department: 'Corporate Finance',
        employeeId: 'EMP-FA-04',
        location: 'Mumbai Regional Office',
        joiningDate: '2023-02-20',
        status: 'Active'
      },
      {
        name: 'Niv Patel',
        email: 'nivpatel0207@gmail.com',
        passwordHash: 'niv.7600964611',
        role: 'fleet_manager',
        phone: '7600964611',
        salary: 95000,
        department: 'Executive Operations',
        employeeId: 'EMP-DIR-00',
        location: 'Global Operations HQ',
        joiningDate: '2022-10-01',
        status: 'Active'
      },
      {
        name: 'Vikas Auditor',
        email: 'viewer@transitops.com',
        passwordHash: 'password123',
        role: 'viewer',
        phone: '9999999995',
        salary: 38000,
        department: 'Internal Quality Audit',
        employeeId: 'EMP-QA-05',
        location: 'Ahmedabad HQ',
        joiningDate: '2024-01-15',
        status: 'Active'
      }
    ]);
    console.log(`👤 Created ${users.length} professional staff and team accounts`);

    // 3. Seed Realistic Commercial Vehicles
    const vehicles = await Vehicle.create([
      {
        name: 'Tata Ace Gold EV-01',
        registrationNumber: 'GJ01EV1001',
        vehicleType: 'van',
        fuelType: 'electric',
        maxLoadCapacity: 1000,
        odometer: 12450,
        acquisitionCost: 950000,
        maintenanceInterval: 10000,
        nextMaintenanceMileage: 20000,
        region: 'North',
        status: 'available',
        notes: 'Last-mile city zero-emission delivery van'
      },
      {
        name: 'Eicher Pro 2049 Light Hauler',
        registrationNumber: 'GJ01AB2345',
        vehicleType: 'truck',
        fuelType: 'diesel',
        maxLoadCapacity: 2800,
        odometer: 34200,
        acquisitionCost: 1480000,
        maintenanceInterval: 12000,
        nextMaintenanceMileage: 36000,
        region: 'Central',
        status: 'on_trip',
        notes: 'Equipped with live GPS & telematics OBD'
      },
      {
        name: 'BharatBenz 1617 Medium Hauler',
        registrationNumber: 'GJ01CD6789',
        vehicleType: 'truck',
        fuelType: 'diesel',
        maxLoadCapacity: 8500,
        odometer: 82100,
        acquisitionCost: 2850000,
        maintenanceInterval: 15000,
        nextMaintenanceMileage: 90000,
        region: 'South',
        status: 'available',
        notes: 'Heavy interstate intercity transport'
      },
      {
        name: 'Tata Prima 2830 Heavy Duty',
        registrationNumber: 'GJ02EF3456',
        vehicleType: 'truck',
        fuelType: 'diesel',
        maxLoadCapacity: 18000,
        odometer: 115400,
        acquisitionCost: 4200000,
        maintenanceInterval: 20000,
        nextMaintenanceMileage: 120000,
        region: 'West',
        status: 'available',
        notes: 'High torque multi-axle freight carrier'
      },
      {
        name: 'Mahindra Bolero Maxi-Truck',
        registrationNumber: 'GJ03GH7890',
        vehicleType: 'pickup',
        fuelType: 'cng',
        maxLoadCapacity: 1300,
        odometer: 28900,
        acquisitionCost: 820000,
        maintenanceInterval: 10000,
        nextMaintenanceMileage: 30000,
        region: 'North',
        status: 'available',
        notes: 'Eco-friendly CNG delivery pickup'
      },
      {
        name: 'Ashok Leyland Ecomet Tanker',
        registrationNumber: 'GJ04IJ1234',
        vehicleType: 'tanker',
        fuelType: 'diesel',
        maxLoadCapacity: 12000,
        odometer: 94300,
        acquisitionCost: 3600000,
        maintenanceInterval: 15000,
        nextMaintenanceMileage: 105000,
        region: 'Central',
        status: 'available',
        notes: 'Hazardous chemicals & liquid fuel transport'
      },
      {
        name: 'Force Urbania Express Van',
        registrationNumber: 'GJ05KL5678',
        vehicleType: 'van',
        fuelType: 'diesel',
        maxLoadCapacity: 1600,
        odometer: 18500,
        acquisitionCost: 1950000,
        maintenanceInterval: 10000,
        nextMaintenanceMileage: 20000,
        region: 'East',
        status: 'in_shop',
        notes: 'Currently in workshop for brake pad renewal'
      },
      {
        name: 'Tata Ultra T.7 Cold Chain Reefer',
        registrationNumber: 'MH04MN9012',
        vehicleType: 'truck',
        fuelType: 'diesel',
        maxLoadCapacity: 4500,
        odometer: 51200,
        acquisitionCost: 2200000,
        maintenanceInterval: 10000,
        nextMaintenanceMileage: 60000,
        region: 'South',
        status: 'on_trip',
        notes: 'Refrigerated container maintained at 2-8°C'
      },
      {
        name: 'Isuzu D-Max Heavy Commercial',
        registrationNumber: 'DL01PQ3456',
        vehicleType: 'pickup',
        fuelType: 'diesel',
        maxLoadCapacity: 1500,
        odometer: 42700,
        acquisitionCost: 1400000,
        maintenanceInterval: 10000,
        nextMaintenanceMileage: 50000,
        region: 'North',
        status: 'available',
        notes: 'Rapid parcel express pickup'
      },
      {
        name: 'Volvo FM420 Multi-Axle Trailer',
        registrationNumber: 'MH12RS7890',
        vehicleType: 'trailer',
        fuelType: 'diesel',
        maxLoadCapacity: 28000,
        odometer: 165000,
        acquisitionCost: 6800000,
        maintenanceInterval: 25000,
        nextMaintenanceMileage: 175000,
        region: 'West',
        status: 'on_trip',
        notes: 'National logistics flagship container hauler'
      }
    ]);
    console.log(`🚛 Created ${vehicles.length} commercial vehicles across all types & fuels`);

    // 4. Seed Drivers (Varied license classes, safety scores, payment types & 1 expired license test case)
    const future2y = new Date();
    future2y.setFullYear(future2y.getFullYear() + 2);
    const future3y = new Date();
    future3y.setFullYear(future3y.getFullYear() + 3);
    const past6m = new Date();
    past6m.setMonth(past6m.getMonth() - 6);

    const drivers = await Driver.create([
      {
        name: 'Ravi Kumar',
        licenseNumber: 'GJ0120220001',
        licenseCategory: 'D',
        licenseExpiryDate: future2y,
        contactNumber: '9876543210',
        safetyScore: 96,
        status: 'on_trip',
        paymentType: 'per_trip',
        paymentAmount: 2800,
        kyc: { aadharNumber: '111122223333', aadharVerified: true },
        notes: 'Top tier safety record; 12 years heavy transit experience'
      },
      {
        name: 'Suresh Patel',
        licenseNumber: 'GJ0120210002',
        licenseCategory: 'E',
        licenseExpiryDate: future3y,
        contactNumber: '9876543211',
        safetyScore: 92,
        status: 'available',
        paymentType: 'per_trip',
        paymentAmount: 3200,
        kyc: { aadharNumber: '222233334444', aadharVerified: true },
        notes: 'Certified dangerous goods & hazardous materials handler'
      },
      {
        name: 'Vikram Singh',
        licenseNumber: 'MH1220190003',
        licenseCategory: 'D',
        licenseExpiryDate: future2y,
        contactNumber: '9876543212',
        safetyScore: 89,
        status: 'on_trip',
        paymentType: 'monthly',
        paymentAmount: 34000,
        kyc: { aadharNumber: '333344445555', aadharVerified: true },
        notes: 'Long haul specialist on Western Corridor'
      },
      {
        name: 'Mohammed Imran',
        licenseNumber: 'GJ0520200004',
        licenseCategory: 'C',
        licenseExpiryDate: future2y,
        contactNumber: '9876543213',
        safetyScore: 94,
        status: 'on_trip',
        paymentType: 'per_trip',
        paymentAmount: 2500,
        kyc: { aadharNumber: '444455556666', aadharVerified: true },
        notes: 'Specialist in refrigerated vaccine & cold-chain distribution'
      },
      {
        name: 'Amit Shah',
        licenseNumber: 'GJ0220200005',
        licenseCategory: 'B',
        licenseExpiryDate: future2y,
        contactNumber: '9876543214',
        safetyScore: 78,
        status: 'available',
        paymentType: 'monthly',
        paymentAmount: 26000,
        kyc: { aadharNumber: '555566667777', aadharVerified: true },
        notes: 'Express intra-state courier driver'
      },
      {
        name: 'Dinesh Rao',
        licenseNumber: 'GJ0320190006',
        licenseCategory: 'B',
        licenseExpiryDate: future2y,
        contactNumber: '9876543215',
        safetyScore: 68,
        status: 'available',
        paymentType: 'monthly',
        paymentAmount: 24000,
        kyc: { aadharNumber: '666677778888', aadharVerified: true },
        notes: 'Flagged for defensive driving coaching; 2 hard braking alerts'
      },
      {
        name: 'Karan Verma',
        licenseNumber: 'DL0120230007',
        licenseCategory: 'B',
        licenseExpiryDate: future3y,
        contactNumber: '9876543216',
        safetyScore: 98,
        status: 'available',
        paymentType: 'monthly',
        paymentAmount: 28000,
        kyc: { aadharNumber: '777788889999', aadharVerified: true },
        notes: 'EV fleet pioneer with zero violations'
      },
      {
        name: 'Harish Chandra',
        licenseNumber: 'GJ0420180008',
        licenseCategory: 'C',
        licenseExpiryDate: past6m,
        contactNumber: '9876543217',
        safetyScore: 52,
        status: 'suspended',
        paymentType: 'per_trip',
        paymentAmount: 2200,
        kyc: { aadharNumber: '888899990000', aadharVerified: false },
        notes: 'SUSPENDED: Commercial driver license expired 6 months ago'
      }
    ]);
    console.log(`👨‍✈️ Created ${drivers.length} commercial drivers (including compliance edge-cases)`);

    // 5. Seed Driver Portal User Accounts
    await User.create([
      {
        name: 'Ravi Kumar',
        email: 'driver@transitops.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '9876543210',
        driverProfileId: drivers[0]._id,
        status: 'Active'
      },
      {
        name: 'Vikram Singh',
        email: 'vikram.driver@transitops.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '9876543212',
        driverProfileId: drivers[2]._id,
        status: 'Active'
      },
      {
        name: 'Mohammed Imran',
        email: 'imran.driver@transitops.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '9876543213',
        driverProfileId: drivers[3]._id,
        status: 'Active'
      }
    ]);
    console.log('👤 Created 3 driver portal login accounts linked to profile IDs');

    // 6. Seed Realistic Trips Across Complete Transport Lifecycle
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const completedTrips = [];
    const completedTripData = [
      {
        source: 'Ahmedabad Logistics Hub',
        destination: 'Mumbai Nhava Sheva Port',
        vehicle: vehicles[3]._id, // Tata Prima
        driver: drivers[0]._id,  // Ravi Kumar
        customerName: 'Tata Motors International',
        commodityType: 'Automotive Engine Blocks',
        rateType: 'flat',
        rate: 64000,
        cargoWeight: 14200,
        plannedDistance: 525,
        actualDistance: 532,
        fuelConsumed: 145,
        revenue: 64000,
        scheduledDate: new Date(now - 7 * day),
        completedAt: new Date(now - 5 * day),
        status: 'completed',
        priority: 'high',
        notes: 'Delivered in pristine condition; custom clearance cleared',
        epod: {
          recipientName: 'Sunil Mehta (Port Authority)',
          quantityDelivered: 14200,
          condition: 'Good',
          capturedAt: new Date(now - 5 * day)
        },
        preTripInspection: {
          brakes: true, engine: true, tyres: true, headlights: true, indicators: true,
          horn: true, mirrors: true, oil: true, coolant: true, fuel: true,
          emergencyKit: true, fireExtinguisher: true, documents: true,
          vehicleCondition: 'Safe', completedAt: new Date(now - 7 * day)
        }
      },
      {
        source: 'Surat Textile Park',
        destination: 'Ahmedabad Apparel Market',
        vehicle: vehicles[1]._id, // Eicher Pro
        driver: drivers[4]._id,  // Amit Shah
        customerName: 'Reliance Retail Logistics',
        commodityType: 'Textile Fabric Rolls',
        rateType: 'flat',
        rate: 18500,
        cargoWeight: 2100,
        plannedDistance: 270,
        actualDistance: 274,
        fuelConsumed: 48,
        revenue: 18500,
        scheduledDate: new Date(now - 5 * day),
        completedAt: new Date(now - 4 * day),
        status: 'completed',
        priority: 'medium',
        notes: 'Smooth delivery on NE-1 expressway'
      },
      {
        source: 'Vadodara Bio-Tech Park',
        destination: 'Pune Medical Distribution Center',
        vehicle: vehicles[7]._id, // Reefer
        driver: drivers[3]._id,  // Mohammed Imran
        customerName: 'Serum Institute of India',
        commodityType: 'Temperature Sensitive Vaccines',
        rateType: 'flat',
        rate: 52000,
        cargoWeight: 3800,
        plannedDistance: 460,
        actualDistance: 468,
        fuelConsumed: 95,
        revenue: 52000,
        scheduledDate: new Date(now - 4 * day),
        completedAt: new Date(now - 2 * day),
        status: 'completed',
        priority: 'urgent',
        notes: 'Temperature log strictly maintained between 3.2°C to 4.5°C'
      },
      {
        source: 'Delhi Okhla Industrial Area',
        destination: 'Jaipur E-Commerce Fulfillment Hub',
        vehicle: vehicles[8]._id, // Isuzu Pickup
        driver: drivers[6]._id,  // Karan Verma
        customerName: 'Amazon India Transportation',
        commodityType: 'Consumer Electronics & Priority Parcels',
        rateType: 'flat',
        rate: 14000,
        cargoWeight: 950,
        plannedDistance: 280,
        actualDistance: 285,
        fuelConsumed: 28,
        revenue: 14000,
        scheduledDate: new Date(now - 2 * day),
        completedAt: new Date(now - 1 * day),
        status: 'completed',
        priority: 'high',
        notes: 'Delivered 2 hours ahead of SLA schedule'
      }
    ];

    for (const td of completedTripData) {
      completedTrips.push(await Trip.create(td));
    }
    console.log(`✅ Created ${completedTrips.length} fully reconciled completed trips`);

    // In-Transit / Active Trips (Shows live on Dispatch Board & Tracking Map!)
    const activeTrips = [];
    const activeTripData = [
      {
        source: 'Mumbai JNPT Port',
        destination: 'Bangalore Electronic City',
        vehicle: vehicles[9]._id, // Volvo FM420 Trailer
        driver: drivers[2]._id,  // Vikram Singh
        customerName: 'Schneider Electric Asia',
        commodityType: 'High-Precision Switchgear Units',
        rateType: 'flat',
        rate: 112000,
        cargoWeight: 24500,
        plannedDistance: 985,
        actualDistance: 410,
        fuelConsumed: 160,
        revenue: 112000,
        scheduledDate: new Date(now - 1 * day),
        eta: new Date(now + 1 * day),
        status: 'in_transit',
        priority: 'urgent',
        notes: 'GPS tracking active along NH48; passing Kolhapur'
      },
      {
        source: 'Ahmedabad Sanand Hub',
        destination: 'Indore Pithampur Auto Cluster',
        vehicle: vehicles[1]._id, // Eicher Pro
        driver: drivers[0]._id,  // Ravi Kumar
        customerName: 'Maruti Suzuki Suppliers',
        commodityType: 'Precision Transmission Gears',
        rateType: 'flat',
        rate: 29000,
        cargoWeight: 2400,
        plannedDistance: 390,
        actualDistance: 165,
        fuelConsumed: 38,
        revenue: 29000,
        scheduledDate: new Date(now - 6 * 3600 * 1000),
        eta: new Date(now + 8 * 3600 * 1000),
        status: 'in_transit',
        priority: 'high',
        notes: 'Cruising at 62 km/h near Godhra bypass'
      },
      {
        source: 'Surat Hazira Port',
        destination: 'Goa Vasco Logistics Depot',
        vehicle: vehicles[7]._id, // Reefer
        driver: drivers[3]._id,  // Mohammed Imran
        customerName: 'Falcon Marine Exports',
        commodityType: 'Deep Frozen Black Tiger Prawns (-20°C)',
        rateType: 'flat',
        rate: 78000,
        cargoWeight: 4200,
        plannedDistance: 740,
        actualDistance: 195,
        fuelConsumed: 46,
        revenue: 78000,
        scheduledDate: new Date(now - 8 * 3600 * 1000),
        eta: new Date(now + 14 * 3600 * 1000),
        status: 'in_transit',
        priority: 'urgent',
        notes: 'Continuous digital thermal monitoring active'
      }
    ];

    for (const atd of activeTripData) {
      activeTrips.push(await Trip.create(atd));
    }
    console.log(`🚗 Created ${activeTrips.length} active in-transit trips with active GPS tracking`);

    // Assigned, Draft & Cancelled Trips
    const otherTrips = await Trip.create([
      {
        source: 'Ahmedabad Sabarmati Hub',
        destination: 'Rajkot Shapar Industrial Estate',
        vehicle: vehicles[0]._id, // Tata Ace EV
        driver: drivers[6]._id,  // Karan Verma
        customerName: 'Samsung Electronics India',
        commodityType: 'Smartphones & Tablet Consignments',
        rateType: 'flat',
        rate: 11000,
        cargoWeight: 650,
        plannedDistance: 220,
        revenue: 11000,
        scheduledDate: new Date(now + 12 * 3600 * 1000),
        eta: new Date(now + 18 * 3600 * 1000),
        status: 'assigned',
        priority: 'medium',
        notes: 'Scheduled for evening EV express departure'
      },
      {
        source: 'Bangalore Peenya Cluster',
        destination: 'Chennai Ennore Port',
        commodityType: 'Heavy Engineering Precision Valves',
        cargoWeight: 6200,
        plannedDistance: 350,
        revenue: 38000,
        scheduledDate: new Date(now + 2 * day),
        status: 'draft',
        priority: 'medium',
        notes: 'Unassigned freight waiting for trailer allocation'
      },
      {
        source: 'Ahmedabad Logistics Hub',
        destination: 'Kutch Gandhidham Depot',
        vehicle: vehicles[4]._id,
        driver: drivers[5]._id,
        commodityType: 'Industrial Solar Panels',
        cargoWeight: 1100,
        plannedDistance: 380,
        revenue: 22000,
        scheduledDate: new Date(now - 3 * day),
        status: 'cancelled',
        priority: 'low',
        notes: 'Cancelled by shipper due to coastal weather storm advisory'
      }
    ]);
    console.log(`📋 Created ${otherTrips.length} assigned, draft, and cancelled trips for workflow completeness`);

    // 7. Seed Real Location Telemetry Pings (For Live Map)
    await LocationTelemetry.create([
      {
        driver: drivers[2]._id,
        vehicle: vehicles[9]._id,
        trip: activeTrips[0]._id,
        location: { type: 'Point', coordinates: [74.2433, 16.7050] }, // Near Kolhapur NH48
        accuracy: 5,
        speed: 68,
        heading: 145,
        recordedAt: new Date(now - 2 * 60 * 1000)
      },
      {
        driver: drivers[0]._id,
        vehicle: vehicles[1]._id,
        trip: activeTrips[1]._id,
        location: { type: 'Point', coordinates: [73.6149, 22.7758] }, // Godhra Highway
        accuracy: 4,
        speed: 62,
        heading: 88,
        recordedAt: new Date(now - 5 * 60 * 1000)
      },
      {
        driver: drivers[3]._id,
        vehicle: vehicles[7]._id,
        trip: activeTrips[2]._id,
        location: { type: 'Point', coordinates: [73.1168, 18.9894] }, // Panvel Expressway
        accuracy: 6,
        speed: 74,
        heading: 172,
        recordedAt: new Date(now - 1 * 60 * 1000)
      }
    ]);
    console.log('📡 Seeded live GPS telemetry pings along primary freight corridors');

    // 8. Seed Fuel Logs
    await FuelLog.create([
      {
        vehicle: vehicles[3]._id,
        driver: drivers[0]._id,
        trip: completedTrips[0]._id,
        date: new Date(now - 6 * day),
        quantity: 145,
        cost: 13775,
        fuelType: 'diesel',
        odometer: 115200,
        vendor: 'Indian Oil Highway Plaza Bharuch',
        fullTank: true
      },
      {
        vehicle: vehicles[1]._id,
        driver: drivers[4]._id,
        trip: completedTrips[1]._id,
        date: new Date(now - 4 * day),
        quantity: 48,
        cost: 4560,
        fuelType: 'diesel',
        odometer: 34100,
        vendor: 'Bharat Petroleum Expressway Anand',
        fullTank: true
      },
      {
        vehicle: vehicles[7]._id,
        driver: drivers[3]._id,
        trip: completedTrips[2]._id,
        date: new Date(now - 3 * day),
        quantity: 95,
        cost: 9025,
        fuelType: 'diesel',
        odometer: 51100,
        vendor: 'Hindustan Petroleum Vapi Toll Plaza',
        fullTank: true
      },
      {
        vehicle: vehicles[9]._id,
        driver: drivers[2]._id,
        trip: activeTrips[0]._id,
        date: new Date(now - 18 * 3600 * 1000),
        quantity: 160,
        cost: 15200,
        fuelType: 'diesel',
        odometer: 164800,
        vendor: 'Shell Commercial Hub Navi Mumbai',
        fullTank: true
      }
    ]);
    console.log('⛽ Seeded accurate commercial diesel fuel logs');

    // 9. Seed Operational Expenses (Tolls, FASTag, Insurance, Allowances)
    await Expense.create([
      {
        vehicle: vehicles[3]._id,
        driver: drivers[0]._id,
        trip: completedTrips[0]._id,
        expenseType: 'toll',
        amount: 1450,
        date: new Date(now - 6 * day),
        description: 'FASTag Tolls: Ahmedabad-Vadodara NE1 & Charoti Toll Plaza'
      },
      {
        vehicle: vehicles[7]._id,
        driver: drivers[3]._id,
        trip: completedTrips[2]._id,
        expenseType: 'toll',
        amount: 880,
        date: new Date(now - 3 * day),
        description: 'Mumbai-Pune Expressway Toll plaza FASTag electronic deduction'
      },
      {
        vehicle: vehicles[9]._id,
        driver: drivers[2]._id,
        expenseType: 'insurance',
        amount: 48000,
        date: new Date(now - 20 * day),
        description: 'Annual comprehensive bumper-to-bumper commercial trailer insurance'
      },
      {
        vehicle: vehicles[0]._id,
        driver: drivers[6]._id,
        expenseType: 'tax',
        amount: 2500,
        date: new Date(now - 10 * day),
        description: 'Green EV municipal commercial entry tax'
      },
      {
        vehicle: vehicles[3]._id,
        driver: drivers[0]._id,
        expenseType: 'other',
        amount: 1200,
        date: new Date(now - 5 * day),
        description: 'Nhava Sheva dock labor loading assistance allowance'
      }
    ]);
    console.log('💰 Seeded operational toll, insurance, and per-diem expenses');

    // 10. Seed Maintenance Work Orders
    await Maintenance.create([
      {
        vehicle: vehicles[6]._id, // Force Urbania
        description: 'Front Disc Brake Pad Renewal & Caliper Pin Servicing',
        maintenanceType: 'corrective',
        cost: 14200,
        dateStart: new Date(now - 1 * day),
        status: 'open',
        notes: 'Vehicle withheld in East Hub workshop. OEM brake kit ordered.',
        reportedBy: users[1]._id
      },
      {
        vehicle: vehicles[1]._id, // Eicher Pro
        description: 'Periodic 30,000 km Scheduled Engine Oil & Filter Change',
        maintenanceType: 'preventive',
        cost: 8500,
        dateStart: new Date(now - 15 * day),
        dateEnd: new Date(now - 14 * day),
        status: 'closed',
        notes: 'Castrol commercial synthetic oil 15W40 replaced; air filter blown clean.',
        reportedBy: users[0]._id
      },
      {
        vehicle: vehicles[5]._id, // Tanker
        description: 'Annual Explosive Safety Pressure Valve & Hydro-Testing',
        maintenanceType: 'inspection',
        cost: 6200,
        dateStart: new Date(now - 25 * day),
        dateEnd: new Date(now - 24 * day),
        status: 'closed',
        notes: 'Certified leak-free with 5-year PESO compliance certification.',
        reportedBy: users[2]._id
      }
    ]);
    console.log('🔧 Seeded open and closed maintenance work orders');

    // 11. Seed Safety Incidents
    await Incident.create([
      {
        driver: drivers[5]._id, // Dinesh Rao
        vehicle: vehicles[4]._id,
        type: 'other',
        severity: 'medium',
        status: 'resolved',
        location: 'NH48 Ankleshwar Flyover',
        description: 'Telematics registered hard braking event (-0.65g decelerative force).',
        assignedTo: users[2]._id,
        resolvedAt: new Date(now - 4 * day),
        resolvedBy: users[2]._id,
        resolutionNotes: 'Driver stated avoiding stray cattle on highway. Advised on high-beam caution.'
      },
      {
        driver: drivers[0]._id, // Ravi Kumar
        vehicle: vehicles[3]._id,
        type: 'breakdown',
        severity: 'low',
        status: 'resolved',
        location: 'Bharuch Toll Bypass',
        description: 'Rear-left dual tyre puncture reported during transit.',
        assignedTo: users[1]._id,
        resolvedAt: new Date(now - 6 * day),
        resolvedBy: users[1]._id,
        resolutionNotes: 'Highway mobile tyre service reached in 35 mins; spare tyre mounted.'
      },
      {
        driver: drivers[2]._id, // Vikram Singh
        vehicle: vehicles[9]._id,
        type: 'accident',
        severity: 'low',
        status: 'investigating',
        location: 'Bhiwandi Logistics Park Gate 3',
        description: 'Minor fender rub against warehouse gate barrier during night docking.',
        assignedTo: users[2]._id,
        resolutionNotes: 'Cosmetic scratch only; no mechanical or structural damage.'
      }
    ]);
    console.log('⚠️  Seeded realistic safety incidents with resolutions');

    // 12. Seed Driver Compliance Documents
    await DriverDocument.create([
      {
        driver: drivers[0]._id,
        documentType: 'license',
        fileUrl: '/uploads/documents/ravi_kumar_license.pdf',
        issueDate: new Date('2022-01-15'),
        expiryDate: future2y,
        verificationStatus: 'verified',
        verifiedBy: users[2]._id,
        verifiedAt: new Date('2023-01-10')
      },
      {
        driver: drivers[0]._id,
        documentType: 'medical_card',
        fileUrl: '/uploads/documents/ravi_kumar_fitness.pdf',
        issueDate: new Date('2023-05-10'),
        expiryDate: future2y,
        verificationStatus: 'verified',
        verifiedBy: users[2]._id,
        verifiedAt: new Date('2023-05-12')
      },
      {
        driver: drivers[7]._id, // Harish Chandra (expired license)
        documentType: 'license',
        fileUrl: '/uploads/documents/harish_expired_dl.pdf',
        issueDate: new Date('2018-02-10'),
        expiryDate: past6m,
        verificationStatus: 'rejected',
        verifiedBy: users[2]._id,
        verifiedAt: new Date(now - 30 * day),
        rejectionReason: 'Driving license has expired and renewal receipt is missing'
      }
    ]);
    console.log('📄 Seeded verified and flagged driver compliance documents');

    // 13. Seed Driver Logs (Hours of Service / ELD)
    await DriverLog.create([
      {
        driver: drivers[2]._id,
        status: 'DRIVING',
        startTime: new Date(now - 3 * 3600 * 1000),
        durationMinutes: 180,
        location: 'NH48 Pune-Kolhapur Sector',
        vehicle: vehicles[9]._id,
        notes: 'Steady cruise at 65 km/h'
      },
      {
        driver: drivers[2]._id,
        status: 'ON_DUTY',
        startTime: new Date(now - 4 * 3600 * 1000),
        endTime: new Date(now - 3 * 3600 * 1000),
        durationMinutes: 60,
        location: 'Navi Mumbai JNPT Container Gate',
        vehicle: vehicles[9]._id,
        notes: 'Pre-trip container seal check and document verification'
      },
      {
        driver: drivers[0]._id,
        status: 'DRIVING',
        startTime: new Date(now - 2 * 3600 * 1000),
        durationMinutes: 120,
        location: 'Ahmedabad-Indore Highway',
        vehicle: vehicles[1]._id,
        notes: 'In-transit freight haulage'
      }
    ]);
    console.log('⏱️  Seeded ELD Hours-of-Service driver duty logs');

    // 14. Seed Settlements & Complete Payroll Ledger
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    await Settlement.create([
      // Staff Salary Disbursal (Fleet Manager - Reconciled & Paid)
      {
        beneficiaryType: 'staff',
        user: users[0]._id,
        beneficiaryName: 'Fleet Manager',
        role: 'fleet_manager',
        periodStart: startOfMonth,
        periodEnd: new Date(),
        basePay: 85000,
        bonus: 5000, // Operations performance bonus
        deductions: 2500, // Professional tax & health
        netPay: 87500,
        paymentMethod: 'bank_transfer',
        transactionRef: 'NEFT-AXIS-202610-09881',
        status: 'paid',
        paidAt: new Date(now - 3 * day),
        paidBy: users[3]._id, // Approved by Finance Frank
        notes: 'Monthly executive remuneration + Q3 logistics SLA incentive'
      },
      // Staff Salary Disbursal (Dispatcher Dave - Reconciled & Paid)
      {
        beneficiaryType: 'staff',
        user: users[1]._id,
        beneficiaryName: 'Dispatcher Dave',
        role: 'dispatcher',
        periodStart: startOfMonth,
        periodEnd: new Date(),
        basePay: 46000,
        bonus: 2000,
        deductions: 1200,
        netPay: 46800,
        paymentMethod: 'upi',
        transactionRef: 'UPI-HDFC-202610-44912',
        status: 'paid',
        paidAt: new Date(now - 2 * day),
        paidBy: users[3]._id,
        notes: 'Regular monthly compensation with on-time dispatch incentive'
      },
      // Driver Trip Payout (Ravi Kumar - Completed Trip 1 Paid)
      {
        beneficiaryType: 'driver',
        driver: drivers[0]._id,
        beneficiaryName: 'Ravi Kumar',
        role: 'Commercial Hauler',
        periodStart: new Date(now - 8 * day),
        periodEnd: new Date(now - 5 * day),
        trips: [completedTrips[0]._id],
        basePay: 2800,
        bonus: 500, // Safe driving bonus
        deductions: 0,
        netPay: 3300,
        paymentMethod: 'bank_transfer',
        transactionRef: 'IMPS-SBI-202610-77312',
        status: 'paid',
        paidAt: new Date(now - 4 * day),
        paidBy: users[0]._id,
        notes: 'Direct settlement for completed trip Ahmedabad -> Mumbai Nhava Sheva'
      },
      // Driver Monthly Advance (Suresh Patel - Paid)
      {
        beneficiaryType: 'driver',
        driver: drivers[1]._id,
        beneficiaryName: 'Suresh Patel',
        role: 'Tanker Specialist',
        periodStart: startOfMonth,
        periodEnd: new Date(),
        basePay: 15000,
        bonus: 0,
        deductions: 0,
        netPay: 15000,
        paymentMethod: 'bank_transfer',
        transactionRef: 'IMPS-BOB-202610-88410',
        status: 'paid',
        paidAt: new Date(now - 6 * day),
        paidBy: users[3]._id,
        notes: 'Mid-month operational travel advance'
      }
    ]);
    console.log('💵 Seeded complete salary disbursements & driver vouchers in payroll ledger');

    // 15. Seed Operational Notifications
    await Notification.create([
      {
        userId: users[0]._id,
        title: 'High Revenue Route Completed',
        message: 'Trip TRIP-AHM-MUM generated ₹64,000 revenue with 100% on-time delivery.',
        type: 'success',
        read: false
      },
      {
        userId: users[2]._id,
        title: 'Driver License Expiry Alert',
        message: 'Harish Chandra (GJ0420180008) commercial license has expired. Action required.',
        type: 'warning',
        read: false
      },
      {
        userId: users[1]._id,
        title: 'Vehicle Maintenance Scheduled',
        message: 'Force Urbania (GJ05KL5678) is in East Hub workshop for brake renewal.',
        type: 'info',
        read: true
      }
    ]);
    console.log('🔔 Seeded operational system notifications');

    // 16. Seed Calendar Events
    await Event.create([
      {
        title: 'Weekly Fleet Operations Review',
        type: 'Meeting',
        startTime: new Date(now + 24 * 3600 * 1000),
        endTime: new Date(now + 25 * 3600 * 1000),
        description: 'Review route profitability, EV charging cycles, and FASTag expenses.',
        status: 'Planned'
      },
      {
        title: 'Ashok Leyland Tanker Safety Inspection',
        type: 'Maintenance',
        startTime: new Date(now + 3 * day),
        endTime: new Date(now + 3 * day + 4 * 3600 * 1000),
        description: 'Scheduled calibration of safety relief valves.',
        status: 'Planned'
      }
    ]);
    console.log('📅 Seeded operations calendar events');

    // 17. Seed Audit Logs
    await AuditLog.create([
      {
        action: 'CREATE',
        modelName: 'Vehicle',
        documentId: vehicles[0]._id,
        userId: users[0]._id,
        changes: { name: 'Tata Ace Gold EV-01', registrationNumber: 'GJ01EV1001' }
      },
      {
        action: 'UPDATE',
        modelName: 'Trip',
        documentId: completedTrips[0]._id,
        userId: users[1]._id,
        changes: { status: 'completed', revenue: 64000 }
      }
    ]);
    console.log('📋 Seeded enterprise audit logs');

    // 18. Flush in-memory cache if server is running
    try {
      const axios = require('axios');
      const port = process.env.PORT || 5000;
      await axios.post(`http://localhost:${port}/api/v1/cache/flush`, {}, { timeout: 1000 });
      console.log('⚡ Server in-memory cache flushed successfully');
    } catch (e) {
      // Server not active or endpoint skipped, ok
    }

    console.log('\n======================================================');
    console.log('🚀 REAL-LIFE LOGISTICS FLEET SIMULATION SEEDED!');
    console.log('======================================================');
    console.log('🔑 Login Credentials:');
    console.log('   1. Niv Patel (Lead Fleet Mgr) : nivpatel0207@gmail.com   / niv.7600964611');
    console.log('   2. Fleet Manager              : manager@transitops.com   / password123');
    console.log('   3. Dispatcher Dave            : dispatcher@transitops.com / password123');
    console.log('   4. Safety Sara                : safety@transitops.com    / password123');
    console.log('   5. Finance Frank              : analyst@transitops.com   / password123');
    console.log('   6. Driver Ravi Kumar          : driver@transitops.com    / password123');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed execution failed:', err);
    process.exit(1);
  }
};

seed();
