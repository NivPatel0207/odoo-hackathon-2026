const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const Incident = require('../models/Incident');
const fs = require('fs');
const path = require('path');

const driverController = require('../controllers/driverPortalController');
const incidentController = require('../controllers/incidentController');

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
    const vehicleA = await Vehicle.create({ name: 'Phase 6 Truck A', registrationNumber: 'PH6A-' + Date.now(), vehicleType: 'truck', maxLoadCapacity: 1000 });
    
    const driverA = await Driver.create({ name: 'Driver 6A', licenseNumber: 'L6A-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA6A' }, defaultVehicle: vehicleA._id });
    const driverB = await Driver.create({ name: 'Driver 6B', licenseNumber: 'L6B-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA6B' }});
    
    const userA = await User.create({ name: 'User 6A', email: '6a' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });
    const safetyUser = await User.create({ name: 'Safety Officer', email: 'safety' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'safety_officer' });

    const tripA = await Trip.create({ tripCode: 'TRIP6A-' + Date.now(), source: 'A', destination: 'B', cargoWeight: 10, driver: driverA._id, vehicle: vehicleA._id, status: 'in_transit' });
    const tripB = await Trip.create({ tripCode: 'TRIP6B-' + Date.now(), source: 'A', destination: 'B', cargoWeight: 10, driver: driverB._id, status: 'in_transit' });

    const sampleMedia = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    // TEST 1: Driver A creates accident without vehicle -> ALLOWED because fallback to defaultVehicle
    // Driver B creates accident without vehicle -> BLOCKED because no vehicle and no defaultVehicle
    console.log("--- TEST 1: Vehicle Validation ---");
    let req = { 
        params: { driverId: driverB._id.toString() }, 
        user: { role: 'driver', driverProfileId: driverB._id.toString() }, 
        body: { incidentType: 'accident', severity: 'high', location: 'test', description: 'desc' } 
    };
    let res = mockRes();
    await driverController.reportDriverIncident(req, res, mockNext);
    if (res.statusCode === 400 && res.data.message.includes('vehicle assignment is required')) {
        console.log("Test 1 Passed: Blocked vehicle incident for driver with no vehicle.");
    } else {
        console.error("Test 1 Failed: Allowed incident without vehicle.", res.data); failed = true;
    }

    // TEST 2: Driver A creates incident against Driver B's trip -> BLOCKED
    console.log("--- TEST 2: Trip Ownership Validation ---");
    req = { 
        params: { driverId: driverA._id.toString() }, 
        user: userA, 
        body: { incidentType: 'other', severity: 'low', location: 'test', description: 'desc', tripId: tripB._id.toString() } 
    };
    res = mockRes();
    await driverController.reportDriverIncident(req, res, mockNext);
    if (res.statusCode === 403 && res.data.message.includes('do not own this trip')) {
        console.log("Test 2 Passed: Blocked cross-driver trip incident.");
    } else {
        console.error("Test 2 Failed: Allowed cross-driver trip incident."); failed = true;
    }

    // TEST 3: Driver A creates valid incident with media -> SUCCESS
    console.log("--- TEST 3: Incident Creation & Media Upload ---");
    req = { 
        params: { driverId: driverA._id.toString() }, 
        user: userA, 
        body: { incidentType: 'breakdown', severity: 'critical', location: 'I-95', description: 'Engine smoking', tripId: tripA._id.toString(), mediaBase64: sampleMedia } 
    };
    res = mockRes();
    await driverController.reportDriverIncident(req, res, mockNext);
    let incidentId = null;
    if (res.statusCode === 201) {
        incidentId = res.data.data._id;
        const inc = await Incident.findById(incidentId);
        if (inc.status !== 'reported' || !inc.mediaUrls[0].startsWith('/uploads/incidents/')) {
            console.error("Test 3 Failed: Media URL not saved correctly.", inc.mediaUrls); failed = true;
        } else {
            console.log("Test 3 Passed: Incident created, file saved.");
            const filepath = path.join(__dirname, '..', inc.mediaUrls[0]);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }
    } else {
        console.error("Test 3 Failed: Incident creation failed.", res.data); failed = true;
    }

    // TEST 4: Back-office lifecycle -> investigate and resolve
    console.log("--- TEST 4: Incident Lifecycle ---");
    if (incidentId) {
        req = { params: { id: incidentId.toString() }, user: safetyUser };
        res = mockRes();
        await incidentController.investigateIncident(req, res, mockNext);
        let inc = await Incident.findById(incidentId);
        if (inc.status === 'investigating' && inc.assignedTo.toString() === safetyUser._id.toString()) {
            console.log("Test 4a Passed: Safety Officer investigated incident.");
        } else {
            console.error("Test 4a Failed: Investigation failed."); failed = true;
        }

        req = { params: { id: incidentId.toString() }, user: safetyUser, body: { resolutionNotes: 'Fixed it' } };
        res = mockRes();
        await incidentController.resolveIncident(req, res, mockNext);
        inc = await Incident.findById(incidentId);
        if (inc.status === 'resolved' && inc.resolutionNotes === 'Fixed it') {
            console.log("Test 4b Passed: Safety Officer resolved incident.");
        } else {
            console.error("Test 4b Failed: Resolution failed."); failed = true;
        }

        // Test duplicate resolution
        req = { params: { id: incidentId.toString() }, user: safetyUser, body: { resolutionNotes: 'Again' } };
        res = mockRes();
        await incidentController.resolveIncident(req, res, mockNext);
        if (res.statusCode === 400 && res.data.message.includes('already resolved')) {
            console.log("Test 4c Passed: Blocked duplicate resolution.");
        } else {
            console.error("Test 4c Failed: Allowed duplicate resolution."); failed = true;
        }
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [userA._id, safetyUser._id] } });
    await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
    await Vehicle.deleteMany({ _id: { $in: [vehicleA._id] } });
    await Trip.deleteMany({ _id: { $in: [tripA._id, tripB._id] } });
    if (incidentId) await Incident.deleteOne({ _id: incidentId });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
