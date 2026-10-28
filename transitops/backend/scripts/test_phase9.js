const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const Incident = require('../models/Incident');
const Notification = require('../models/Notification');
const DriverDocument = require('../models/DriverDocument');

const driverPortalController = require('../controllers/driverPortalController');
const notificationController = require('../controllers/notificationController');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};
const mockNext = (res) => (err) => { 
    if (err) {
        res.statusCode = err.statusCode || 500;
        res.data = { success: false, message: err.message };
    }
};

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops-dev', { useNewUrlParser: true, useUnifiedTopology: true });

    let failed = false;

    // 1. Setup
    const driverA = await Driver.create({ name: 'Driver 9A', contactNumber: '555', licenseCategory: 'A', licenseExpiryDate: new Date(), licenseNumber: 'L9A-' + Date.now(), safetyScore: 100, paymentAmount: 100, kyc: { aadharNumber: 'AA9A' } });
    const driverB = await Driver.create({ name: 'Driver 9B', contactNumber: '555', licenseCategory: 'A', licenseExpiryDate: new Date(), licenseNumber: 'L9B-' + Date.now(), safetyScore: 100, paymentAmount: 100, kyc: { aadharNumber: 'AA9B' } });
    const userA = await User.create({ name: 'User 9A', email: '9a' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });
    
    // Create actual Trips and Incidents for Driver A
    await Trip.create({ tripCode: 'TRP9A-1-' + Date.now(), driver: driverA._id, source: 'A', destination: 'B', cargoWeight: 100, status: 'completed' });
    await Trip.create({ tripCode: 'TRP9A-2-' + Date.now(), driver: driverA._id, source: 'B', destination: 'C', cargoWeight: 100, status: 'delayed' });
    await Incident.create({ driver: driverA._id, type: 'accident', severity: 'high', location: 'X', description: 'Y' });

    // TEST 1: Driver Performance Metrics & Security
    console.log("--- TEST 1: Performance KPIs ---");
    let req = { params: { driverId: driverA._id.toString() }, user: userA };
    let res = mockRes();
    await driverPortalController.getDriverPerformance(req, res, mockNext(res));
    
    if (res.statusCode === 200 && res.data.data) {
        const perf = res.data.data;
        if (perf.trips.total === 2 && perf.trips.completed === 1 && perf.trips.delayed === 1) {
            // Formula: 100 - (1 incident * 10) - (1 delayed * 5) = 85
            if (perf.safetyScore === 85) {
                console.log("Test 1 Passed: KPIs correctly calculated dynamically.");
            } else {
                console.error("Test 1 Failed: Formula incorrect. Got:", perf.safetyScore); failed = true;
            }
        } else {
            console.error("Test 1 Failed: Trip counts incorrect.", perf.trips); failed = true;
        }
    } else {
        console.error("Test 1 Failed: Could not get performance.", res.data); failed = true;
    }

    // TEST 2: Performance Cross-Driver
    console.log("--- TEST 2: Performance Security ---");
    req = { params: { driverId: driverB._id.toString() }, user: userA };
    res = mockRes();
    await driverPortalController.getDriverPerformance(req, res, mockNext(res));
    if (res.statusCode === 403) console.log("Test 2 Passed: Cross-driver block works.");
    else { console.error("Test 2 Failed.", res.data); failed = true; }

    // TEST 3: Notifications / Lazy Expiry Check
    console.log("--- TEST 3: Notification & Document Expiry ---");
    const expiringDoc = await DriverDocument.create({
        driver: driverA._id,
        documentType: 'license',
        fileUrl: '/fake/path.png',
        issueDate: new Date(Date.now() - 365*24*60*60*1000),
        expiryDate: new Date(Date.now() + 5*24*60*60*1000) // Expires in 5 days
    });

    req = { user: userA };
    res = mockRes();
    await notificationController.getNotifications(req, res, mockNext(res));
    
    console.log("Docs found:", res.data.data.length, "Req User ID:", userA._id);
    if (res.data && res.data.success && res.data.data.length >= 1) {
        const warningNotif = res.data.data.find(n => n.referenceId && n.referenceId.toString() === expiringDoc._id.toString());
        if (warningNotif) {
            console.log("Test 3 Passed: Document expiry lazy notification created.");
            
            // TEST 4: Idempotency (running again shouldn't create duplicates)
            res = mockRes();
            await notificationController.getNotifications(req, res, mockNext(res));
            const dupeCheck = res.data.data.filter(n => n.referenceId.toString() === expiringDoc._id.toString());
            if (dupeCheck.length === 1) {
                console.log("Test 4 Passed: Duplicate notification correctly prevented.");
                
                // TEST 5: Mark as Read Security
                req = { params: { id: warningNotif._id.toString() }, user: userA };
                res = mockRes();
                await notificationController.markAsRead(req, res, mockNext(res));
                if (res.data && res.data.success) {
                    console.log("Test 5 Passed: Marked as read.");
                } else {
                    console.error("Test 5 Failed."); failed = true;
                }
            } else {
                console.error("Test 4 Failed: Idempotency failed. Duplicates generated.", dupeCheck.length); failed = true;
            }
        } else {
            console.error("Test 3 Failed: Warning not found.", res.data); failed = true;
        }
    } else {
        console.error("Test 3 Failed.", res.data); failed = true;
    }

    // Cleanup
    await User.deleteMany({ _id: userA._id });
    await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
    await Trip.deleteMany({ driver: driverA._id });
    await Incident.deleteMany({ driver: driverA._id });
    await DriverDocument.deleteMany({ driver: driverA._id });
    await Notification.deleteMany({ userId: userA._id });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
