const express = require('express');
const router = express.Router();
const { getTrips, getDispatchBoard, getTrip, createTrip, updateTrip, dispatchTrip, completeTrip, cancelTrip, rejectTrip, submitInspection, updateTripStatus } = require('../controllers/tripController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const { validateTrip } = require('../validators/entityValidators');

const dispatcherOrManager = authorize('dispatcher', 'fleet_manager');
const dispatcherManagerOrDriver = authorize('dispatcher', 'fleet_manager', 'driver');

router.route('/')
  .get(protect, getTrips)
  .post(protect, dispatcherOrManager, validateTrip, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), createTrip);

router.get('/dispatch-board', protect, dispatcherOrManager, getDispatchBoard);

router.route('/:id')
  .get(protect, getTrip)
  .put(protect, dispatcherOrManager, validateTrip, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), updateTrip);

router.put('/:id/dispatch', protect, dispatcherOrManager, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), dispatchTrip);
router.put('/:id/complete', protect, dispatcherManagerOrDriver, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), completeTrip);
router.put('/:id/cancel', protect, dispatcherOrManager, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), cancelTrip);
router.put('/:id/reject', protect, dispatcherManagerOrDriver, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), rejectTrip);
router.post('/:id/inspection', protect, dispatcherManagerOrDriver, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), submitInspection);
router.put('/:id/status', protect, dispatcherManagerOrDriver, clearCache('/api/v1/vehicles'), clearCache('/api/v1/drivers'), updateTripStatus);

module.exports = router;
