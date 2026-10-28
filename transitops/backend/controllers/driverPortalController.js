const DriverLog = require('../models/DriverLog');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const tripService = require('../services/tripService');


const resolveDriverId = (req) => {
  let id = req.params.driverId;
  if (id === 'me') {
    if (req.user.role !== 'driver') {
      const err = new Error('Only drivers can use /me routes');
      err.statusCode = 403;
      throw err;
    }
    return req.user.driverProfileId;
  }
  if (req.user && req.user.role === 'driver') {
    if (id !== req.user.driverProfileId?.toString()) {
      const err = new Error('Access denied: You can only access your own data');
      err.statusCode = 403;
      throw err;
    }
    return req.user.driverProfileId;
  }
  return id;
};

// Helper to get active vehicle for driver

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function saveReceiptBase64(base64Str) {
  if (!base64Str) return null;
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const ext = matches[1].split('/')[1] || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = crypto.randomUUID() + '.' + ext;
    const filepath = path.join(__dirname, '../uploads/receipts', filename);
    fs.writeFileSync(filepath, buffer);
    return '/uploads/receipts/' + filename;
  } catch (err) {
    console.error('Failed to save receipt:', err);
    return null;
  }
}

const getActiveVehicleForDriver = async (driverId) => {
  // Phase 3 Hybrid Logic: Try active trip first
  const activeTrip = await Trip.findOne({ 
    driver: driverId, 
    status: { $nin: ['completed', 'cancelled', 'draft'] } 
  }).populate('vehicle').sort({ createdAt: -1 });
  
  if (activeTrip && activeTrip.vehicle) {
    // If trip exists, augment with source=trip flag if needed
    return activeTrip.vehicle;
  }
  
  // Fall back to default vehicle
  const driver = await Driver.findById(driverId).populate('defaultVehicle');
  if (driver && driver.defaultVehicle) {
    return driver.defaultVehicle;
  }
  
  return null;
};

// Get ELD status for a driver
exports.getEldStatus = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    
    // Get current active log
    const activeLog = await DriverLog.findOne({ driver: driverId, endTime: { $exists: false } }).sort({ startTime: -1 });
    
    // Get today's logs to calculate hours
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todaysLogs = await DriverLog.find({
      driver: driverId,
      startTime: { $gte: startOfDay }
    });
    
    let drivingMinutes = 0;
    let onDutyMinutes = 0;
    
    todaysLogs.forEach(log => {
      const end = log.endTime || new Date();
      const duration = (end - log.startTime) / 60000;
      if (log.status === 'DRIVING') drivingMinutes += duration;
      if (['DRIVING', 'ON_DUTY'].includes(log.status)) onDutyMinutes += duration;
    });

    res.status(200).json({
      success: true,
      data: {
        currentStatus: activeLog ? activeLog.status : 'OFF_DUTY',
        activeLog,
        metrics: {
          drivingMinutes,
          onDutyMinutes,
          // FMCSA Standard: 11 hours (660 mins) driving, 14 hours (840 mins) on duty
          remainingDrivingMinutes: Math.max(0, 660 - drivingMinutes),
          remainingOnDutyMinutes: Math.max(0, 840 - onDutyMinutes)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Change ELD status
exports.changeEldStatus = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { status, location, vehicle } = req.body;
    
    // Close active log if any
    const activeLog = await DriverLog.findOne({ driver: driverId, endTime: { $exists: false } });
    
    if (activeLog) {
      if (activeLog.status === status) {
        return res.status(400).json({ success: false, message: 'Driver is already in this status' });
      }
      activeLog.endTime = new Date();
      activeLog.durationMinutes = (activeLog.endTime - activeLog.startTime) / 60000;
      await activeLog.save();
    }
    
    // Create new log
    const newLog = await DriverLog.create({
      driver: driverId,
      status,
      location,
      vehicle,
      startTime: new Date()
    });
    
    res.status(200).json({
      success: true,
      data: newLog
    });
  } catch (error) {
    next(error);
  }
};

// Get pending settlement for driver
exports.getPendingSettlement = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    
    const driver = await Driver.findById(driverId);
    if (!driver) throw new Error('Driver not found');
    
    // Find trips completed but not yet settled
    const allPaid = await Settlement.find({ driver: driverId, status: 'paid' });
    const settledTripIds = new Set(allPaid.flatMap(s => (s.trips || []).map(t => t.toString())));

    const completedTrips = await Trip.find({ 
      driver: driverId, 
      status: 'completed',
      _id: { $nin: Array.from(settledTripIds) }
    }).sort({ completedAt: -1 });
    
    // If driver payment rate is unset or 0, default to per_trip with ₹2,500/trip
    if (!driver.paymentAmount || driver.paymentAmount === 0) {
      driver.paymentAmount = 2500;
      driver.paymentType = driver.paymentType || 'per_trip';
      await driver.save();
    }

    let basePay = 0;
    
    if (driver.paymentType === 'per_trip') {
      basePay = completedTrips.length * (driver.paymentAmount || 2500);
    } else {
      // Monthly - check if already paid this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const paidThisMonth = allPaid.some(s => new Date(s.paidAt || s.createdAt) >= startOfMonth);
      basePay = paidThisMonth ? 0 : (driver.paymentAmount || 0);
    }
    
    res.status(200).json({
      success: true,
      data: {
        driver: {
          name: driver.name,
          paymentType: driver.paymentType,
          paymentAmount: driver.paymentAmount
        },
        pendingTrips: completedTrips.length,
        trips: completedTrips,
        estimatedPay: basePay,
        netPay: basePay,
        basePay: basePay
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get historical paid settlements
exports.getSettlementHistory = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);

    const Settlement = require('../models/Settlement');
    const history = await Settlement.find({ driver: driverId, status: 'paid' }).sort({ periodEnd: -1 });

    const totalEarnedAllTime = history.reduce((sum, s) => sum + s.netPay, 0);

    res.status(200).json({
      success: true,
      data: {
        totalEarnedAllTime,
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get aggregated dashboard data for driver
exports.getDashboardData = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    
    const driver = await Driver.findById(driverId);
    if (!driver) throw new Error('Driver not found');

    // 1. Fetch Trips (Active, Upcoming, Completed)
    const allTrips = await Trip.find({ driver: driverId })
                               .populate('vehicle')
                               .sort({ createdAt: -1 });

    const activeStatuses = ['assigned', 'accepted', 'loading', 'dispatched', 'in_transit', 'arrived', 'delayed'];
    const activeTripRaw = allTrips.find(t => activeStatuses.includes(t.status));
    
    // 2. Strip sensitive financial data
    const stripFinancials = (trip) => {
      if (!trip) return null;
      const t = trip.toObject();
      delete t.rate;
      delete t.revenue;
      delete t.rateType;
      return t;
    };

    const activeTrip = stripFinancials(activeTripRaw);
    const upcomingTrips = allTrips.filter(t => t.status === 'draft' || t.status === 'assigned')
                                  .filter(t => !activeTripRaw || t._id.toString() !== activeTripRaw._id.toString())
                                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                                  .slice(0, 5)
                                  .map(stripFinancials);
    const completedTripsCount = allTrips.filter(t => t.status === 'completed').length;

    // 3. ELD Metrics
    const activeLog = await DriverLog.findOne({ driver: driverId, endTime: { $exists: false } }).sort({ startTime: -1 });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaysLogs = await DriverLog.find({ driver: driverId, startTime: { $gte: startOfDay } });
    
    let drivingMinutes = 0;
    let onDutyMinutes = 0;
    todaysLogs.forEach(log => {
      const end = log.endTime || new Date();
      const duration = (end - log.startTime) / 60000;
      if (log.status === 'DRIVING') drivingMinutes += duration;
      if (['DRIVING', 'ON_DUTY'].includes(log.status)) onDutyMinutes += duration;
    });

    const eldStatus = {
      currentStatus: activeLog ? activeLog.status : 'OFF_DUTY',
      metrics: {
        drivingMinutes,
        onDutyMinutes,
        remainingDrivingMinutes: Math.max(0, 660 - drivingMinutes)
      }
    };

    // 4. Vehicle info
    let assignedVehicle = null;
    if (activeTrip && activeTrip.vehicle) {
      assignedVehicle = {
        _id: activeTrip.vehicle._id,
        registrationNumber: activeTrip.vehicle.registrationNumber,
        make: activeTrip.vehicle.make,
        model: activeTrip.vehicle.model,
        status: activeTrip.vehicle.status
      };
    } else if (driver.defaultVehicle) {
      const Vehicle = require('../models/Vehicle');
      const v = await Vehicle.findById(driver.defaultVehicle);
      if (v) {
        assignedVehicle = {
          _id: v._id,
          registrationNumber: v.registrationNumber,
          make: v.make,
          model: v.model,
          status: v.status
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        driver: {
          _id: driver._id,
          name: driver.name,
          safetyScore: driver.safetyScore || 100,
          status: driver.status,
          licenseCategory: driver.licenseCategory,
          licenseExpiryDate: driver.licenseExpiryDate,
          kycVerified: Boolean(driver.kyc && driver.kyc.aadharVerified)
        },
        activeTrip,
        upcomingTrips,
        completedTripsCount,
        eldStatus,
        assignedVehicle
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- DRIVER TRIP MANAGEMENT ---

const stripFinancials = (trip) => {
  if (!trip) return null;
  const t = typeof trip.toObject === 'function' ? trip.toObject() : { ...trip };
  delete t.rate;
  delete t.revenue;
  delete t.rateType;
  return t;
};

const verifyTripOwnership = async (tripId, driverId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error('Trip not found');
  if (trip.driver && trip.driver.toString() !== driverId.toString()) {
    throw new Error('Access denied: You do not own this trip');
  }
  return trip;
};

exports.getDriverTrips = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const trips = await Trip.find({ driver: driverId }).populate('vehicle').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: trips.map(stripFinancials)
    });
  } catch (error) {
    next(error);
  }
};

exports.getDriverTripDetails = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId).populate('vehicle');
    if (!trip || trip.driver.toString() !== driverId) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }
    res.status(200).json({
      success: true,
      data: stripFinancials(trip)
    });
  } catch (error) {
    next(error);
  }
};

exports.updateDriverTripStatus = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    const { status } = req.body;
    
    const tripRecord = await verifyTripOwnership(tripId, driverId);
    
    if (req.user && req.user.role === 'driver') {
      const validDriverTransitions = {
        'assigned': ['accepted', 'rejected'],
        'accepted': ['loading', 'in_transit'],
        'loading': ['in_transit'],
        'in_transit': ['arrived'],
        'arrived': ['delivered'] // Though normally delivered is reached via EPOD
      };
      
      const allowed = validDriverTransitions[tripRecord.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid transition from '${tripRecord.status}' to '${status}'` });
      }
    }

    const trip = await tripService.updateTripStatus(tripId, status);
    res.status(200).json({ success: true, message: 'Status updated', data: stripFinancials(trip) });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

exports.completeDriverTrip = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'driver') {
      return res.status(403).json({ success: false, message: 'Drivers are not allowed to force complete trips. Please submit ePOD.' });
    }
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    await verifyTripOwnership(tripId, driverId);
    
    const completionData = { ...req.body };
    delete completionData.revenue;

    const trip = await tripService.completeTrip(tripId, completionData);
    res.status(200).json({ success: true, message: 'Trip completed', data: stripFinancials(trip) });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

exports.rejectDriverTrip = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    await verifyTripOwnership(tripId, driverId);
    
    const trip = await tripService.rejectTrip(tripId);
    res.status(200).json({ success: true, message: 'Trip rejected', data: stripFinancials(trip) });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

exports.submitDriverInspection = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    await verifyTripOwnership(tripId, driverId);
    
    const trip = await tripService.submitInspection(tripId, req.body);
    res.status(200).json({ success: true, message: 'Inspection submitted', data: stripFinancials(trip) });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

exports.submitDriverEpod = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    const { recipientName, quantityDelivered, condition, customerSignature, deliveryPhoto } = req.body;
    
    const trip = await verifyTripOwnership(tripId, driverId);
    
    if (trip.status !== 'arrived') {
      return res.status(400).json({ success: false, message: 'EPOD can only be submitted when the trip is arrived' });
    }

    const signatureUrl = saveReceiptBase64(customerSignature);
    const photoUrl = saveReceiptBase64(deliveryPhoto);

    trip.epod = {
      recipientName,
      quantityDelivered,
      condition,
      customerSignature: signatureUrl || customerSignature, // Fallback if save fails
      deliveryPhoto: photoUrl || deliveryPhoto,
      capturedAt: new Date()
    };
    
    // Automatically mark the trip as delivered when EPOD is submitted
    trip.status = 'delivered';
    
    await trip.save();
    
    res.status(200).json({ success: true, message: 'EPOD submitted successfully', data: stripFinancials(trip) });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

exports.reportDriverDelay = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { tripId } = req.params;
    const { reason, description } = req.body;
    
    const trip = await verifyTripOwnership(tripId, driverId);
    
    if (['completed', 'cancelled', 'draft'].includes(trip.status)) {
      return res.status(400).json({ success: false, message: 'Cannot report delay on this trip' });
    }

    const noteEntry = `[Delay Reported: ${reason}] ${description || ''}`;
    
    const updatedNotes = trip.notes ? `${trip.notes}\n${noteEntry}` : noteEntry;
    
    // We update the trip status to 'delayed' and append notes
    // Using tripRepository if we had it, but we can just use mongoose
    trip.status = 'delayed';
    trip.notes = updatedNotes;
    await trip.save();
    
    // Create an alert/notification for dispatch
    const Notification = require('../models/Notification');
    await Notification.create({
      title: 'Trip Delayed',
      message: `Driver reported a delay (${reason}) on Trip ${trip.tripCode}.`,
      type: 'warning',
      referenceId: trip._id
    });
    
    res.status(200).json({ success: true, message: 'Delay reported successfully', data: stripFinancials(trip) });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

// --- DRIVER VEHICLE MANAGEMENT ---

exports.getDriverVehicle = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    // Driver model does not have assignedVehicle. Vehicle assignment is handled via Trips.
    // Let's find the driver's active or most recent trip to determine their vehicle.
    const vehicle = await getActiveVehicleForDriver(driverId);

    if (!vehicle) {
      return res.status(200).json({ success: true, data: { vehicle: null, maintenance: [] } });
    }

    const Maintenance = require('../models/Maintenance');
    // Fetch upcoming preventive maintenance or open defects
    const maintenance = await Maintenance.find({
      vehicle: vehicle._id,
      $or: [
        { status: 'open' },
        { maintenanceType: 'preventive', dateStart: { $gte: new Date() } }
      ]
    }).sort({ dateStart: 1 });

    res.status(200).json({
      success: true,
      data: {
        vehicle: vehicle,
        maintenance
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.reportVehicleDefect = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);
    const { description } = req.body;

    const driver = await Driver.findById(driverId);
    const vehicle = await getActiveVehicleForDriver(driverId);
    if (!driver || !vehicle) {
      return res.status(400).json({ success: false, message: 'No vehicle assigned to report a defect for' });
    }

    const Maintenance = require('../models/Maintenance');
    const newDefect = await Maintenance.create({
      vehicle: vehicle._id,
      description: `[Driver Reported Defect] ${description}`,
      maintenanceType: 'corrective',
      status: 'open',
      dateStart: new Date(),
      reportedBy: req.user ? req.user.id : null
    });

    // Create an alert/notification for dispatch/maintenance
    const Notification = require('../models/Notification');
    await Notification.create({
      title: 'Vehicle Defect Reported',
      message: `Driver reported a defect on vehicle ID: ${vehicle._id}`,
      type: 'warning',
      referenceId: newDefect._id
    });

    res.status(200).json({ success: true, message: 'Defect reported successfully', data: newDefect });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

// --- DRIVER FUEL & EXPENSES ---

exports.logDriverFuel = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { date, quantity, cost, station, tripId } = req.body;

    if (req.user && req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const driver = await Driver.findById(driverId);
    const vehicle = await getActiveVehicleForDriver(driverId);
    if (!driver || !vehicle) {
      return res.status(400).json({ success: false, message: 'No vehicle assigned to log fuel against' });
    }

    const FuelLog = require('../models/FuelLog');
    
    if (tripId) {
      const trip = await Trip.findById(tripId);
      if (!trip || trip.driver?.toString() !== driverId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You do not own this trip' });
      }
    }
    const receiptUrl = saveReceiptBase64(req.body.receiptBase64);
    
    const newFuel = await FuelLog.create({
      driver: driverId,
      vehicle: vehicle._id,
      trip: tripId || null,
      date: date || new Date(),
      quantity,
      cost,
      station,
      receiptUrl,
      status: 'pending'
    });

    res.status(201).json({ success: true, message: 'Fuel logged successfully', data: newFuel });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

exports.logDriverExpense = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { expenseType, amount, date, description, tripId } = req.body;

    if (req.user && req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const driver = await Driver.findById(driverId);
    const vehicle = await getActiveVehicleForDriver(driverId);
    if (!driver || !vehicle) {
      return res.status(400).json({ success: false, message: 'No vehicle assigned to log expenses against' });
    }

    const Expense = require('../models/Expense');
    
    if (tripId) {
      const trip = await Trip.findById(tripId);
      if (!trip || trip.driver?.toString() !== driverId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You do not own this trip' });
      }
    }
    const receiptUrl = saveReceiptBase64(req.body.receiptBase64);

    const newExpense = await Expense.create({
      driver: driverId,
      vehicle: vehicle._id,
      trip: tripId || null,
      expenseType,
      amount,
      date: date || new Date(),
      description,
      receiptUrl,
      status: 'pending'
    });

    res.status(201).json({ success: true, message: 'Expense logged successfully', data: newExpense });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

// --- DRIVER INCIDENTS (EMERGENCY) ---

exports.reportDriverIncident = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { incidentType, severity, location, description, tripId, mediaBase64 } = req.body;

    if (req.user && req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const driver = await Driver.findById(driverId);
    const vehicle = await getActiveVehicleForDriver(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Vehicle requirement validation
    if (['accident', 'breakdown'].includes(incidentType) && !vehicle) {
      return res.status(400).json({ success: false, message: 'A vehicle assignment is required to report this type of incident.' });
    }

    // Trip validation if provided
    if (tripId) {
      const trip = await Trip.findById(tripId);
      if (!trip || trip.driver?.toString() !== driverId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You do not own this trip' });
      }
    }

    // Handle Media Base64 parsing via existing saveReceiptBase64 logic (adjusting folder)
    let mediaUrl = null;
    if (mediaBase64) {
      // Re-use logic to write to /uploads/incidents
      const matches = mediaBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = require('crypto').randomUUID() + '.' + ext;
        const filepath = require('path').join(__dirname, '../uploads/incidents', filename);
        require('fs').writeFileSync(filepath, buffer);
        mediaUrl = '/uploads/incidents/' + filename;
      }
    }

    const Incident = require('../models/Incident');
    const newIncident = await Incident.create({
      driver: driverId,
      vehicle: vehicle ? vehicle._id : null,
      trip: tripId || null,
      type: incidentType,
      severity: severity || 'high',
      location: location || 'Unknown',
      description,
      mediaUrls: mediaUrl ? [mediaUrl] : []
    });

    const driverName = driver.name || `Driver ${driverId}`;
    
    // Secondary Alert
    const Notification = require('../models/Notification');
    await Notification.create({
      title: `🚨 ${severity ? severity.toUpperCase() : 'HIGH'} INCIDENT: ${incidentType.toUpperCase()} - ${driverName}`,
      message: description,
      type: 'error',
      referenceId: newIncident._id
    });

    res.status(201).json({ success: true, message: 'Incident reported successfully.', data: newIncident });
  } catch (error) {
    error.statusCode = 400;
    next(error);
  }
};

// --- DRIVER PERFORMANCE ---

exports.getDriverPerformance = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    const Trip = require('../models/Trip');
    const Incident = require('../models/Incident');

    const totalTrips = await Trip.countDocuments({ driver: driverId });
    const completedTrips = await Trip.countDocuments({ driver: driverId, status: 'completed' });
    const delayedTrips = await Trip.countDocuments({ driver: driverId, status: 'delayed' });
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const incidents = await Incident.find({ driver: driverId, createdAt: { $gte: thirtyDaysAgo } }).sort({ createdAt: -1 });
    
    // Dynamic Score Calculation
    let dynamicScore = driver.safetyScore || 100;
    dynamicScore -= (incidents.length * 10);
    dynamicScore -= (delayedTrips * 5);
    
    if (dynamicScore < 0) dynamicScore = 0;
    if (dynamicScore > 100) dynamicScore = 100;
    
    // Feedback Array
    let recentFeedback = [];
    if (incidents.length > 0) {
      recentFeedback = incidents.slice(0, 3).map(inc => ({
        date: inc.createdAt.toISOString(),
        type: 'error',
        message: `Incident reported: ${inc.type.toUpperCase()}`
      }));
    } else {
      recentFeedback = [{
        date: new Date().toISOString(),
        type: 'positive',
        message: 'No incidents reported in the last 30 days. Great job!'
      }];
    }

    res.status(200).json({
      success: true,
      data: {
        safetyScore: dynamicScore,
        trips: {
          total: totalTrips,
          completed: completedTrips,
          delayed: delayedTrips
        },
        recentFeedback
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- DRIVER NOTIFICATIONS (Migrated to global notificationController) ---

// --- DRIVER PROFILE ---

exports.getDriverProfile = async (req, res, next) => {
  try {
    const driverId = resolveDriverId(req);

    // Because we use mongoose-field-encryption, findById automatically handles the decryption
    // of licenseNumber, contactNumber, and kyc.aadharNumber so we can safely return it.
    const driverDoc = await Driver.findById(driverId);
    if (!driverDoc) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }
    const user = await User.findOne({ driverProfileId: driverId }).select('name email');
    const driver = driverDoc.toObject();
    driver.user = user;

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
};

// -----------------------------------------
// DRIVER DOCUMENTS (PHASE 7)
// -----------------------------------------

exports.getDriverDocuments = async (req, res, next) => {
  try {
    const { driverId } = req.params;

    if (req.user && req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const DriverDocument = require('../models/DriverDocument');
    const documents = await DriverDocument.find({ driver: driverId }).sort({ createdAt: -1 });

    // Calculate dynamic valid/expiring status
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const data = documents.map(doc => {
      const docObj = doc.toObject();
      let validity = 'valid';
      if (docObj.expiryDate < now) validity = 'expired';
      else if (docObj.expiryDate < thirtyDays) validity = 'expiring_soon';
      docObj.validity = validity;
      return docObj;
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.uploadDriverDocument = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { documentType, issueDate, expiryDate, mediaBase64 } = req.body;

    if (req.user && req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (new Date(issueDate) >= new Date(expiryDate)) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after issue date' });
    }

    if (!mediaBase64) {
      return res.status(400).json({ success: false, message: 'Document file is required' });
    }

    let fileUrl = null;
    const matches = mediaBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = matches[1];
      const ext = mime.split('/')[1] || 'pdf';
      const allowedExts = ['pdf', 'jpeg', 'jpg', 'png'];
      
      // Simple validation for allowed filetypes
      if (!allowedExts.includes(ext.toLowerCase())) {
         return res.status(400).json({ success: false, message: 'Invalid file type. Allowed: pdf, jpg, png' });
      }

      const buffer = Buffer.from(matches[2], 'base64');
      
      // 5MB limit
      if (buffer.length > 5 * 1024 * 1024) {
         return res.status(400).json({ success: false, message: 'File too large. Max 5MB.' });
      }

      const filename = require('crypto').randomUUID() + '.' + ext;
      const filepath = require('path').join(__dirname, '../private/documents', filename);
      require('fs').writeFileSync(filepath, buffer);
      
      // Note: the URL prefix can be our secure download route, e.g. /api/v1/documents/:id/download
      // Or we can just store the filename/path. We'll store the filename and serve dynamically.
      fileUrl = '/private/documents/' + filename;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid file format' });
    }

    const DriverDocument = require('../models/DriverDocument');
    const newDoc = await DriverDocument.create({
      driver: driverId,
      documentType,
      issueDate,
      expiryDate,
      fileUrl,
      verificationStatus: 'pending'
    });

    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    next(error);
  }
};

// -----------------------------------------
// DRIVER TRACKING (PHASE 8)
// -----------------------------------------

exports.submitTelemetry = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { latitude, longitude, accuracy, speed, heading, recordedAt } = req.body;

    if (req.user && req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const recordTime = recordedAt ? new Date(recordedAt) : new Date();
    // Validate timestamp freshness (don't accept extremely old or future timestamps)
    const now = new Date();
    if (recordTime > now || (now - recordTime) > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Invalid timestamp' });
    }

    const vehicle = await getActiveVehicleForDriver(driverId);
    if (!vehicle) {
      return res.status(400).json({ success: false, message: 'No vehicle assigned to driver' });
    }

    // Determine active trip if any
    const Trip = require('../models/Trip');
    const activeTrip = await Trip.findOne({
      driver: driverId,
      status: { $in: ['assigned', 'accepted', 'loading', 'dispatched', 'in_transit', 'delayed'] }
    }).sort({ createdAt: -1 });

    const LocationTelemetry = require('../models/LocationTelemetry');
    const telemetry = await LocationTelemetry.create({
      driver: driverId,
      vehicle: vehicle._id,
      trip: activeTrip ? activeTrip._id : null,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON expects Longitude, Latitude
      },
      accuracy,
      speed,
      heading,
      recordedAt: recordTime
    });

    res.status(201).json({ success: true, message: 'Telemetry saved' });
  } catch (error) {
    next(error);
  }
};
