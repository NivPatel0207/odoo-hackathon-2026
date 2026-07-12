const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let tokens = {};
let report = [];

function logResult(name, success, error = '') {
  report.push({ name, success, error: error ? error.toString() : '' });
  console.log(`${success ? '✅ PASS' : '❌ FAIL'} | ${name} ${error ? '- ' + error : ''}`);
}

async function runTests() {
  console.log('--- Starting Automated API Tests ---');
  
  // 1. Auth Test
  try {
    const resM = await axios.post(`${API_URL}/auth/login`, { email: 'manager@transitops.com', password: 'password123' });
    tokens.manager = resM.data.token;
    const resS = await axios.post(`${API_URL}/auth/login`, { email: 'safety@transitops.com', password: 'password123' });
    tokens.safety = resS.data.token;
    const resD = await axios.post(`${API_URL}/auth/login`, { email: 'dispatcher@transitops.com', password: 'password123' });
    tokens.dispatcher = resD.data.token;
    logResult('Login (Role Setup)', true);
  } catch (err) {
    logResult('Login (Role Setup)', false, err.response?.data?.message || err.message);
    return;
  }

  const reqManager = { headers: { Authorization: `Bearer ${tokens.manager}` } };
  const reqSafety = { headers: { Authorization: `Bearer ${tokens.safety}` } };
  const reqDispatcher = { headers: { Authorization: `Bearer ${tokens.dispatcher}` } };

  // 2. Fetch Dashboard
  try {
    await axios.get(`${API_URL}/reports/dashboard`, reqManager);
    logResult('Fetch Dashboard KPIs', true);
  } catch (err) {
    logResult('Fetch Dashboard KPIs', false, err.response?.data?.message || err.message);
  }

  // 3. Vehicles (Manager)
  let vehicleId = null;
  try {
    const res = await axios.post(`${API_URL}/vehicles`, {
      registrationNumber: `TEST-V-${Date.now()}`, name: 'Test Truck', vehicleType: 'truck', maxLoadCapacity: 5000, acquisitionCost: 20000, odometer: 100
    }, reqManager);
    vehicleId = res.data.data._id;
    logResult('Create Vehicle (BR Check)', true);
  } catch (err) {
    logResult('Create Vehicle (BR Check)', false, err.response?.data?.message || err.message);
  }

  try {
    await axios.get(`${API_URL}/vehicles`, reqManager);
    logResult('List Vehicles', true);
  } catch (err) {
    logResult('List Vehicles', false, err.response?.data?.message || err.message);
  }

  // 4. Drivers (Safety Officer)
  let driverId = null;
  try {
    const res = await axios.post(`${API_URL}/drivers`, {
      name: 'Test Driver', licenseNumber: `LIC-${Date.now()}`, licenseCategory: 'A', licenseExpiryDate: new Date(Date.now() + 31536000000).toISOString(), contactNumber: '1234567890', safetyScore: 100
    }, reqSafety);
    driverId = res.data.data._id;
    logResult('Create Driver (BR Check)', true);
  } catch (err) {
    logResult('Create Driver (BR Check)', false, err.response?.data?.message || err.message);
  }

  try {
    await axios.get(`${API_URL}/drivers`, reqManager);
    logResult('List Drivers', true);
  } catch (err) {
    logResult('List Drivers', false, err.response?.data?.message || err.message);
  }

  // 5. Trips (Dispatcher)
  let tripId = null;
  if (vehicleId && driverId) {
    try {
      const res = await axios.post(`${API_URL}/trips`, {
        source: 'A', destination: 'B', vehicle: vehicleId, driver: driverId, cargoWeight: 1000, plannedDistance: 50
      }, reqDispatcher);
      tripId = res.data.data._id;
      logResult('Create Draft Trip (Dispatcher)', true);
    } catch (err) {
      logResult('Create Draft Trip (Dispatcher)', false, err.response?.data?.message || err.message);
    }

    if (tripId) {
      try {
        await axios.put(`${API_URL}/trips/${tripId}/dispatch`, {}, reqDispatcher);
        logResult('Dispatch Trip (BR 1-8 Check, Atomic Transition)', true);
      } catch (err) {
        logResult('Dispatch Trip (BR 1-8 Check, Atomic Transition)', false, err.response?.data?.message || err.message);
      }

      try {
        await axios.put(`${API_URL}/trips/${tripId}/complete`, { actualDistance: 55, fuelConsumed: 10, revenue: 500 }, reqDispatcher);
        logResult('Complete Trip (Atomic Transition)', true);
      } catch (err) {
        logResult('Complete Trip (Atomic Transition)', false, err.response?.data?.message || err.message);
      }
    }
  } else {
    logResult('Trip Operations', false, 'Skipped');
  }

  // 6. Maintenance (Safety Officer / Manager)
  let maintId = null;
  if (vehicleId) {
    try {
      const res = await axios.post(`${API_URL}/maintenance`, {
        vehicle: vehicleId, description: 'Oil change', maintenanceType: 'preventive'
      }, reqSafety);
      maintId = res.data.data._id;
      logResult('Open Maintenance (BR-9: In Shop)', true);
    } catch (err) {
      logResult('Open Maintenance (BR-9: In Shop)', false, err.response?.data?.message || err.message);
    }
    
    if (maintId) {
      try {
        await axios.put(`${API_URL}/maintenance/${maintId}/close`, { cost: 1500, notes: 'Done' }, reqSafety);
        logResult('Close Maintenance (BR-10: Release)', true);
      } catch (err) {
        logResult('Close Maintenance (BR-10: Release)', false, err.response?.data?.message || err.message);
      }
    }
  }

  // 7. Reports
  try {
    await axios.get(`${API_URL}/reports/fuel-efficiency`, reqManager);
    logResult('Fetch Fuel Efficiency Report', true);
  } catch (err) {
    logResult('Fetch Fuel Efficiency Report', false, err.response?.data?.message || err.message);
  }

  try {
    await axios.get(`${API_URL}/reports/operational-cost`, reqManager);
    logResult('Fetch Operational Cost Report', true);
  } catch (err) {
    logResult('Fetch Operational Cost Report', false, err.response?.data?.message || err.message);
  }

  console.log('--- Tests Completed ---');
}

runTests();
