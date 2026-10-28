const express = require('express');
const router = express.Router();
const {
  getPayrollSummary,
  getPayrollRoster,
  disbursePayout,
  disburseAllPending,
  getPayrollHistory
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All payroll routes are restricted to Fleet Manager & Financial Analyst
router.use(protect);
router.use(authorize('fleet_manager', 'financial_analyst'));

router.get('/summary', getPayrollSummary);
router.get('/roster', getPayrollRoster);
router.post('/disburse', disbursePayout);
router.post('/disburse-all', disburseAllPending);
router.get('/history', getPayrollHistory);

module.exports = router;
