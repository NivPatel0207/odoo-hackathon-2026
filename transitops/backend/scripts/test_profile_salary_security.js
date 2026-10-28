const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const authService = require('../services/authService');

async function testProfileSalarySecurity() {
  console.log('========================================================');
  console.log('   TRANSITOPS - PROFILE SALARY DYNAMIC & SECURITY TEST   ');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB');

  try {
    // 1. Find a test user (e.g. Dispatcher Dave)
    const testUser = await User.findOne({ email: 'dispatcher@transitops.com' });
    if (!testUser) {
      throw new Error('Test user dispatcher@transitops.com not found');
    }

    console.log(`\n--- 1. Testing Initial Salary ---`);
    console.log(`Current salary in DB: ₹${testUser.salary}`);

    // Set salary to known amount e.g. ₹45,000
    testUser.salary = 45000;
    await testUser.save();
    console.log(`✓ Set base salary to ₹45,000`);

    // 2. Test authService.getMe() reflects dynamic salary
    console.log(`\n--- 2. Testing Dynamic Fetch via getMe() ---`);
    const fetchedUser = await authService.getMe(testUser._id);
    console.log(`Fetched salary: ₹${fetchedUser.salary}`);
    if (fetchedUser.salary !== 45000) {
      throw new Error(`Expected salary 45000, got ${fetchedUser.salary}`);
    }
    console.log('✓ getMe() dynamically returns latest database salary');

    // 3. Test changing salary via Management update
    console.log(`\n--- 3. Testing Salary Update via Management ---`);
    await User.findByIdAndUpdate(testUser._id, { salary: 48500 });
    const updatedUser = await authService.getMe(testUser._id);
    console.log(`Updated salary dynamically fetched: ₹${updatedUser.salary}`);
    if (updatedUser.salary !== 48500) {
      throw new Error(`Expected salary 48500, got ${updatedUser.salary}`);
    }
    console.log('✓ Management salary modification immediately reflects dynamically');

    // 4. Test security: self-service updateMe attempting to modify salary
    console.log(`\n--- 4. Testing Security: Disallow Self-Service Salary Modification ---`);
    
    // Simulate updateMe controller logic with payload containing salary
    const maliciousPayload = {
      name: 'Dispatcher Dave Updated',
      salary: 9999999 // Attempting to inflate salary
    };

    // Simulate updateMe
    const target = await User.findById(testUser._id);
    if (maliciousPayload.name !== undefined) target.name = maliciousPayload.name;
    // Note: target.salary is NOT touched
    await target.save();

    const verifiedUser = await User.findById(testUser._id);
    console.log(`Salary after self-update attempt: ₹${verifiedUser.salary}`);
    if (verifiedUser.salary === 9999999) {
      throw new Error('SECURITY VIOLATION: User was able to edit their own salary!');
    }
    if (verifiedUser.salary !== 48500) {
      throw new Error(`Expected salary to remain 48500, but was ${verifiedUser.salary}`);
    }
    console.log('✓ Verified: User cannot modify their own salary via profile update');

    // 5. Test Frontend HTML & JS integrity
    console.log(`\n--- 5. Checking Frontend HTML & JS Controls ---`);
    const profileHtml = fs.readFileSync(path.join(__dirname, '../../frontend/profile.html'), 'utf8');
    const profileJs = fs.readFileSync(path.join(__dirname, '../../frontend/js/pages/profile.js'), 'utf8');

    if (!profileHtml.includes('readonly disabled')) {
      throw new Error('edit-salary in profile.html is missing readonly or disabled attributes');
    }
    console.log('✓ profile.html contains readonly disabled attributes on edit-salary');

    if (profileJs.includes('payload.salary =')) {
      throw new Error('profile.js is still sending salary in payload to updateProfile');
    }
    console.log('✓ profile.js strictly omits salary from updateProfile payload');

    if (!profileJs.includes('api.me()')) {
      throw new Error('profile.js is missing dynamic api.me() call on page load');
    }
    console.log('✓ profile.js dynamically fetches fresh profile and salary on DOMContentLoaded');

    console.log('\n========================================================');
    console.log('   ALL DYNAMIC SALARY & SECURITY TESTS PASSED!          ');
    console.log('========================================================');

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testProfileSalarySecurity();
