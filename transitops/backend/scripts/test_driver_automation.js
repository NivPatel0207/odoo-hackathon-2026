const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Driver = require('../models/Driver');
const User = require('../models/User');
const driverController = require('../controllers/driverController');
const authController = require('../controllers/authController');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) { this.statusCode = code; return this; };
  res.json = function (data) { this.data = data; return this; };
  return res;
};

const mockNext = (err) => { if (err) throw err; };

async function runTest() {
  console.log('========================================================');
  console.log('  TRANSITOPS - DRIVER CREDENTIAL AUTOMATION TEST SUITE  ');
  console.log('========================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/transitops';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  const rawLicense = 'DL04 20260098765';
  const expectedEmail = 'driver.dl0420260098765@transitops.com';
  const expectedPassword = 'Transit@2026';

  // Cleanup any leftover test data
  await User.deleteMany({ email: expectedEmail });
  await Driver.deleteMany({ licenseNumber: rawLicense });

  console.log('\n--- TEST 1: Driver Creation & Automatic Credential Generation ---');
  const createReq = {
    body: {
      name: 'Ramesh Automation Kumar',
      licenseNumber: rawLicense,
      licenseCategory: 'C',
      licenseExpiryDate: '2030-05-15',
      contactNumber: '+91 9876543210',
      safetyScore: 85,
      paymentType: 'monthly',
      paymentAmount: 28000,
      kyc: {
        aadharNumber: '1234 5678 9012',
        aadharVerified: true
      }
    }
  };

  const createRes = mockRes();
  await driverController.createDriver(createReq, createRes, mockNext);

  if (createRes.statusCode !== 201) {
    throw new Error(`Expected HTTP 201, got ${createRes.statusCode}: ${JSON.stringify(createRes.data)}`);
  }

  const createdDriver = createRes.data.data;
  const credentials = createRes.data.credentials;

  console.log('Driver Created ID:', createdDriver._id);
  console.log('Generated Credentials:', credentials);

  if (!credentials) {
    throw new Error('Response payload did not contain credentials object!');
  }
  if (credentials.email !== expectedEmail) {
    throw new Error(`Expected login ID "${expectedEmail}", got "${credentials.email}"`);
  }
  if (credentials.password !== expectedPassword) {
    throw new Error(`Expected password "${expectedPassword}", got "${credentials.password}"`);
  }
  console.log('✓ Login ID automatically normalized from license number: ' + credentials.email);
  console.log('✓ Temporary password matches format: ' + credentials.password);

  console.log('\n--- TEST 2: User Account Model & Linkage in Database ---');
  const linkedUser = await User.findOne({ email: expectedEmail });
  if (!linkedUser) {
    throw new Error(`User account for "${expectedEmail}" was not found in MongoDB!`);
  }
  if (linkedUser.role !== 'driver') {
    throw new Error(`Expected user role "driver", got "${linkedUser.role}"`);
  }
  if (!linkedUser.driverProfileId || linkedUser.driverProfileId.toString() !== createdDriver._id.toString()) {
    throw new Error(`driverProfileId mismatch! Expected ${createdDriver._id}, got ${linkedUser.driverProfileId}`);
  }
  console.log('✓ Linked User record created in MongoDB with role "driver" and driverProfileId');

  console.log('\n--- TEST 3: Driver Portal Login Authentication ---');
  const loginReq = {
    body: {
      email: expectedEmail,
      password: expectedPassword
    }
  };
  const loginRes = mockRes();
  await authController.login(loginReq, loginRes, mockNext);

  if (loginRes.statusCode !== 200 || !loginRes.data.token) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${JSON.stringify(loginRes.data)}`);
  }
  console.log('✓ Successfully authenticated driver using generated email and password!');
  console.log('  JWT Token received:', loginRes.data.token.substring(0, 25) + '...');
  console.log('  Authenticated user role:', loginRes.data.user.role);

  console.log('\n--- TEST 4: Cascading Deletion of Linked User Account ---');
  const deleteReq = { params: { id: createdDriver._id.toString() } };
  const deleteRes = mockRes();
  await driverController.deleteDriver(deleteReq, deleteRes, mockNext);

  const checkDriver = await Driver.findById(createdDriver._id);
  const checkUser = await User.findOne({ email: expectedEmail });

  if (checkDriver) {
    throw new Error('Driver document was not deleted!');
  }
  if (checkUser) {
    throw new Error('Associated User document was not cascadingly deleted!');
  }
  console.log('✓ Deleting driver successfully deleted both the Driver profile and linked User account');

  console.log('\n========================================================');
  console.log('  ALL AUTOMATION TESTS PASSED SUCCESSFULLY! (4/4)       ');
  console.log('========================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ Test Failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
