const express = require('express');
const router = express.Router();
const { getDashboardKPIs, getFuelEfficiencyReport, getOperationalCostReport, exportTripsCSV, getDriverPerformanceReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.get('/dashboard', protect, cacheMiddleware(300), getDashboardKPIs);
router.get('/fuel-efficiency', protect, cacheMiddleware(300), getFuelEfficiencyReport);
router.get('/operational-cost', protect, cacheMiddleware(300), getOperationalCostReport);
router.get('/driver-performance', protect, authorize('financial_analyst', 'fleet_manager'), cacheMiddleware(300), getDriverPerformanceReport);
router.get('/export/trips', protect, authorize('financial_analyst', 'fleet_manager'), exportTripsCSV);

module.exports = router;
