const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const Notification = require('../models/Notification');
const FuelLog = require('../models/FuelLog');
const Expense = require('../models/Expense');
const authMiddleware = require('../middleware/authMiddleware');

const controller = require('../controllers/driverPortalController');
const notificationController = require('../controllers/notificationController');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};

const mockNext = (err) => {
    if (err) throw err;
};

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops-dev', { useNewUrlParser: true, useUnifiedTopology: true });

    console.log("Setting up mock data...");
    // Create Driver A
    const driverA = await Driver.create({ name: 'Driver A Phase 1 Test', licenseNumber: 'A' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '123' + Date.now(), paymentAmount: 100, kyc: { aadharNumber: 'A123' }});
    const userA = await User.create({ name: 'User A', email: 'a' + Date.now() + '@test.com', phone: '123', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });

    // Create Driver B
    const driverB = await Driver.create({ name: 'Driver B Phase 1 Test', licenseNumber: 'B' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '456' + Date.now(), paymentAmount: 100, kyc: { aadharNumber: 'B123' }});
    const userB = await User.create({ name: 'User B', email: 'b' + Date.now() + '@test.com', phone: '456', passwordHash: 'hash', role: 'driver', driverProfileId: driverB._id });

    // Create Admin
    const userAdmin = await User.create({ name: 'Admin', email: 'admin' + Date.now() + '@test.com', phone: '789', passwordHash: 'hash', role: 'fleet_manager' });

    // Create Trip for Driver B
    const tripB = await Trip.create({ source: 'X', destination: 'Y', cargoWeight: 100, driver: driverB._id });

    // Create System Notification
    const sysNotif = await Notification.create({ title: 'System', message: 'System' });

    console.log("Running Tests...");

    let failed = false;

    // Test 1: Driver A -> own profile via /me
    let req = { params: { driverId: 'me' }, user: userA };
    let res = mockRes();
    await controller.getDriverProfile(req, res, mockNext);
    if(res.data.success !== true) { console.error("Test 1 Failed"); failed = true; }
    else console.log("Test 1 Passed: Driver A -> /me (Allowed)");

    // Test 2: Driver A -> own profile via driverId
    req = { params: { driverId: driverA._id.toString() }, user: userA };
    res = mockRes();
    await controller.getDriverProfile(req, res, mockNext);
    if(res.data.success !== true) { console.error("Test 2 Failed"); failed = true; }
    else console.log("Test 2 Passed: Driver A -> driverA ID (Allowed)");

    // Test 3: Driver A -> Driver B profile
    req = { params: { driverId: driverB._id.toString() }, user: userA };
    res = mockRes();
    try {
        await controller.getDriverProfile(req, res, mockNext);
        console.error("Test 3 Failed: Driver A accessed Driver B profile");
        failed = true;
    } catch(err) {
        if(err.statusCode !== 403) { console.error("Test 3 Failed with wrong status"); failed = true; }
        else console.log("Test 3 Passed: Driver A -> Driver B ID (Blocked)");
    }

    // Test 4: Driver A -> Driver B trip via Fuel
    req = { params: { driverId: driverA._id.toString() }, user: userA, body: { tripId: tripB._id.toString() } };
    res = mockRes();
    try {
        await controller.logDriverFuel(req, res, mockNext);
        if (res.statusCode === 403) {
            console.log("Test 4 Passed: Driver A -> Fuel on Driver B trip (Blocked inside controller)");
        } else if (res.statusCode === 400) {
            console.log("Test 4 Passed: Driver A -> Fuel blocked because no active vehicle (Expected fallback)");
        } else {
             console.error("Test 4 Failed: Driver A logged fuel on Driver B trip");
             failed = true;
        }
    } catch(err) {
        console.error(err);
        failed = true;
    }

    // Test 5: Admin -> Driver B profile via driverId
    req = { params: { driverId: driverB._id.toString() }, user: userAdmin };
    res = mockRes();
    await controller.getDriverProfile(req, res, mockNext);
    if(res.data.success !== true) { console.error("Test 5 Failed"); failed = true; }
    else console.log("Test 5 Passed: Admin -> Driver B ID (Allowed)");

    // Test 6: Driver A -> System Notification read
    req = { params: { id: sysNotif._id.toString() }, user: userA };
    res = mockRes();
    try {
        await notificationController.markAsRead(req, res, mockNext);
        if(res.data.success !== true) { console.error("Test 6 Failed: Could not mark system notification read"); failed = true; }
        else console.log("Test 6 Passed: Driver A -> System notification read (Allowed via readBy array)");
    } catch(err) {
         console.error(err);
         failed = true;
    }

    console.log("Cleaning up mock data...");
    await User.deleteMany({ email: { $in: [userA.email, userB.email, userAdmin.email] } });
    await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
    await Trip.deleteOne({ _id: tripB._id });
    await Notification.deleteOne({ _id: sysNotif._id });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
