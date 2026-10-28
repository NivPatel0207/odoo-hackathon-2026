const express = require('express');
const router = express.Router();
const { getEvents, getEvent, createEvent, updateEvent, deleteEvent } = require('../controllers/plannerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validateEvent } = require('../validators/entityValidators');

router.route('/')
  .get(protect, getEvents)
  .post(protect, authorize('fleet_manager'), validateEvent, createEvent);

router.route('/:id')
  .get(protect, getEvent)
  .put(protect, authorize('fleet_manager'), validateEvent, updateEvent)
  .delete(protect, authorize('fleet_manager'), deleteEvent);

module.exports = router;
