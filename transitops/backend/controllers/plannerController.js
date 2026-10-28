const Event = require('../models/Event');
const Notification = require('../models/Notification');

// @desc    Get all events (filtered by date range)
// @route   GET /api/v1/planner
// @access  Private
const getEvents = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};

    if (startDate && endDate) {
      query = {
        startTime: { $gte: new Date(startDate) },
        endTime: { $lte: new Date(endDate) }
      };
    } else if (startDate) {
      query = { startTime: { $gte: new Date(startDate) } };
    }

    const events = await Event.find(query).sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single event
// @route   GET /api/v1/planner/:id
// @access  Private
const getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: `Event not found with id of ${req.params.id}` });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new event
// @route   POST /api/v1/planner
// @access  Private (Manager only)
const createEvent = async (req, res, next) => {
  try {
    const event = await Event.create(req.body);

    // Broadcast a system-wide notification
    try {
      await Notification.create({
        title: 'New Event Scheduled',
        message: `A new ${event.type} "${event.title}" has been scheduled.`,
        type: 'info'
      });
    } catch (notifErr) {
      console.error('Failed to create notification for event:', notifErr);
    }

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update event
// @route   PUT /api/v1/planner/:id
// @access  Private (Manager only)
const updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: `Event not found with id of ${req.params.id}` });
    }

    event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete event
// @route   DELETE /api/v1/planner/:id
// @access  Private (Manager only)
const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: `Event not found with id of ${req.params.id}` });
    }

    await event.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent
};
