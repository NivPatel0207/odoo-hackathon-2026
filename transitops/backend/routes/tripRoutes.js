const express = require('express');
const router = express.Router();
const { getTrips, getTrip, createTrip, updateTrip, dispatchTrip, completeTrip, cancelTrip } = require('../controllers/tripController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const dispatcherOrManager = authorize('dispatcher', 'fleet_manager');

router.route('/')
  .get(protect, getTrips)
  .post(protect, dispatcherOrManager, createTrip);

router.route('/:id')
  .get(protect, getTrip)
  .put(protect, dispatcherOrManager, updateTrip);

router.put('/:id/dispatch', protect, dispatcherOrManager, dispatchTrip);
router.put('/:id/complete', protect, dispatcherOrManager, completeTrip);
router.put('/:id/cancel', protect, dispatcherOrManager, cancelTrip);

module.exports = router;
