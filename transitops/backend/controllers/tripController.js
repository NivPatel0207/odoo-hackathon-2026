const tripService = require('../services/tripService');
const auditLog = require('../utils/auditLogger');

const getTrips = async (req, res, next) => {
  try {
    const query = { ...req.query };
    if (req.user && req.user.role === 'driver') {
      query.driver = req.user.driverProfileId;
    }
    const result = await tripService.getTrips(query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400);
    next(err);
  }
};

const getDispatchBoard = async (req, res, next) => {
  try {
    const data = await tripService.getDispatchBoard();
    res.json({ success: true, data });
  } catch (err) {
    res.status(400);
    next(err);
  }
};

const getTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTrip(req.params.id);
    res.json({ success: true, data: trip });
  } catch (err) {
    err.statusCode = 404;
    next(err);
  }
};

const createTrip = async (req, res, next) => {
  try {
    const trip = await tripService.createTrip(req.body);
    await auditLog('CREATE', 'Trip', trip._id, req.user ? req.user.id : null, req.body);
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const dispatchTrip = async (req, res, next) => {
  try {
    const trip = await tripService.dispatchTrip(req.params.id);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, { status: 'dispatched' });
    res.json({ success: true, message: 'Trip dispatched successfully', data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const completeTrip = async (req, res, next) => {
  try {
    const trip = await tripService.completeTrip(req.params.id, req.body);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, { status: 'completed', ...req.body });
    res.json({ success: true, message: 'Trip completed successfully', data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const cancelTrip = async (req, res, next) => {
  try {
    const trip = await tripService.cancelTrip(req.params.id);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, { status: 'cancelled' });
    res.json({ success: true, message: 'Trip cancelled', data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const updateTrip = async (req, res, next) => {
  try {
    const trip = await tripService.updateTrip(req.params.id, req.body);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, req.body);
    res.json({ success: true, data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const updateTripStatus = async (req, res, next) => {
  try {
    const trip = await tripService.updateTripStatus(req.params.id, req.body.status);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, { status: req.body.status });
    res.json({ success: true, message: 'Trip status updated', data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const rejectTrip = async (req, res, next) => {
  try {
    const trip = await tripService.rejectTrip(req.params.id);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, { status: 'draft', action: 'driver_rejected' });
    res.json({ success: true, message: 'Trip rejected by driver', data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

const submitInspection = async (req, res, next) => {
  try {
    const trip = await tripService.submitInspection(req.params.id, req.body);
    await auditLog('UPDATE', 'Trip', trip._id, req.user ? req.user.id : null, { action: 'inspection_submitted' });
    res.json({ success: true, message: 'Inspection submitted successfully', data: trip });
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
};

module.exports = { getTrips, getDispatchBoard, getTrip, createTrip, updateTrip, dispatchTrip, completeTrip, cancelTrip, rejectTrip, submitInspection, updateTripStatus };
