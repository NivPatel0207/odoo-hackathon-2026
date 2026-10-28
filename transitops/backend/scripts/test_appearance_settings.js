const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const { updateProfileSchema } = require('../validators/authValidator');
const authController = require('../controllers/authController');

const mockRes = () => {
  const res = {};
  res.status = function (code) { this.statusCode = code; return this; };
  res.json = function (data) { this.data = data; return this; };
  return res;
};

const mockNext = (err) => { if (err) throw err; };

async function runTest() {
  console.log('--- 1. Testing Zod Validation Schema ---');
  const payload = {
    theme: 'light',
    accentColor: 'blue',
    density: 'compact',
    fontSize: 'large',
    animations: false,
    sidebarState: 'collapsed'
  };

  const parsed = updateProfileSchema.parse({ body: payload });
  console.log('Parsed payload:', parsed.body);
  
  if (
    parsed.body.theme === 'light' &&
    parsed.body.accentColor === 'blue' &&
    parsed.body.density === 'compact' &&
    parsed.body.fontSize === 'large' &&
    parsed.body.animations === false &&
    parsed.body.sidebarState === 'collapsed'
  ) {
    console.log('✓ Zod Schema successfully preserved all Appearance fields!');
  } else {
    throw new Error('Zod Schema stripped or modified Appearance fields!');
  }

  console.log('\n--- 2. Testing Database Persistence ---');
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/transitops';
  await mongoose.connect(mongoUri);

  const testEmail = 'appearance_test_' + Date.now() + '@transitops.com';
  const testUser = await User.create({
    name: 'Appearance Tester',
    email: testEmail,
    phone: '9876543210',
    passwordHash: 'password123',
    role: 'fleet_manager'
  });

  // Verify default appearance
  console.log('Initial user appearance in DB:', {
    theme: testUser.theme,
    accentColor: testUser.accentColor,
    density: testUser.density,
    fontSize: testUser.fontSize,
    animations: testUser.animations,
    sidebarState: testUser.sidebarState
  });

  // Simulate PUT /api/v1/auth/me request
  const req = {
    user: { id: testUser._id.toString() },
    body: payload
  };
  const res = mockRes();

  await authController.updateMe(req, res, mockNext);
  console.log('updateMe returned status/data success:', res.data.success);
  console.log('Returned appearance in response:', {
    theme: res.data.data.theme,
    accentColor: res.data.data.accentColor,
    density: res.data.data.density,
    fontSize: res.data.data.fontSize,
    animations: res.data.data.animations,
    sidebarState: res.data.data.sidebarState
  });

  // Fetch directly from MongoDB to guarantee persistence
  const reloaded = await User.findById(testUser._id);
  console.log('Reloaded from DB:', {
    theme: reloaded.theme,
    accentColor: reloaded.accentColor,
    density: reloaded.density,
    fontSize: reloaded.fontSize,
    animations: reloaded.animations,
    sidebarState: reloaded.sidebarState
  });

  if (
    reloaded.theme === 'light' &&
    reloaded.accentColor === 'blue' &&
    reloaded.density === 'compact' &&
    reloaded.fontSize === 'large' &&
    reloaded.animations === false &&
    reloaded.sidebarState === 'collapsed'
  ) {
    console.log('✓ Verified: MongoDB successfully saved and persisted the Appearance preferences!');
  } else {
    throw new Error('Persistence check failed in MongoDB!');
  }

  // Cleanup
  await User.deleteOne({ _id: testUser._id });
  await mongoose.connection.close();
  console.log('\nAll Appearance tests passed successfully!');
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  if (mongoose.connection.readyState !== 0) mongoose.connection.close();
  process.exit(1);
});
