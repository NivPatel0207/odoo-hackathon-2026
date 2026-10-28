const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const fs = require('fs');
const path = require('path');

const driverController = require('../controllers/driverPortalController');

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
    const vehicle = await Vehicle.create({ name: 'Phase 5 Truck', registrationNumber: 'PH5-' + Date.now(), vehicleType: 'truck', maxLoadCapacity: 1000 });
    const driverA = await Driver.create({ name: 'Driver 5A', licenseNumber: 'L5A-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA5A' }});
    const driverB = await Driver.create({ name: 'Driver 5B', licenseNumber: 'L5B-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA5B' }});
    
    const userA = await User.create({ name: 'User 5A', email: '5a' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });
    const userB = await User.create({ name: 'User 5B', email: '5b' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverB._id });

    const trip = await Trip.create({ tripCode: 'TRIP5-' + Date.now(), source: 'A', destination: 'B', cargoWeight: 10, driver: driverA._id, vehicle: vehicle._id, status: 'in_transit' });

    const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    // TEST 1: Driver B attempts to submit ePOD for Driver A's trip -> Blocked
    console.log("--- TEST 1: Ownership Validation ---");
    let req = { 
        params: { driverId: driverB._id.toString(), tripId: trip._id.toString() }, 
        user: userB, 
        body: { recipientName: 'John', quantityDelivered: 10, condition: 'Good', customerSignature: sampleSignature } 
    };
    let res = mockRes();
    
    let errorThrown = false;
    try {
        await driverController.submitDriverEpod(req, res, (err) => {
            if (err.message.includes('do not own this trip')) errorThrown = true;
        });
    } catch (err) {
        if (err.message.includes('do not own this trip')) errorThrown = true;
    }

    if (errorThrown) {
        console.log("Test 1 Passed: Correctly blocked cross-driver ePOD submission.");
    } else {
        console.error("Test 1 Failed: Allowed Driver B to access Driver A's trip."); failed = true;
    }

    // TEST 2: Driver A submits on 'in_transit' trip -> Blocked
    console.log("--- TEST 2: Status Validation (in_transit) ---");
    req = { 
        params: { driverId: driverA._id.toString(), tripId: trip._id.toString() }, 
        user: userA, 
        body: { recipientName: 'John', quantityDelivered: 10, condition: 'Good', customerSignature: sampleSignature } 
    };
    res = mockRes();
    await driverController.submitDriverEpod(req, res, mockNext);
    if (res.statusCode === 400 && res.data.message.includes('arrived')) {
        console.log("Test 2 Passed: Blocked ePOD because trip is not arrived.");
    } else {
        console.error("Test 2 Failed: Allowed ePOD on in_transit trip."); failed = true;
    }

    // TEST 3: Driver A submits on 'arrived' trip -> Success + File saved
    console.log("--- TEST 3: Successful Submission ---");
    trip.status = 'arrived';
    await trip.save();

    res = mockRes();
    await driverController.submitDriverEpod(req, res, mockNext);
    if (res.statusCode === 200) {
        const updatedTrip = await Trip.findById(trip._id);
        if (updatedTrip.status !== 'delivered') {
            console.error("Test 3 Failed: Trip status not updated to delivered."); failed = true;
        } else if (!updatedTrip.epod.customerSignature.startsWith('/uploads/receipts/')) {
            console.error("Test 3 Failed: Signature URL not saved correctly.", updatedTrip.epod.customerSignature); failed = true;
        } else {
            console.log("Test 3 Passed: ePOD accepted, trip delivered, signature saved as URL.");
            const filepath = path.join(__dirname, '..', updatedTrip.epod.customerSignature);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath); // cleanup
            }
        }
    } else {
        console.error("Test 3 Failed: ePOD submission failed.", res.data); failed = true;
    }

    // TEST 4: Duplicate Submission -> Blocked
    console.log("--- TEST 4: Duplicate/Immutability Validation ---");
    res = mockRes();
    await driverController.submitDriverEpod(req, res, mockNext);
    if (res.statusCode === 400 && res.data.message.includes('arrived')) {
        console.log("Test 4 Passed: Blocked duplicate ePOD on delivered trip.");
    } else {
        console.error("Test 4 Failed: Allowed duplicate ePOD."); failed = true;
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
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
