const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const LocationTelemetry = require('../models/LocationTelemetry');
const fs = require('fs');
const path = require('path');

const driverPortalController = require('../controllers/driverPortalController');
const trackingController = require('../controllers/trackingController');

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
    const vehicleA = await Vehicle.create({ name: 'Phase 8 Truck', registrationNumber: 'PH8A-' + Date.now(), vehicleType: 'truck', maxLoadCapacity: 1000 });
    const driverA = await Driver.create({ name: 'Driver 8A', licenseNumber: 'L8A-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA8A' }, defaultVehicle: vehicleA._id });
    const driverB = await Driver.create({ name: 'Driver 8B', licenseNumber: 'L8B-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA8B' } });
    
    const userA = await User.create({ name: 'User 8A', email: '8a' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });
    const dispatcher = await User.create({ name: 'Dispatcher 8', email: 'disp8' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'dispatcher' });

    // TEST 1: Driver A telemetry submission -> ACCEPTED
    console.log("--- TEST 1: Driver Telemetry Submit ---");
    let req = { 
        params: { driverId: driverA._id.toString() }, 
        user: userA, 
        body: { latitude: 40.7128, longitude: -74.0060, accuracy: 10, speed: 25, heading: 90, recordedAt: new Date().toISOString() } 
    };
    let res = mockRes();
    await driverPortalController.submitTelemetry(req, res, mockNext);
    if (res.statusCode === 201) {
        console.log("Test 1 Passed: Telemetry saved.");
    } else {
        console.error("Test 1 Failed: Telemetry rejected.", res.data); failed = true;
    }

    // TEST 2: Driver A submit for Driver B -> BLOCKED
    console.log("--- TEST 2: Cross-Driver Submission Block ---");
    req = { 
        params: { driverId: driverB._id.toString() }, 
        user: userA, 
        body: { latitude: 40, longitude: -74 } 
    };
    res = mockRes();
    await driverPortalController.submitTelemetry(req, res, mockNext);
    if (res.statusCode === 403) {
        console.log("Test 2 Passed: Cross-driver submission blocked.");
    } else {
        console.error("Test 2 Failed.", res.data); failed = true;
    }

    // TEST 3: Invalid Latitude -> BLOCKED
    console.log("--- TEST 3: Invalid Coordinates ---");
    req = { 
        params: { driverId: driverA._id.toString() }, 
        user: userA, 
        body: { latitude: 100, longitude: -74 } 
    };
    res = mockRes();
    await driverPortalController.submitTelemetry(req, res, mockNext);
    if (res.statusCode === 400 && res.data.message.includes('Invalid coordinates')) {
        console.log("Test 3 Passed: Invalid latitude blocked.");
    } else {
        console.error("Test 3 Failed.", res.data); failed = true;
    }

    // TEST 4: Dispatcher Access & Stale Detection
    console.log("--- TEST 4: Dispatcher Access & Staleness ---");
    // Add a stale record
    await LocationTelemetry.create({
      driver: driverB._id,
      location: { type: 'Point', coordinates: [-80, 35] },
      recordedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    });

    req = { user: dispatcher };
    res = mockRes();
    await trackingController.getLiveTracking(req, res, mockNext);
    if (res.statusCode === 200 && res.data.data.length >= 2) {
        const docB = res.data.data.find(d => d.driver._id.toString() === driverB._id.toString());
        const docA = res.data.data.find(d => d.driver._id.toString() === driverA._id.toString());
        if (docB.isStale && !docA.isStale) {
            console.log("Test 4 Passed: Stale detection working accurately.");
        } else {
            console.error("Test 4 Failed: Stale calculation incorrect.", docA.isStale, docB.isStale); failed = true;
        }
    } else {
        console.error("Test 4 Failed: Could not fetch live tracking.", res.data); failed = true;
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [userA._id, dispatcher._id] } });
    await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
    await Vehicle.deleteMany({ _id: { $in: [vehicleA._id] } });
    await LocationTelemetry.deleteMany({ driver: { $in: [driverA._id, driverB._id] } });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
