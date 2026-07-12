const express = require('express');
const router = express.Router();
const { getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.route('/')
  .get(protect, getVehicles)
  .post(protect, authorize('fleet_manager'), createVehicle);

router.route('/:id')
  .get(protect, getVehicle)
  .put(protect, authorize('fleet_manager'), updateVehicle)
  .delete(protect, authorize('fleet_manager'), deleteVehicle);

module.exports = router;
