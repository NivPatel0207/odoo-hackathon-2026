const express = require('express');
const router = express.Router();
const { getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const { validateVehicle } = require('../validators/entityValidators');

router.route('/')
  .get(protect, cacheMiddleware(300), getVehicles)
  .post(protect, authorize('fleet_manager'), validateVehicle, clearCache('/api/v1/vehicles'), createVehicle);

router.route('/:id')
  .get(protect, cacheMiddleware(300), getVehicle)
  .put(protect, authorize('fleet_manager'), validateVehicle, clearCache('/api/v1/vehicles'), updateVehicle)
  .delete(protect, authorize('fleet_manager'), clearCache('/api/v1/vehicles'), deleteVehicle);

module.exports = router;
