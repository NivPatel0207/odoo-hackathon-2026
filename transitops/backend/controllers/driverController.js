const Driver = require('../models/Driver');
const User = require('../models/User');

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
// @access  Private (safety_officer, fleet_manager)
const createDriver = async (req, res, next) => {
  let driver = null;
  try {
    // 1. Normalize license number to generate Login ID
    const rawLicense = req.body.licenseNumber || '';
    const cleanLicense = rawLicense.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    if (!cleanLicense) {
      return res.status(400).json({ success: false, message: 'Valid license number is required to generate driver login ID' });
    }

    const email = `driver.${cleanLicense}@transitops.com`;
    const tempPassword = 'Transit@2026';

    // 2. Create driver record
    driver = await Driver.create(req.body);

    // 3. Atomically create or link User account for Driver Portal access
    let user = await User.findOne({ email });
    if (user) {
      user.name = driver.name;
      user.phone = req.body.contactNumber || driver.contactNumber || '0000000000';
      user.passwordHash = tempPassword; // Pre-save hook will hash it with cost factor 12
      user.role = 'driver';
      user.status = 'Active';
      user.driverProfileId = driver._id;
      await user.save();
    } else {
      user = await User.create({
        name: driver.name,
        email: email,
        passwordHash: tempPassword,
        role: 'driver',
        phone: req.body.contactNumber || driver.contactNumber || '0000000000',
        driverProfileId: driver._id,
        status: 'Active'
      });
    }

    // 4. Return driver details along with the generated login credentials
    res.status(201).json({ 
      success: true, 
      data: driver,
      credentials: {
        name: driver.name,
        email: email,
        password: tempPassword,
        role: 'driver'
      }
    });
  } catch (err) {
    // Rollback driver creation if user account creation failed
    if (driver && driver._id) {
      try {
        await Driver.findByIdAndDelete(driver._id);
      } catch (cleanupErr) {
        console.error('Failed to rollback driver creation:', cleanupErr);
      }
    }
    next(err);
  }
};

// @desc    Update a driver
// @route   PUT /api/drivers/:id
// @access  Private (safety_officer, fleet_manager)
const updateDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    
    // Sync name and phone with linked user account if updated
    if (req.body.name || req.body.contactNumber) {
      const userUpdate = {};
      if (req.body.name) userUpdate.name = req.body.name;
      if (req.body.contactNumber) userUpdate.phone = req.body.contactNumber;
      await User.updateOne({ driverProfileId: driver._id }, { $set: userUpdate });
    }

    res.json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a driver
// @route   DELETE /api/drivers/:id
// @access  Private (safety_officer, fleet_manager)
const deleteDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    
    // Automatically delete associated user login account to maintain roster integrity
    await User.deleteMany({ driverProfileId: req.params.id });
    
    res.json({ success: true, message: 'Driver and associated user account deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDrivers, getDriver, createDriver, updateDriver, deleteDriver };
