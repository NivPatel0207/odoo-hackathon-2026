const express = require('express');
const router = express.Router();
const { getDrivers, getDriver, createDriver, updateDriver, deleteDriver } = require('../controllers/driverController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.route('/')
  .get(protect, getDrivers)
  .post(protect, authorize('safety_officer'), createDriver);

router.route('/:id')
  .get(protect, getDriver)
  .put(protect, authorize('safety_officer'), updateDriver)
  .delete(protect, authorize('safety_officer'), deleteDriver);

module.exports = router;
