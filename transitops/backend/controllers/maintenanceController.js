const Maintenance = require('../models/Maintenance');
const Vehicle = require('../models/Vehicle');

// @desc    Get all maintenance records
// @route   GET /api/maintenance
// @access  Private (all roles)
const getMaintenance = async (req, res, next) => {
  try {
    const { status, vehicle } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (vehicle) filter.vehicle = vehicle;
    const records = await Maintenance.find(filter)
      .populate('vehicle', 'name registrationNumber status')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single maintenance record
// @route   GET /api/maintenance/:id
// @access  Private (all roles)
const getMaintenanceById = async (req, res, next) => {
  try {
    const record = await Maintenance.findById(req.params.id).populate('vehicle');
    if (!record) return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

// @desc    Create maintenance record
// @route   POST /api/maintenance
// @access  Private (fleet_manager, safety_officer)
// BR-9: Creating a maintenance record sets vehicle status to 'in_shop'
const createMaintenance = async (req, res, next) => {
  try {
    const { vehicle: vehicleId } = req.body;
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    // BR-9: Cannot open maintenance if vehicle is on a trip
    if (vehicle.status === 'on_trip') {
      return res.status(400).json({
        success: false,
        message: `BR-9: Vehicle '${vehicle.name}' is currently on a trip. Cannot open maintenance record.`
      });
    }
    if (vehicle.status === 'retired') {
      return res.status(400).json({
        success: false,
        message: `BR-9: Vehicle '${vehicle.name}' is retired. Cannot open maintenance record.`
      });
    }

    const record = await Maintenance.create(req.body);

    // BR-9: Set vehicle status to 'in_shop'
    await Vehicle.findByIdAndUpdate(vehicleId, { status: 'in_shop' });

    res.status(201).json({ success: true, message: 'Maintenance record created. Vehicle status set to in_shop.', data: record });
  } catch (err) {
    next(err);
  }
};

// @desc    Close maintenance record
// @route   PUT /api/maintenance/:id/close
// @access  Private (fleet_manager, safety_officer)
// BR-10: Closing a maintenance record restores vehicle to 'available' (unless retired)
const closeMaintenance = async (req, res, next) => {
  try {
    const record = await Maintenance.findById(req.params.id).populate('vehicle');
    if (!record) return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    if (record.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Maintenance record is already closed' });
    }

    const { cost, notes } = req.body;
    record.status = 'closed';
    record.dateEnd = new Date();
    if (cost !== undefined) record.cost = cost;
    if (notes) record.notes = notes;
    await record.save();

    // BR-10: Restore vehicle status to 'available' unless it was retired
    const vehicle = await Vehicle.findById(record.vehicle._id);
    if (vehicle && vehicle.status !== 'retired') {
      await Vehicle.findByIdAndUpdate(vehicle._id, { status: 'available' });
    }

    res.json({ success: true, message: 'Maintenance closed. Vehicle restored to available.', data: record });
  } catch (err) {
    next(err);
  }
};

// @desc    Update maintenance record
// @route   PUT /api/maintenance/:id
// @access  Private (fleet_manager, safety_officer)
const updateMaintenance = async (req, res, next) => {
  try {
    const record = await Maintenance.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('vehicle');
    if (!record) return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMaintenance, getMaintenanceById, createMaintenance, closeMaintenance, updateMaintenance };
