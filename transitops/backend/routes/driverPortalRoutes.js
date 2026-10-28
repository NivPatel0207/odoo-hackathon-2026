const express = require('express');
const router = express.Router();
const driverPortalController = require('../controllers/driverPortalController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateEldStatus } = require('../validators/entityValidators');

// Get driver dashboard aggregated data
router.get('/:driverId/dashboard', protect, authorize('dispatcher', 'safety_officer', 'driver'), driverPortalController.getDashboardData);

// Trip routes
router.get('/:driverId/trips', protect, authorize('driver'), driverPortalController.getDriverTrips);
router.get('/:driverId/trips/:tripId', protect, authorize('driver'), driverPortalController.getDriverTripDetails);
router.put('/:driverId/trips/:tripId/status', protect, authorize('driver'), driverPortalController.updateDriverTripStatus);
router.put('/:driverId/trips/:tripId/complete', protect, authorize('driver'), driverPortalController.completeDriverTrip);
router.put('/:driverId/trips/:tripId/reject', protect, authorize('driver'), driverPortalController.rejectDriverTrip);
router.post('/:driverId/trips/:tripId/inspection', protect, authorize('driver'), driverPortalController.submitDriverInspection);
router.post('/:driverId/trips/:tripId/delay', protect, authorize('driver'), driverPortalController.reportDriverDelay);
router.post('/:driverId/trips/:tripId/epod', protect, authorize('driver'), driverPortalController.submitDriverEpod);

// Get ELD status
router.get('/:driverId/eld', protect, authorize('dispatcher', 'safety_officer', 'driver'), driverPortalController.getEldStatus);

// Change ELD status
router.post('/:driverId/eld', protect, authorize('dispatcher', 'safety_officer', 'driver'), validateEldStatus, driverPortalController.changeEldStatus);

// Settlement & Earnings routes
router.get('/:driverId/settlement', protect, authorize('financial_analyst', 'driver'), driverPortalController.getPendingSettlement);
router.get('/:driverId/settlements/history', protect, authorize('financial_analyst', 'driver'), driverPortalController.getSettlementHistory);

// Vehicle & Maintenance routes
router.get('/:driverId/vehicle', protect, authorize('driver'), driverPortalController.getDriverVehicle);
router.post('/:driverId/vehicle/defect', protect, authorize('driver'), driverPortalController.reportVehicleDefect);

// Performance / Gamification route
router.get('/:driverId/performance', protect, authorize('driver'), driverPortalController.getDriverPerformance);

// Fuel & Expenses routes
router.post('/:driverId/fuel', protect, authorize('driver'), driverPortalController.logDriverFuel);
router.post('/:driverId/expenses', protect, authorize('driver'), driverPortalController.logDriverExpense);

// Incident / Emergency route
router.post('/:driverId/incident', protect, authorize('driver'), driverPortalController.reportDriverIncident);

// Notifications routes removed (using global secure endpoints)

// Profile route
router.get('/:driverId/profile', protect, authorize('driver'), driverPortalController.getDriverProfile);

// Document routes
router.get('/:driverId/documents', protect, authorize('driver'), driverPortalController.getDriverDocuments);
router.post('/:driverId/documents', protect, authorize('driver'), driverPortalController.uploadDriverDocument);

// Tracking (Phase 8)
router.post('/:driverId/tracking/location', protect, authorize('driver'), driverPortalController.submitTelemetry);

module.exports = router;
