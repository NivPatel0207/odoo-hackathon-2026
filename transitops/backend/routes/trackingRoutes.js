const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/live', protect, authorize('fleet_manager', 'dispatcher', 'safety_officer'), trackingController.getLiveTracking);

module.exports = router;
