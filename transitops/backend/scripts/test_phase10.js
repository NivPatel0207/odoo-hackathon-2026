const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Driver = require('../models/Driver');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');

// Mock controllers for testing middleware directly
const authController = require('../controllers/authController');
const driverPortalController = require('../controllers/driverPortalController');
const fuelExpenseController = require('../controllers/fuelExpenseController');

const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const mockRes = () => {
    const res = {};
    res.status = function (code) { this.statusCode = code; return this; };
    res.json = function (data) { this.data = data; return this; };
    return res;
};

const mockNext = (err) => { if (err) console.error("NEXT ERR:", err); };

async function runTests() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);

    await User.deleteMany({ email: { $in: ['d1@test.com', 'd2@test.com'] } });
    await Driver.deleteMany({ email: { $in: ['d1@test.com', 'd2@test.com'] } });

    // Setup Test Data
    const driverA_User = await User.create({ name: 'D1', email: 'd1@test.com', passwordHash: 'password', role: 'driver', phone: '111' });
    const driverB_User = await User.create({ name: 'D2', email: 'd2@test.com', passwordHash: 'password', role: 'driver', phone: '222' });
    
    const driverA = await Driver.create({ name: 'D1', email: 'd1@test.com', contactNumber: '111', licenseNumber: 'L1', licenseCategory: 'C', licenseExpiryDate: new Date('2030-01-01'), kyc: { aadharNumber: '1234' } });
    const driverB = await Driver.create({ name: 'D2', email: 'd2@test.com', contactNumber: '222', licenseNumber: 'L2', licenseCategory: 'C', licenseExpiryDate: new Date('2030-01-01'), kyc: { aadharNumber: '5678' } });

    driverA_User.driverProfileId = driverA._id;
    driverB_User.driverProfileId = driverB._id;
    await driverA_User.save();
    await driverB_User.save();

    console.log('--- TEST 1: Driver Isolation (IDOR) ---');
    try {
        let req = { user: driverA_User, params: { driverId: driverB._id.toString() } };
        let res = mockRes();
        
        await driverPortalController.getDriverProfile(req, res, (err) => {
            if (err && err.statusCode === 403) {
                console.log('Test 1 Passed: Driver A cannot read Driver B profile (IDOR blocked).');
            } else {
                console.error('Test 1 Failed: Should have thrown 403');
            }
        });
    } catch (e) {
        console.error('Test 1 Error:', e);
    }

    console.log('--- TEST 2: RBAC Unauthorized Role Block ---');
    try {
        // Driver tries to access Team Management
        let req = { user: driverA_User };
        let res = mockRes();
        
        // protect -> authorize('fleet_manager') -> handler
        const rbacMiddleware = authorize('fleet_manager');
        rbacMiddleware(req, res, (err) => {
            if (err && err.statusCode === 403) {
                console.log('Test 2 Passed: Driver cannot access fleet_manager resource.');
            } else {
                console.error('Test 2 Failed: Role check bypassed');
            }
        });
    } catch (e) {
        console.error('Test 2 Error:', e);
    }

    console.log('--- TEST 3: Financial Approval Block ---');
    try {
        let req = { user: driverA_User, params: { id: 'someExpenseId' }, body: { status: 'approved' } };
        let res = mockRes();
        
        const rbacMiddleware = authorize('fleet_manager', 'safety_officer'); // Suppose this is for expense approval
        rbacMiddleware(req, res, (err) => {
            if (err && err.statusCode === 403) {
                console.log('Test 3 Passed: Driver cannot approve expenses.');
            } else {
                console.error('Test 3 Failed');
            }
        });
    } catch (e) {
        console.error('Test 3 Error:', e);
    }

    console.log('--- TEST 4: Input Validation (ObjectId) ---');
    try {
        let req = { user: driverA_User, params: { driverId: 'invalid-id' } };
        let res = mockRes();
        
        await driverPortalController.getDriverProfile(req, res, (err) => {
            if (err && err.statusCode === 403) {
                 // Due to how resolveDriverId handles non-matching driverId and req.user
                 console.log('Test 4 Passed: Handled gracefully without crashing.');
            } else {
                console.error('Test 4 Failed');
            }
        });
    } catch (e) {
        console.error('Test 4 Error:', e);
    }

    // Cleanup
    await User.deleteMany({ email: { $in: ['d1@test.com', 'd2@test.com'] } });
    await Driver.deleteMany({ email: { $in: ['d1@test.com', 'd2@test.com'] } });

    console.log('Phase 10 Tests Complete.');
    process.exit(0);
}

runTests();
