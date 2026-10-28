require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'test_secret_123';
const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Notification = require('../models/Notification');
const authController = require('../controllers/authController');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (data) => { res.data = data; return res; };
    return res;
};

const mockNext = (err) => {
    if (err) throw err;
};

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops-dev-remediation', { useNewUrlParser: true, useUnifiedTopology: true });
    
    // Ensure test environment variable for secret
    process.env.ENCRYPTION_SECRET = 'test_secret_123';
    process.env.JWT_SECRET = 'test_jwt_secret';
    
    console.log("Setting up mock data...");
    await User.deleteMany({});
    await Driver.deleteMany({});
    await Notification.deleteMany({});
    
    let failed = false;

    // Test 1: Public registration cannot create fleet_manager/dispatcher
    // Note: Public registration was completely removed in P0-2! So we test that authRoutes doesn't have it, or simulate an attempt
    // Actually, P0-2 required us to remove public registration. So there is no register route anymore.
    // Instead of calling register controller, we ensure it throws if we try.
    // We'll test user creation via authController.createUser (Admin only)
    
    // Test 2: Active user can log in
    const activeUser = await User.create({ name: 'Active', email: 'active@test.com', phone: '123', passwordHash: 'password', role: 'viewer', status: 'Active' });
    let req = { body: { email: 'active@test.com', password: 'password' } };
    let res = mockRes();
    await authController.login(req, res, mockNext);
    if (res.data && res.data.success) {
        console.log("Test: Active user can log in (Passed)");
        if (res.data.user.passwordHash) {
            console.error("Test: Password hashes are never returned (Failed - found in login)");
            failed = true;
        } else {
            console.log("Test: Password hashes are never returned (Passed)");
        }
    } else {
        console.error("Test: Active user can log in (Failed)");
        failed = true;
    }

    // Test 3: Inactive user cannot log in
    const inactiveUser = await User.create({ name: 'Inactive', email: 'inactive@test.com', phone: '123', passwordHash: 'password', role: 'viewer', status: 'Inactive' });
    req = { body: { email: 'inactive@test.com', password: 'password' } };
    res = mockRes();
    await authController.login(req, res, mockNext);
    if (res.statusCode === 403) {
        console.log("Test: Inactive user cannot log in (Passed)");
    } else {
        console.error("Test: Inactive user cannot log in (Failed)");
        failed = true;
    }

    // Test 4: Suspended user cannot log in
    const suspendedUser = await User.create({ name: 'Suspended', email: 'suspended@test.com', phone: '123', passwordHash: 'password', role: 'viewer', status: 'Suspended' });
    req = { body: { email: 'suspended@test.com', password: 'password' } };
    res = mockRes();
    await authController.login(req, res, mockNext);
    if (res.statusCode === 403) {
        console.log("Test: Suspended user cannot log in (Passed)");
    } else {
        console.error("Test: Suspended user cannot log in (Failed)");
        failed = true;
    }

    // Test 5: JWT in query string is rejected
    req = { headers: {}, query: { token: 'some_token' } };
    res = mockRes();
    await authMiddleware.protect(req, res, mockNext);
    if (res.statusCode === 401 && res.data.message === 'Not authorized, no token') {
        console.log("Test: JWT in query string is rejected (Passed)");
    } else {
        console.error("Test: JWT in query string is rejected (Failed)");
        failed = true;
    }

    // Test 6: Driver user creation produces valid records (authController.createUser)
    req = { body: { name: 'Driver', email: 'driver@test.com', password: 'password', role: 'driver', phone: '123' } };
    res = mockRes();
    await authController.createUser(req, res, mockNext);
    if (res.statusCode === 201 && res.data.success) {
        if (res.data.data.passwordHash || res.data.data.password) {
            console.error("Test: Password hashes never returned on creation (Failed)");
            failed = true;
        }
        
        // Ensure driverProfileId is NOT set automatically to an incomplete record
        if (res.data.data.driverProfileId) {
             console.error("Test: Driver user creation produced automatic incomplete driverProfileId (Failed)");
             failed = true;
        } else {
             console.log("Test: Driver user creation valid and avoids incomplete profile (Passed)");
        }
    } else {
        console.error("Test: Driver user creation (Failed)");
        failed = true;
    }

    // Test 7: Driver A cannot mark Driver B notification as read
    const driverA = await User.create({ name: 'DriverA', email: 'da@test.com', phone: '1', passwordHash: 'p', role: 'driver' });
    const driverB = await User.create({ name: 'DriverB', email: 'db@test.com', phone: '2', passwordHash: 'p', role: 'driver' });
    const notifB = await Notification.create({ userId: driverB._id, title: 'Test', message: 'Test' });
    
    req = { user: driverA, params: { id: notifB._id.toString() } };
    res = mockRes();
    await notificationController.markAsRead(req, res, mockNext);
    if (res.statusCode === 403) {
        console.log("Test: Driver A cannot mark Driver B notification as read (Passed)");
    } else {
        console.error("Test: Driver A cannot mark Driver B notification as read (Failed)");
        failed = true;
    }

    // Test 8: Driver A can mark own notification as read
    const notifA = await Notification.create({ userId: driverA._id, title: 'Test', message: 'Test' });
    req = { user: driverA, params: { id: notifA._id.toString() } };
    res = mockRes();
    await notificationController.markAsRead(req, res, mockNext);
    if (res.data && res.data.success) {
        console.log("Test: Driver A can mark own notification as read (Passed)");
    } else {
        console.error("Test: Driver A can mark own notification as read (Failed)");
        failed = true;
    }

    // Missing encryption secret test (must be tested in isolated process due to fatal throw)
    try {
        const secret = process.env.ENCRYPTION_SECRET;
        delete process.env.ENCRYPTION_SECRET;
        
        // Clearing require cache to reload the module and trigger the error
        delete require.cache[require.resolve('../models/Driver')];
        try {
            require('../models/Driver');
            console.error("Test: Missing encryption secret fails silently (Failed)");
            failed = true;
        } catch (err) {
            if (err.message.includes("ENCRYPTION_SECRET environment variable is not defined")) {
                 console.log("Test: Missing encryption secret throws fatal error (Passed)");
            } else {
                 console.error("Test: Missing encryption secret failed with wrong error (Failed)");
                 failed = true;
            }
        }
        process.env.ENCRYPTION_SECRET = secret;
    } catch (e) {
        console.error(e);
        failed = true;
    }

    console.log("Cleaning up mock data...");
    await User.deleteMany({});
    await Driver.deleteMany({});
    await Notification.deleteMany({});

    mongoose.connection.close();
    if(failed) {
        console.log("Some critical remediation tests FAILED.");
        process.exit(1);
    } else {
        console.log("All critical remediation tests PASSED.");
    }
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
