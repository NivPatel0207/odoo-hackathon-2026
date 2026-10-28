const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Driver = require('../models/Driver');
const Settlement = require('../models/Settlement');
const payrollController = require('../controllers/payrollController');
const driverPortalController = require('../controllers/driverPortalController');

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
  console.log('   TRANSITOPS - COMPANY-WIDE PAYROLL VERIFICATION TEST  ');
  console.log('========================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/transitops';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // 1. Seed realistic salaries for staff members
  console.log('\n--- 1. Initializing Staff Salaries ---');
  await User.updateOne({ email: 'manager@transitops.com' }, { $set: { salary: 65000, department: 'Operations' } });
  await User.updateOne({ email: 'dispatcher@transitops.com' }, { $set: { salary: 45000, department: 'Dispatch' } });
  await User.updateOne({ email: 'safety@transitops.com' }, { $set: { salary: 50000, department: 'Safety & Compliance' } });
  await User.updateOne({ email: 'analyst@transitops.com' }, { $set: { salary: 55000, department: 'Finance' } });
  console.log('✓ Configured baseline monthly salaries for Operations, Dispatch, Safety, and Finance');

  const managerUser = await User.findOne({ email: 'manager@transitops.com' });
  const dispatcherUser = await User.findOne({ email: 'dispatcher@transitops.com' });
  let testDriver = await Driver.findOne({ status: { $ne: 'retired' } });
  if (!testDriver) {
    testDriver = await Driver.create({
      name: 'Ravi Kumar',
      licenseNumber: 'TEST-LIC-9988',
      licenseCategory: 'A',
      licenseExpiryDate: new Date('2030-01-01'),
      contactNumber: '9876543210',
      status: 'available',
      paymentType: 'per_trip',
      paymentAmount: 5000,
      kyc: { aadharNumber: '123456789012', aadharVerified: true }
    });
    console.log('✓ Created test driver for payroll verification');
  }
  console.log(`✓ Active driver identified: "${testDriver.name}" (ID: ${testDriver._id})`);

  // 2. Test Summary Endpoint
  console.log('\n--- 2. Testing Payroll Summary Metrics ---');
  const summaryRes = mockRes();
  await payrollController.getPayrollSummary({}, summaryRes, mockNext);
  console.log('Summary Metrics Output:', summaryRes.data.data);
  if (typeof summaryRes.data.data.pendingTotal !== 'number') {
    throw new Error('Invalid pendingTotal metric in summary');
  }
  console.log('✓ Payroll summary successfully aggregated pending salaries');

  // 3. Test Roster Endpoint
  console.log('\n--- 3. Testing Unified Roster Generation ---');
  const rosterRes = mockRes();
  await payrollController.getPayrollRoster({}, rosterRes, mockNext);
  console.log(`✓ Roster returned ${rosterRes.data.data.staff.length} staff members and ${rosterRes.data.data.drivers.length} drivers`);

  // 4. Test Single Staff Salary Disbursement
  console.log('\n--- 4. Disbursing Monthly Salary to Staff Member (Dispatcher Dave) ---');
  const staffDisburseReq = {
    user: managerUser,
    body: {
      beneficiaryType: 'staff',
      memberId: dispatcherUser._id.toString(),
      basePay: 45000,
      bonus: 2500,
      deductions: 500,
      paymentMethod: 'bank_transfer',
      transactionRef: 'SAL-TEST-001',
      notes: 'Monthly salary + Performance bonus'
    }
  };
  const staffDisburseRes = mockRes();
  await payrollController.disbursePayout(staffDisburseReq, staffDisburseRes, mockNext);

  if (staffDisburseRes.statusCode !== 201) {
    throw new Error(`Expected HTTP 201 from disbursePayout, got ${staffDisburseRes.statusCode}`);
  }
  console.log('Disbursed Staff Salary Result:', staffDisburseRes.data.message);
  console.log('Net Disbursed:', staffDisburseRes.data.data.netPay); // 45000 + 2500 - 500 = 47000

  // 5. Test Single Driver Payout Disbursement
  console.log(`\n--- 5. Disbursing Payout to Driver (${testDriver.name}) ---`);
  const driverDisburseReq = {
    user: managerUser,
    body: {
      beneficiaryType: 'driver',
      memberId: testDriver._id.toString(),
      basePay: 5000,
      bonus: 500,
      deductions: 200,
      paymentMethod: 'upi',
      transactionRef: 'UPI-DRV-TEST-002',
      notes: 'Trip settlement payout'
    }
  };
  const driverDisburseRes = mockRes();
  await payrollController.disbursePayout(driverDisburseReq, driverDisburseRes, mockNext);

  if (driverDisburseRes.statusCode !== 201) {
    throw new Error(`Expected HTTP 201 from driver disbursePayout, got ${driverDisburseRes.statusCode}`);
  }
  console.log('Disbursed Driver Settlement Result:', driverDisburseRes.data.message);
  console.log('Net Disbursed:', driverDisburseRes.data.data.netPay); // 5000 + 500 - 200 = 5300

  // 6. Verify Reflection on Driver Portal Earnings Page
  console.log('\n--- 6. Verifying Reflection on Driver Portal Earnings & Settlement History ---');
  const driverReq = {
    user: { role: 'driver', driverProfileId: testDriver._id.toString() },
    params: { driverId: testDriver._id.toString() }
  };
  const historyRes = mockRes();
  await driverPortalController.getSettlementHistory(driverReq, historyRes, mockNext);

  console.log('Driver Portal Total Earned (All Time):', historyRes.data.data.totalEarnedAllTime);
  console.log('Driver Settlement History Count:', historyRes.data.data.history.length);

  if (historyRes.data.data.history.length === 0) {
    throw new Error('Driver settlement history did not record the disbursed payment!');
  }
  console.log('✓ Driver portal successfully receives and displays the disbursed settlement!');

  // 7. Verify Audit Ledger History
  console.log('\n--- 7. Verifying Master Audit Ledger ---');
  const masterHistoryRes = mockRes();
  await payrollController.getPayrollHistory({ query: {} }, masterHistoryRes, mockNext);
  console.log(`✓ Master Payroll Ledger contains ${masterHistoryRes.data.count} paid transaction records`);

  console.log('\n========================================================');
  console.log('   ALL PAYROLL & SALARY TESTS PASSED (7/7)!             ');
  console.log('========================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ Payroll Test Failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
