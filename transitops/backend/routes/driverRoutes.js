const express = require('express');
const router = express.Router();
const { getDrivers, getDriver, createDriver, updateDriver, deleteDriver } = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const { validateDriver } = require('../validators/entityValidators');

router.route('/')
  .get(protect, cacheMiddleware(300), getDrivers)
  .post(protect, authorize('safety_officer', 'fleet_manager'), validateDriver, clearCache('/api/v1/drivers'), clearCache('/api/v1/reports'), createDriver);

router.route('/:id')
  .get(protect, cacheMiddleware(300), getDriver)
  .put(protect, authorize('safety_officer', 'fleet_manager'), validateDriver, clearCache('/api/v1/drivers'), clearCache('/api/v1/reports'), updateDriver)
  .delete(protect, authorize('safety_officer', 'fleet_manager'), clearCache('/api/v1/drivers'), clearCache('/api/v1/reports'), deleteDriver);

module.exports = router;
