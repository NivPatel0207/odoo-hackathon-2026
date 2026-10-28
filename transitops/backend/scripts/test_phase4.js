const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const FuelLog = require('../models/FuelLog');
const fs = require('fs');
const path = require('path');

const driverController = require('../controllers/driverPortalController');
const fuelExpenseController = require('../controllers/fuelExpenseController');

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
    const defaultVehicle = await Vehicle.create({ name: 'Phase 4 Truck', registrationNumber: 'PH4-' + Date.now(), vehicleType: 'truck', maxLoadCapacity: 1000 });
    const driver = await Driver.create({ name: 'Phase 4 Driver', defaultVehicle: defaultVehicle._id, licenseNumber: 'L4-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '444', paymentAmount: 100, kyc: { aadharNumber: 'AA4' }});
    const driverUser = await User.create({ name: 'Driver 4', email: 'd4' + Date.now() + '@test.com', phone: '444', passwordHash: 'hash', role: 'driver', driverProfileId: driver._id });
    const analystUser = await User.create({ name: 'Analyst', email: 'a4' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'financial_analyst' });

    // TEST 1: Driver submits Fuel Log with Base64 Receipt
    console.log("--- TEST 1: Driver Submits Fuel with Receipt ---");
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    let req = { 
        params: { driverId: driver._id.toString() }, 
        user: driverUser, 
        body: { quantity: 15, cost: 60, station: 'Phase 4 Shell', receiptBase64: sampleBase64 } 
    };
    let res = mockRes();
    
    await driverController.logDriverFuel(req, res, mockNext);
    
    if (res.statusCode !== 201) { 
        console.error("Test 1 Failed: Could not create fuel log"); failed = true; 
    } else {
        const fuel = await FuelLog.findById(res.data.data._id);
        if (fuel.status !== 'pending') {
            console.error("Test 1 Failed: Status is not pending"); failed = true;
        } else if (!fuel.receiptUrl) {
            console.error("Test 1 Failed: receiptUrl not saved"); failed = true;
        } else {
            console.log("Test 1 Passed: Fuel log created, status pending, receiptUrl saved as " + fuel.receiptUrl);
            
            // Check if file physically exists
            const filepath = path.join(__dirname, '..', fuel.receiptUrl);
            if (!fs.existsSync(filepath)) {
                console.error("Test 1 Failed: Physical file not found at " + filepath); failed = true;
            } else {
                console.log("Test 1 Passed: Physical file successfully written.");
            }
        }
    }

    // TEST 2: Analyst Approves Fuel Log
    console.log("--- TEST 2: Analyst Approves Fuel Log ---");
    const fuelLogId = res.data.data._id;
    req = { params: { id: fuelLogId }, user: analystUser, body: { status: 'approved' } };
    res = mockRes();

    await fuelExpenseController.approveFuelLog(req, res, mockNext);
    
    if (!res.data.success) {
        console.error("Test 2 Failed: Analyst could not approve"); failed = true;
    } else {
        const fuel = await FuelLog.findById(fuelLogId);
        if (fuel.status !== 'approved' || fuel.approvedBy.toString() !== analystUser._id.toString()) {
            console.error("Test 2 Failed: Fuel log not correctly approved"); failed = true;
        } else {
            console.log("Test 2 Passed: Fuel log successfully approved by Analyst.");
        }
    }

    // TEST 3: Validation failure on invalid status
    console.log("--- TEST 3: Invalid Approval Status ---");
    req = { params: { id: fuelLogId }, user: analystUser, body: { status: 'weird_status' } };
    res = mockRes();
    
    // Catch the error since we are not using full Express routing here
    let errorThrown = false;
    try {
        await fuelExpenseController.approveFuelLog(req, res, (err) => {
            if (err.message === 'Invalid status') errorThrown = true;
        });
    } catch (err) {
        if (err.message === 'Invalid status') errorThrown = true;
    }
    
    if (res.statusCode === 400 || errorThrown) {
        console.log("Test 3 Passed: Correctly blocked invalid status.");
    } else {
        console.error("Test 3 Failed: Allowed invalid status.", res.statusCode); failed = true;
    }

    // Cleanup
    const finalFuel = await FuelLog.findById(fuelLogId);
    if (finalFuel && finalFuel.receiptUrl) {
        const filepath = path.join(__dirname, '..', finalFuel.receiptUrl);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
    
    await User.deleteMany({ _id: { $in: [driverUser._id, analystUser._id] } });
    await Driver.deleteOne({ _id: driver._id });
    await Vehicle.deleteOne({ _id: defaultVehicle._id });
    await FuelLog.deleteOne({ _id: fuelLogId });

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
