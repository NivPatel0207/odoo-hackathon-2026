const express = require('express');
const router = express.Router();
const { getMaintenance, getMaintenanceById, createMaintenance, closeMaintenance, updateMaintenance } = require('../controllers/maintenanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const managerOrSafety = authorize('fleet_manager', 'safety_officer');

router.route('/')
  .get(protect, getMaintenance)
  .post(protect, managerOrSafety, createMaintenance);

router.route('/:id')
  .get(protect, getMaintenanceById)
  .put(protect, managerOrSafety, updateMaintenance);

router.put('/:id/close', protect, managerOrSafety, closeMaintenance);

module.exports = router;
