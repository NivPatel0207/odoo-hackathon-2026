const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const FuelLog = require('../models/FuelLog');
const Maintenance = require('../models/Maintenance');

const controller = require('../controllers/driverPortalController');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};
const mockNext = (err) => { if (err) console.error("NEXT ERR:", err); };

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops-dev', { useNewUrlParser: true, useUnifiedTopology: true });

    let failed = false;

    // 1. Setup
    const defaultVehicle = await Vehicle.create({ name: 'Default Truck', registrationNumber: 'DEF-' + Date.now(), vehicleType: 'truck', maxLoadCapacity: 1000 });
    const tripVehicle = await Vehicle.create({ name: 'Trip Truck', registrationNumber: 'TRP-' + Date.now(), vehicleType: 'truck', maxLoadCapacity: 1000 });
    
    // Create Driver
    const driver = await Driver.create({ name: 'Phase 3 Driver', licenseNumber: 'L3-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '111', paymentAmount: 100, kyc: { aadharNumber: 'AA1' }});
    const user = await User.create({ name: 'User 3', email: 'u3' + Date.now() + '@test.com', phone: '123', passwordHash: 'hash', role: 'driver', driverProfileId: driver._id });

    // TEST 1: Driver has NO default vehicle and NO active trip.
    console.log("--- TEST 1: No Vehicle Context ---");
    let req = { params: { driverId: driver._id.toString() }, user, body: { description: 'Defect 1' } };
    let res = mockRes();
    await controller.reportVehicleDefect(req, res, mockNext);
    if (res.statusCode !== 400) { console.error("Test 1 Failed: Allowed defect without vehicle"); failed = true; }
    else console.log("Test 1 Passed: Blocked defect without vehicle");

    // TEST 2: Driver has DEFAULT vehicle, but NO active trip.
    console.log("--- TEST 2: Default Vehicle Context ---");
    driver.defaultVehicle = defaultVehicle._id;
    await driver.save();
    
    req = { params: { driverId: driver._id.toString() }, user, body: { description: 'Defect 2' } };
    res = mockRes();
    await controller.reportVehicleDefect(req, res, mockNext);
    if (res.statusCode !== 200) { console.error("Test 2 Failed: Blocked defect with default vehicle"); failed = true; }
    else {
        // verify reportedBy is set
        const defect = await Maintenance.findById(res.data.data._id);
        if (defect.reportedBy.toString() !== user._id.toString()) {
            console.error("Test 2 Failed: reportedBy not correctly assigned"); failed = true;
        } else {
            console.log("Test 2 Passed: Allowed defect on default vehicle and saved reportedBy");
        }
    }

    // TEST 3: Driver on ACTIVE TRIP with Trip Vehicle
    console.log("--- TEST 3: Trip Vehicle Override Context ---");
    const trip = await Trip.create({ tripCode: 'TRIP3-' + Date.now(), source: 'A', destination: 'B', cargoWeight: 10, driver: driver._id, vehicle: tripVehicle._id, status: 'dispatched' });
    
    req = { params: { driverId: driver._id.toString() }, user, body: { quantity: 10, cost: 50, station: 'Shell' } };
    res = mockRes();
    await controller.logDriverFuel(req, res, mockNext);
    if (res.statusCode !== 201) { console.error("Test 3 Failed: Could not log fuel on trip"); failed = true; }
    else {
        const fuel = await FuelLog.findById(res.data.data._id);
        if (fuel.vehicle.toString() !== tripVehicle._id.toString()) {
            console.error("Test 3 Failed: Fuel logged to wrong vehicle (expected trip vehicle)"); failed = true;
        } else {
            console.log("Test 3 Passed: Fuel logged to Trip vehicle, overriding default");
        }
    }

    // Cleanup
    await User.deleteOne({ _id: user._id });
    await Driver.deleteOne({ _id: driver._id });
    await Vehicle.deleteMany({ _id: { $in: [defaultVehicle._id, tripVehicle._id] } });
    await Trip.deleteOne({ _id: trip._id });
    await Maintenance.deleteMany({ vehicle: { $in: [defaultVehicle._id, tripVehicle._id] } });
    await FuelLog.deleteMany({ driver: driver._id });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
