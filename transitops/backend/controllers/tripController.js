const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');

// @desc    Get all trips
// @route   GET /api/trips
// @access  Private (all roles)
const getTrips = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const trips = await Trip.find(filter)
      .populate('vehicle', 'name registrationNumber vehicleType status')
      .populate('driver', 'name licenseNumber status safetyScore')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: trips.length, data: trips });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single trip
// @route   GET /api/trips/:id
// @access  Private (all roles)
const getTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('vehicle')
      .populate('driver');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    res.json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a trip (status = draft)
// @route   POST /api/trips
// @access  Private (dispatcher, fleet_manager)
const createTrip = async (req, res, next) => {
  try {
    const { vehicle: vehicleId, driver: driverId, cargoWeight } = req.body;

    // BR-1: Vehicle must exist and not be retired
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'BR-1: Vehicle not found' });
    if (vehicle.status === 'retired') {
      return res.status(400).json({ success: false, message: 'BR-1: Cannot assign a retired vehicle' });
    }

    // BR-2: Driver must exist
    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'BR-2: Driver not found' });

    // BR-5: Cargo weight must not exceed vehicle capacity
    if (cargoWeight > vehicle.maxLoadCapacity) {
      return res.status(400).json({
        success: false,
        message: `BR-5: Cargo weight (${cargoWeight}kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity}kg)`
      });
    }

    const trip = await Trip.create(req.body);
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    next(err);
  }
};

// @desc    Dispatch a trip (draft -> dispatched)
// @route   PUT /api/trips/:id/dispatch
// @access  Private (dispatcher, fleet_manager)
const dispatchTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle').populate('driver');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    // Can only dispatch from draft
    if (trip.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Trip is already in '${trip.status}' status. Only draft trips can be dispatched.` });
    }

    const vehicle = trip.vehicle;
    const driver = trip.driver;

    // BR-3: Vehicle must be 'available'
    if (vehicle.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `BR-3: Vehicle '${vehicle.name}' is currently '${vehicle.status}', not available for dispatch`
      });
    }

    // BR-4: Driver must be 'available' and not 'suspended'
    if (driver.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `BR-4: Driver '${driver.name}' is currently '${driver.status}', not available for dispatch`
      });
    }

    // BR-4b: Driver license must not be expired
    const today = new Date();
    if (new Date(driver.licenseExpiryDate) < today) {
      return res.status(400).json({
        success: false,
        message: `BR-4: Driver '${driver.name}' license has expired on ${new Date(driver.licenseExpiryDate).toDateString()}. Renewal required before dispatch.`
      });
    }

    // BR-5: Re-validate cargo weight at dispatch time
    if (trip.cargoWeight > vehicle.maxLoadCapacity) {
      return res.status(400).json({
        success: false,
        message: `BR-5: Cargo weight (${trip.cargoWeight}kg) exceeds vehicle max capacity (${vehicle.maxLoadCapacity}kg)`
      });
    }

    // BR-6: Atomically set vehicle & driver to 'on_trip' and update trip status
    await Vehicle.findByIdAndUpdate(vehicle._id, { status: 'on_trip' });
    await Driver.findByIdAndUpdate(driver._id, { status: 'on_trip' });
    trip.status = 'dispatched';
    await trip.save();

    const updatedTrip = await Trip.findById(trip._id).populate('vehicle').populate('driver');
    res.json({ success: true, message: 'Trip dispatched successfully', data: updatedTrip });
  } catch (err) {
    next(err);
  }
};

// @desc    Complete a trip (dispatched -> completed)
// @route   PUT /api/trips/:id/complete
// @access  Private (dispatcher, fleet_manager)
const completeTrip = async (req, res, next) => {
  try {
    const { actualDistance, fuelConsumed, revenue } = req.body;
    const trip = await Trip.findById(req.params.id).populate('vehicle').populate('driver');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    if (trip.status !== 'dispatched') {
      return res.status(400).json({ success: false, message: `Only dispatched trips can be completed. Current status: '${trip.status}'` });
    }

    // BR-7: Release vehicle and driver back to 'available'
    await Vehicle.findByIdAndUpdate(trip.vehicle._id, {
      status: 'available',
      $inc: { odometer: actualDistance || 0 }
    });
    await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });

    trip.status = 'completed';
    trip.actualDistance = actualDistance || trip.actualDistance;
    trip.fuelConsumed = fuelConsumed || trip.fuelConsumed;
    trip.revenue = revenue || trip.revenue;
    trip.completedAt = new Date();
    await trip.save();

    const updatedTrip = await Trip.findById(trip._id).populate('vehicle').populate('driver');
    res.json({ success: true, message: 'Trip completed successfully', data: updatedTrip });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel a trip (draft or dispatched -> cancelled)
// @route   PUT /api/trips/:id/cancel
// @access  Private (dispatcher, fleet_manager)
const cancelTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle').populate('driver');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    if (!['draft', 'dispatched'].includes(trip.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a trip with status '${trip.status}'` });
    }

    // BR-8: If dispatched, release vehicle and driver
    if (trip.status === 'dispatched') {
      await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'available' });
      await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });
    }

    trip.status = 'cancelled';
    await trip.save();

    res.json({ success: true, message: 'Trip cancelled', data: trip });
  } catch (err) {
    next(err);
  }
};

// @desc    Update trip details (only draft trips)
// @route   PUT /api/trips/:id
// @access  Private (dispatcher, fleet_manager)
const updateTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    if (trip.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft trips can be edited' });
    }
    const updated = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('vehicle').populate('driver');
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTrips, getTrip, createTrip, updateTrip, dispatchTrip, completeTrip, cancelTrip };
