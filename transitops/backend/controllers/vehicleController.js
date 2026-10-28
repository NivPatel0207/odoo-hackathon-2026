const Vehicle = require('../models/Vehicle');
const BaseRepository = require('../repositories/baseRepository');
const BaseService = require('../services/baseService');
const auditLog = require('../utils/auditLogger');

// Instantiate Repository and Service for Vehicle
const vehicleRepo = new BaseRepository(Vehicle);
const vehicleService = new BaseService(vehicleRepo);

// @desc    Get all vehicles (with pagination/filtering)
// @route   GET /api/vehicles
// @access  Private
const getVehicles = async (req, res, next) => {
  try {
    const result = await vehicleService.getAll(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Private
const getVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.getById(req.params.id);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    if (err.message === 'Resource not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
};

// @desc    Create a vehicle
// @route   POST /api/vehicles
// @access  Private (Fleet Manager)
const createVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.create(req.body);
    await auditLog('CREATE', 'Vehicle', vehicle._id, req.user ? req.user.id : null, req.body);
    res.status(201).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (Fleet Manager)
const updateVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.update(req.params.id, req.body);
    await auditLog('UPDATE', 'Vehicle', vehicle._id, req.user ? req.user.id : null, req.body);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    if (err.message === 'Resource not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
};

// @desc    Delete a vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private (Fleet Manager)
const deleteVehicle = async (req, res, next) => {
  try {
    await vehicleService.delete(req.params.id);
    await auditLog('DELETE', 'Vehicle', req.params.id, req.user ? req.user.id : null, {});
    res.json({ success: true, message: 'Vehicle removed' });
  } catch (err) {
    if (err.message === 'Resource not found') return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
