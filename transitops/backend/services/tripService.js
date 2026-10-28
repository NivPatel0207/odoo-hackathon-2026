const tripRepository = require('../repositories/tripRepository');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class TripService {
  /**
   * Get paginated and filtered trips
   * @param {Object} query - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Object containing paginated trips and metadata
   */
  async getTrips(query) {
    const { status, search, vehicle, driver, startDate, endDate, priority, page = 1, limit = 100, sort = '-createdAt' } = query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (vehicle) filter.vehicle = vehicle;
    if (driver) filter.driver = driver;
    
    if (search) {
      filter.tripCode = { $regex: search, $options: 'i' };
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const trips = await tripRepository.findTrips(filter, skip, parseInt(limit), sort);
    const total = await tripRepository.countTrips(filter);

    return { 
      count: trips.length, 
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: trips 
    };
  }

  /**
   * Get data for Dispatch Board
   * @returns {Promise<Object>} Object containing unassigned loads, available vehicles, and drivers
   */
  async getDispatchBoard() {
    const unassignedLoads = await tripRepository.findTrips({ status: 'draft', vehicle: { $exists: false } }, 0, 100, 'pickupTime');
    // Also consider draft trips that might just have vehicle=null
    const draftTrips = await tripRepository.findTrips({ status: 'draft' }, 0, 100, 'pickupTime');
    const actualUnassigned = draftTrips.filter(t => !t.vehicle || !t.driver);

    const availableVehicles = await Vehicle.find({ status: 'available' });
    const availableDrivers = await Driver.find({ status: 'available' });

    
    const Trip = require('../models/Trip');
    const activeTrips = await Trip.countDocuments({ status: { $in: ['in_transit', 'loading', 'arrived', 'dispatched'] } });

    return {
      unassignedLoads: actualUnassigned,
      availableVehicles,
      availableDrivers,
      activeTrips
    };
  }

  /**
   * Get a single trip by ID
   * @param {String} id - Trip ID
   * @returns {Promise<Object>} Trip document
   */
  async getTrip(id) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    return trip;
  }

  async _checkSchedulingConflict(vehicleId, driverId, scheduledDate, eta, excludeTripId = null) {
    if (!scheduledDate || !eta) return; // If dates are missing, can't reliably check overlap

    const start = new Date(scheduledDate);
    const end = new Date(eta);
    if (start >= end) throw new Error('ETA must be after the scheduled start date');

    const Trip = require('../models/Trip');
    const query = {
      status: { $nin: ['completed', 'cancelled'] },
      eta: { $exists: true, $ne: null, $gt: start },
      scheduledDate: { $exists: true, $ne: null, $lt: end },
      $or: [
        { vehicle: vehicleId },
        { driver: driverId }
      ]
    };

    if (excludeTripId) {
      query._id = { $ne: excludeTripId };
    }

    const conflicts = await Trip.find(query).limit(1).populate('vehicle').populate('driver');
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      const type = conflict.vehicle._id.toString() === vehicleId.toString() ? 'Vehicle' : 'Driver';
      throw new Error(`Scheduling Conflict: ${type} is already scheduled for Trip ${conflict.tripCode} during this time window`);
    }
  }

  /**
   * Create a new trip
   * @param {Object} data - Trip data
   * @returns {Promise<Object>} Created trip
   */
  async createTrip(data) {
    const { vehicle: vehicleId, driver: driverId, cargoWeight, scheduledDate, eta } = data;

    if (vehicleId) {
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) throw new Error('BR-1: Vehicle not found');
      if (vehicle.status === 'retired') throw new Error('BR-1: Cannot assign a retired vehicle');
      if (vehicle.status !== 'available') throw new Error(`BR-3: Vehicle '${vehicle.name}' is not available`);
      
      if (cargoWeight > vehicle.maxLoadCapacity) {
        throw new Error(`BR-5: Cargo weight (${cargoWeight}kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity}kg)`);
      }
    }

    if (driverId) {
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('BR-2: Driver not found');
      if (driver.status === 'suspended') throw new Error('BR-4: Driver is suspended and cannot be assigned');
      if (driver.status !== 'available') throw new Error(`BR-4: Driver '${driver.name}' is not available`);
      if (driver.licenseExpiryDate && new Date(driver.licenseExpiryDate) < new Date()) {
        throw new Error(`BR-4: Driver '${driver.name}' license has expired and cannot be assigned to a trip`);
      }
    }

    if (vehicleId && driverId) {
      await this._checkSchedulingConflict(vehicleId, driverId, scheduledDate || Date.now(), eta);
    }

    const trip = await tripRepository.createTrip(data);
    
    if (vehicleId) {
      await Vehicle.findByIdAndUpdate(vehicleId, { status: 'draft' });
    }
    if (driverId) {
      await Driver.findByIdAndUpdate(driverId, { status: 'draft' });
    }

    logger.info(`Trip created: ${trip._id}`, { action: 'create_trip', tripId: trip._id });
    return trip;
  }

  /**
   * Dispatch a draft trip
   * @param {String} id - Trip ID
   * @returns {Promise<Object>} Dispatched trip
   */
  async dispatchTrip(id) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    if (trip.status !== 'draft') throw new Error(`Trip is already in '${trip.status}' status. Only draft trips can be dispatched.`);

    const { vehicle, driver } = trip;
    if (vehicle.status !== 'available' && vehicle.status !== 'draft') throw new Error(`BR-3: Vehicle '${vehicle.name}' is not available or draft`);
    if (driver.status !== 'available' && driver.status !== 'draft') throw new Error(`BR-4: Driver '${driver.name}' is not available or draft`);
    
    if (new Date(driver.licenseExpiryDate) < new Date()) {
      throw new Error(`BR-4: Driver '${driver.name}' license has expired`);
    }
    if (trip.cargoWeight && vehicle.maxLoadCapacity && trip.cargoWeight > vehicle.maxLoadCapacity) {
      throw new Error(`BR-5: Cargo weight exceeds capacity`);
    }

    await Vehicle.findByIdAndUpdate(vehicle._id, { status: 'on_trip' });
    await Driver.findByIdAndUpdate(driver._id, { status: 'on_trip' });
    
    trip.status = 'dispatched';
    await tripRepository.saveTrip(trip);
    
    logger.info(`Trip dispatched: ${trip._id}`, { action: 'dispatch_trip', tripId: trip._id });
    return await tripRepository.findTripById(trip._id);
  }

  /**
   * Complete an in-progress trip
   * @param {String} id - Trip ID
   * @param {Object} data - Completion details (distance, fuel, revenue, epod)
   * @returns {Promise<Object>} Completed trip
   */
  async completeTrip(id, { actualDistance, fuelConsumed, revenue, epod }) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    const activeStatuses = ['dispatched', 'in_transit', 'delivered'];
    if (!activeStatuses.includes(trip.status)) throw new Error(`Only active trips can be completed.`);

    const dist = actualDistance || 0;
    const vehicle = await Vehicle.findById(trip.vehicle._id);
    vehicle.status = 'available';
    vehicle.odometer += dist;
    await vehicle.save();

    // Check maintenance
    if (vehicle.nextMaintenanceMileage && vehicle.odometer >= (vehicle.nextMaintenanceMileage - 500)) {
      const Notification = require('../models/Notification');
      await Notification.create({
        title: 'Maintenance Due Soon',
        message: `Vehicle ${vehicle.registrationNumber} is approaching its maintenance mileage.`,
        type: 'warning',
        referenceId: vehicle._id
      });
    }

    await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });

    trip.status = 'completed';
    trip.actualDistance = actualDistance !== undefined ? actualDistance : trip.actualDistance;
    trip.fuelConsumed = fuelConsumed !== undefined ? fuelConsumed : trip.fuelConsumed;
    trip.revenue = revenue !== undefined ? revenue : trip.revenue;
    trip.completedAt = new Date();
    
    if (epod) {
      epod.capturedAt = new Date();
      trip.epod = epod;
    }
    
    await tripRepository.saveTrip(trip);
    
    logger.info(`Trip completed: ${trip._id}`, { action: 'complete_trip', tripId: trip._id });
    return await tripRepository.findTripById(trip._id);
  }

  /**
   * Cancel a trip
   * @param {String} id - Trip ID
   * @returns {Promise<Object>} Cancelled trip
   */
  async cancelTrip(id) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    if (!['draft', 'dispatched'].includes(trip.status)) {
      throw new Error(`Cannot cancel a trip with status '${trip.status}'`);
    }

    if (trip.status === 'dispatched' || trip.status === 'draft') {
      await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'available' });
      await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });
    }

    trip.status = 'cancelled';
    await tripRepository.saveTrip(trip);
    logger.info(`Trip cancelled: ${trip._id}`, { action: 'cancel_trip', tripId: trip._id });
    return trip;
  }

  /**
   * Reject a trip assignment by driver
   * @param {String} id - Trip ID
   * @returns {Promise<Object>} Updated trip in draft status
   */
  async rejectTrip(id) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    if (!['draft', 'assigned'].includes(trip.status)) {
      throw new Error(`Cannot reject a trip with status '${trip.status}'`);
    }

    // Unassign driver only (leave vehicle assigned, but change vehicle status back to available so it's not locked)
    if (trip.vehicle) {
      await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'available' });
    }
    if (trip.driver) {
      await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });
    }
    
    trip.driver = null; // Remove the driver assignment
    trip.status = 'draft';
    await tripRepository.saveTrip(trip);
    
    logger.info(`Trip rejected by driver: ${trip._id}`, { action: 'reject_trip', tripId: trip._id });
    return await tripRepository.findTripById(trip._id);
  }

  /**
   * Submit Pre-Trip Inspection
   * @param {String} id - Trip ID
   * @param {Object} inspectionData - Inspection checklist data
   * @returns {Promise<Object>} Updated trip
   */
  async submitInspection(id, inspectionData) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    if (!['assigned', 'accepted', 'loading'].includes(trip.status)) {
      throw new Error(`Cannot submit inspection for trip with status '${trip.status}'`);
    }

    const { vehicleCondition } = inspectionData;
    const criticalItems = ['brakes', 'tyres', 'engine', 'headlights'];
    
    // Check if any critical item failed
    const failedCritical = criticalItems.filter(item => inspectionData[item] === false);
    
    inspectionData.completedAt = new Date();
    trip.preTripInspection = inspectionData;

    if (vehicleCondition === 'Unsafe' || failedCritical.length > 0) {
      // Inspection failed
      trip.status = 'delayed';
      await tripRepository.saveTrip(trip);
      
      if (trip.vehicle) {
        await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'in_shop' });
      }

      // Create notification
      const Notification = require('../models/Notification');
      await Notification.create({
        title: 'Safety Inspection Failed',
        message: `Vehicle ${trip.vehicle ? trip.vehicle.registrationNumber : 'Unknown'} failed pre-trip inspection for trip ${trip.tripCode}. Critical failures: ${failedCritical.join(', ')}`,
        type: 'error',
        referenceId: trip._id
      });
      
      logger.warn(`Trip inspection failed: ${trip._id}`, { action: 'submit_inspection', tripId: trip._id, failedCritical });
      throw new Error(`Inspection failed. Vehicle grounded due to safety concerns: ${failedCritical.join(', ') || 'Marked Unsafe'}`);
    }

    // Inspection passed
    await tripRepository.saveTrip(trip);
    logger.info(`Trip inspection passed: ${trip._id}`, { action: 'submit_inspection', tripId: trip._id });
    return trip;
  }

  /**
   * Update draft trip details
   * @param {String} id - Trip ID
   * @param {Object} data - Update payload
   * @returns {Promise<Object>} Updated trip
   */
  async updateTrip(id, data) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    if (!['draft', 'assigned', 'pending_approval'].includes(trip.status)) {
      throw new Error('Only draft, assigned, or pending trips can be edited');
    }
    
    const vehicleId = data.vehicle || (trip.vehicle ? trip.vehicle._id : null);
    const driverId = data.driver || (trip.driver ? trip.driver._id : null);
    const scheduledDate = data.scheduledDate || trip.scheduledDate;
    const eta = data.eta || trip.eta;
    
    if (vehicleId && driverId) {
      await this._checkSchedulingConflict(vehicleId, driverId, scheduledDate, eta, id);
    }
    
    const updated = await tripRepository.updateTrip(id, data);
    
    // Sync vehicle and driver statuses (e.g. when assigning an unassigned draft load)
    if ('vehicle' in data) {
      const newVehicleId = data.vehicle ? data.vehicle.toString() : null;
      const oldVehicleId = trip.vehicle ? trip.vehicle._id.toString() : null;
      if (newVehicleId !== oldVehicleId) {
        if (oldVehicleId) await Vehicle.findByIdAndUpdate(oldVehicleId, { status: 'available' });
        if (newVehicleId) await Vehicle.findByIdAndUpdate(newVehicleId, { status: 'draft' });
      }
    }
    
    if ('driver' in data) {
      const newDriverId = data.driver ? data.driver.toString() : null;
      const oldDriverId = trip.driver ? trip.driver._id.toString() : null;
      if (newDriverId !== oldDriverId) {
        if (oldDriverId) await Driver.findByIdAndUpdate(oldDriverId, { status: 'available' });
        if (newDriverId) await Driver.findByIdAndUpdate(newDriverId, { status: 'draft' });
      }
    }

    return updated;
  }

  /**
   * Update trip status directly
   * @param {String} id - Trip ID
   * @param {String} status - New status
   * @returns {Promise<Object>} Updated trip
   */
  async updateTripStatus(id, status) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');

    const { TRIP_STATUSES } = require('../constants');
    if (!TRIP_STATUSES.includes(status)) throw new Error('Invalid status');
    
    // Block terminal → terminal transitions
    if (['completed', 'cancelled'].includes(trip.status)) {
      throw new Error(`Cannot change the status of a finalized trip (current: '${trip.status}')`);
    }

    if (['assigned', 'accepted', 'loading', 'dispatched', 'in_transit', 'arrived', 'delivered'].includes(status)) {
      if (!trip.vehicle || !trip.driver) {
        throw new Error(`Cannot change status to '${status}' without an assigned vehicle and driver.`);
      }
    }

    if (['completed', 'cancelled'].includes(status) && !['completed', 'cancelled'].includes(trip.status)) {
      if (trip.vehicle) await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'available' });
      if (trip.driver) await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });
      if (status === 'completed') trip.completedAt = new Date();
    }
    
    if (trip.status === 'draft' && !['draft', 'completed', 'cancelled'].includes(status)) {
      if (trip.vehicle) await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'on_trip' });
      if (trip.driver) await Driver.findByIdAndUpdate(trip.driver._id, { status: 'on_trip' });
    }

    trip.status = status;
    await tripRepository.saveTrip(trip);
    
    logger.info(`Trip status updated: ${trip._id} to ${status}`, { action: 'update_trip_status', tripId: trip._id });
    return await tripRepository.findTripById(trip._id);
  }
  /**
   * Driver rejects a trip
   * @param {String} id - Trip ID
   * @returns {Promise<Object>} Updated trip
   */
  async rejectTrip(id) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    
    // Only assigned or drafted trips with a driver can be rejected
    if (['assigned', 'accepted'].includes(trip.status) === false && trip.status !== 'draft') {
      throw new Error(`Cannot reject a trip in '${trip.status}' status`);
    }

    if (trip.driver) {
      await Driver.findByIdAndUpdate(trip.driver._id, { status: 'available' });
    }
    if (trip.vehicle) {
      await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'available' });
    }

    trip.driver = undefined; // Unassign driver
    trip.status = 'draft';
    await tripRepository.saveTrip(trip);
    
    logger.info(`Trip rejected by driver: ${trip._id}`, { action: 'reject_trip', tripId: trip._id });
    return await tripRepository.findTripById(trip._id);
  }

  /**
   * Submit pre-trip inspection
   * @param {String} id - Trip ID
   * @param {Object} inspectionData - Inspection details
   * @returns {Promise<Object>} Updated trip
   */
  async submitInspection(id, inspectionData) {
    const trip = await tripRepository.findTripById(id);
    if (!trip) throw new Error('Trip not found');
    
    if (trip.status !== 'loading' && trip.status !== 'dispatched') {
      throw new Error(`Cannot submit inspection for a trip in '${trip.status}' status. Trip must be loading or dispatched.`);
    }

    const isUnsafe = inspectionData.vehicleCondition === 'Unsafe';
    const hasCriticalFailures = !inspectionData.brakes || !inspectionData.engine || !inspectionData.tyres || !inspectionData.headlights;

    const inspection = {
      ...inspectionData,
      inspectedAt: new Date(),
      status: (isUnsafe || hasCriticalFailures) ? 'Failed' : 'Passed'
    };

    trip.preTripInspection = inspection;

    if (inspection.status === 'Failed') {
      // Ground the vehicle
      if (trip.vehicle) {
        await Vehicle.findByIdAndUpdate(trip.vehicle._id, { status: 'in_shop' });
        
        const Notification = require('../models/Notification');
        await Notification.create({
          title: 'Safety Alert: Vehicle Grounded',
          message: `Vehicle ${trip.vehicle.registrationNumber} failed pre-trip inspection for Trip ${trip.tripCode}. Marked as in_shop.`,
          type: 'error',
          referenceId: trip.vehicle._id
        });
      }
      
      trip.status = 'delayed';
      await tripRepository.saveTrip(trip);
      throw new Error(`Inspection failed. Vehicle grounded due to safety concerns.`);
    }

    await tripRepository.saveTrip(trip);
    logger.info(`Trip inspection passed: ${trip._id}`, { action: 'submit_inspection', tripId: trip._id });
    return await tripRepository.findTripById(trip._id);
  }
}

module.exports = new TripService();
