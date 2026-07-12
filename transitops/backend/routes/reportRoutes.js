const express = require('express');
const router = express.Router();
const { getDashboardKPIs, getFuelEfficiencyReport, getOperationalCostReport, exportTripsCSV } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/dashboard', protect, getDashboardKPIs);
router.get('/fuel-efficiency', protect, getFuelEfficiencyReport);
router.get('/operational-cost', protect, getOperationalCostReport);
router.get('/export/trips', protect, authorize('financial_analyst', 'fleet_manager'), exportTripsCSV);

module.exports = router;
