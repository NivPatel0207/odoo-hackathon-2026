const Driver = require('../models/Driver');

// @desc    Get all drivers
// @route   GET /api/drivers
// @access  Private (all roles)
const getDrivers = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const drivers = await Driver.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: drivers.length, data: drivers });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single driver
// @route   GET /api/drivers/:id
// @access  Private (all roles)
const getDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a driver
// @route   POST /api/drivers
// @access  Private (safety_officer only)
const createDriver = async (req, res, next) => {
  try {
    const driver = await Driver.create(req.body);
    res.status(201).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a driver
// @route   PUT /api/drivers/:id
// @access  Private (safety_officer only)
const updateDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a driver
// @route   DELETE /api/drivers/:id
// @access  Private (safety_officer only)
const deleteDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.json({ success: true, message: 'Driver deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDrivers, getDriver, createDriver, updateDriver, deleteDriver };
