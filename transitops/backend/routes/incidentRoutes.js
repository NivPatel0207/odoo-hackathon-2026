const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('fleet_manager', 'safety_officer'), incidentController.getIncidents);
router.get('/driver/:driverId', protect, incidentController.getDriverIncidents);
router.put('/:id/investigate', protect, authorize('fleet_manager', 'safety_officer'), incidentController.investigateIncident);
router.put('/:id/resolve', protect, authorize('fleet_manager', 'safety_officer'), incidentController.resolveIncident);

module.exports = router;
