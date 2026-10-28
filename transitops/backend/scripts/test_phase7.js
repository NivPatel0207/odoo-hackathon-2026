const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const DriverDocument = require('../models/DriverDocument');
const fs = require('fs');
const path = require('path');

const driverPortalController = require('../controllers/driverPortalController');
const documentController = require('../controllers/documentController');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.sendFile = (path) => { res.sentFile = path; return res; };
    return res;
};
const mockNext = (err) => { if (err) console.error("NEXT ERR:", err); };

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops-dev', { useNewUrlParser: true, useUnifiedTopology: true });

    let failed = false;

    // 1. Setup
    const driverA = await Driver.create({ name: 'Driver 7A', licenseNumber: 'L7A-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA7A' } });
    const driverB = await Driver.create({ name: 'Driver 7B', licenseNumber: 'L7B-' + Date.now(), licenseCategory: 'A', licenseExpiryDate: new Date(), contactNumber: '555', paymentAmount: 100, kyc: { aadharNumber: 'AA7B' } });
    
    const userA = await User.create({ name: 'User 7A', email: '7a' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverA._id });
    const safetyUser = await User.create({ name: 'Safety Officer 7', email: 'safety7' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'safety_officer' });

    const sampleMedia = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    // TEST 1: Driver A uploads valid document -> ALLOWED
    console.log("--- TEST 1: Driver Upload ---");
    let req = { 
        params: { driverId: driverA._id.toString() }, 
        user: userA, 
        body: { 
            documentType: 'license', 
            issueDate: new Date(Date.now() - 100000).toISOString(), 
            expiryDate: new Date(Date.now() + 100000).toISOString(), 
            mediaBase64: sampleMedia 
        } 
    };
    let res = mockRes();
    await driverPortalController.uploadDriverDocument(req, res, mockNext);
    let docId = null;
    let docPath = null;
    if (res.statusCode === 201) {
        docId = res.data.data._id;
        console.log("Test 1 Passed: Driver A uploaded document.");
        docPath = path.join(__dirname, '..', res.data.data.fileUrl);
    } else {
        console.error("Test 1 Failed: Upload failed.", res.data); failed = true;
    }

    // TEST 2: Driver A attempts upload as Driver B -> BLOCKED
    console.log("--- TEST 2: Driver Upload Cross-Driver Block ---");
    req = { 
        params: { driverId: driverB._id.toString() }, 
        user: userA, 
        body: { documentType: 'license', issueDate: new Date().toISOString(), expiryDate: new Date().toISOString(), mediaBase64: sampleMedia } 
    };
    res = mockRes();
    await driverPortalController.uploadDriverDocument(req, res, mockNext);
    if (res.statusCode === 403) {
        console.log("Test 2 Passed: Driver A blocked from uploading to Driver B.");
    } else {
        console.error("Test 2 Failed.", res.data); failed = true;
    }

    // TEST 3: Issue > Expiry -> BLOCKED
    console.log("--- TEST 3: Date Validation ---");
    req = { 
        params: { driverId: driverA._id.toString() }, 
        user: userA, 
        body: { documentType: 'license', issueDate: new Date(Date.now() + 100000).toISOString(), expiryDate: new Date(Date.now() - 100000).toISOString(), mediaBase64: sampleMedia } 
    };
    res = mockRes();
    await driverPortalController.uploadDriverDocument(req, res, mockNext);
    if (res.statusCode === 400 && res.data.message.includes('after issue date')) {
        console.log("Test 3 Passed: Blocked expiry before issue.");
    } else {
        console.error("Test 3 Failed.", res.data); failed = true;
    }

    // TEST 4: Secure Download - Owner Driver -> ALLOWED, Safety Officer -> ALLOWED, Unrelated Driver -> BLOCKED
    console.log("--- TEST 4: Secure Download Access ---");
    if (docId) {
        // Owner
        req = { params: { id: docId.toString() }, user: userA };
        res = mockRes();
        await documentController.downloadDocument(req, res, mockNext);
        if (res.sentFile) console.log("Test 4a Passed: Owner downloaded.");
        else { console.error("Test 4a Failed."); failed = true; }

        // Safety
        req = { params: { id: docId.toString() }, user: safetyUser };
        res = mockRes();
        await documentController.downloadDocument(req, res, mockNext);
        if (res.sentFile) console.log("Test 4b Passed: Safety downloaded.");
        else { console.error("Test 4b Failed."); failed = true; }

        // Unrelated
        const userB = await User.create({ name: 'User 7B', email: '7b' + Date.now() + '@test.com', phone: '555', passwordHash: 'hash', role: 'driver', driverProfileId: driverB._id });
        req = { params: { id: docId.toString() }, user: userB };
        res = mockRes();
        await documentController.downloadDocument(req, res, mockNext);
        if (res.statusCode === 403) console.log("Test 4c Passed: Unrelated Driver Blocked.");
        else { console.error("Test 4c Failed."); failed = true; }
        await User.deleteOne({ _id: userB._id });
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [userA._id, safetyUser._id] } });
    await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
    if (docId) await DriverDocument.deleteOne({ _id: docId });
    if (docPath && fs.existsSync(docPath)) fs.unlinkSync(docPath);

    mongoose.connection.close();
    if(failed) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    mongoose.connection.close();
    process.exit(1);
});
