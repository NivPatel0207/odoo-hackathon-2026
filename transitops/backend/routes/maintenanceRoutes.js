const express = require('express');
const router = express.Router();
const { getMaintenance, getMaintenanceById, createMaintenance, closeMaintenance, updateMaintenance } = require('../controllers/maintenanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validateMaintenance } = require('../validators/entityValidators');

const managerOrSafety = authorize('fleet_manager', 'safety_officer');

router.route('/')
  .get(protect, getMaintenance)
  .post(protect, managerOrSafety, validateMaintenance, createMaintenance);

router.route('/:id')
  .get(protect, getMaintenanceById)
  .put(protect, managerOrSafety, validateMaintenance, updateMaintenance);

router.put('/:id/close', protect, managerOrSafety, closeMaintenance);

module.exports = router;
