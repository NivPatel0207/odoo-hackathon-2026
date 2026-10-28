const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const authMiddleware = require('../middleware/authMiddleware');

const controller = require('../controllers/driverPortalController');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};

const mockNext = (err) => {
    if (err) {
        console.error("MOCK NEXT ERROR:", err);
    }
};

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops-dev', { useNewUrlParser: true, useUnifiedTopology: true });

    console.log("Setting up mock data...");
    // Create Driver A
    const driverA = await Driver.create({ name: 'Driver A Phase 2 Test', licenseNumber: 'A' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '123' + Date.now(), paymentAmount: 100, kyc: { aadharNumber: 'A123' }});
    const userA = await User.create({ name: 'User A', email: 'a' + Date.now() + '@test.com', phone: '123', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });

    // Create Admin
    const userAdmin = await User.create({ name: 'Admin', email: 'admin' + Date.now() + '@test.com', phone: '789', passwordHash: 'hash', role: 'fleet_manager' });

    // Create Vehicle
    const vehicle = await Vehicle.create({ registrationNumber: 'V' + Date.now(), make: 'Ford', model: 'Transit', year: 2020, status: 'available', maxLoadCapacity: 1000, name: 'Truck 1', vehicleType: 'truck' });

    // Create Trip for Driver A (assigned)
    const trip = await Trip.create({ tripCode: 'TEST-' + Date.now(), source: 'X', destination: 'Y', cargoWeight: 100, driver: driverA._id, vehicle: vehicle._id, status: 'assigned' });

    console.log("Running Phase 2 State Machine Tests...");

    let failed = false;
    let req, res;

    // Helper
    const attemptTransition = async (user, toStatus) => {
        req = { params: { driverId: driverA._id.toString(), tripId: trip._id.toString() }, user, body: { status: toStatus } };
        res = mockRes();
        await controller.updateDriverTripStatus(req, res, mockNext);
        return res;
    };

    // Test 1: Driver -> assigned to completed (FAIL)
    res = await attemptTransition(userA, 'completed');
    if (res.statusCode !== 400) { console.error("Test 1 Failed: Driver allowed to complete trip. Status was", res.statusCode); failed = true; }
    else console.log("Test 1 Passed: assigned -> completed (Blocked for Driver)");

    // Test 2: Driver -> assigned to accepted (PASS)
    res = await attemptTransition(userA, 'accepted');
    if (res.data && res.data.success !== true) { console.error("Test 2 Failed: Driver could not accept trip."); failed = true; }
    else console.log("Test 2 Passed: assigned -> accepted (Allowed for Driver)");

    // Test 3: Driver -> accepted to in_transit (PASS)
    res = await attemptTransition(userA, 'in_transit');
    if (res.data && res.data.success !== true) { console.error("Test 3 Failed: Driver could not start trip."); failed = true; }
    else console.log("Test 3 Passed: accepted -> in_transit (Allowed for Driver)");

    // Test 4: Driver -> in_transit to loading (FAIL - backward transition)
    res = await attemptTransition(userA, 'loading');
    if (res.statusCode !== 400) { console.error("Test 4 Failed: Driver allowed backward transition."); failed = true; }
    else console.log("Test 4 Passed: in_transit -> loading (Blocked for Driver)");

    // Test 5: Driver -> Call /complete (FAIL)
    req = { params: { driverId: driverA._id.toString(), tripId: trip._id.toString() }, user: userA, body: { actualDistance: 100 } };
    res = mockRes();
    await controller.completeDriverTrip(req, res, mockNext);
    if (res.statusCode !== 403) { console.error("Test 5 Failed: Driver allowed to call completeDriverTrip directly"); failed = true; }
    else console.log("Test 5 Passed: /complete blocked for Driver (403)");

    // Test 6: Admin -> in_transit to completed (PASS)
    res = await attemptTransition(userAdmin, 'completed');
    if (res.data && res.data.success !== true) { console.error("Test 6 Failed: Admin could not complete trip."); failed = true; }
    else console.log("Test 6 Passed: in_transit -> completed (Allowed for Admin)");

    console.log("Cleaning up mock data...");
    await User.deleteMany({ email: { $in: [userA.email, userAdmin.email] } });
    await Driver.deleteOne({ _id: driverA._id });
    await Vehicle.deleteOne({ _id: vehicle._id });
    await Trip.deleteOne({ _id: trip._id });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
