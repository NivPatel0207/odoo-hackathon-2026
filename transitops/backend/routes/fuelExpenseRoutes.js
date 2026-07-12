const express = require('express');
const router = express.Router();
const { getFuelLogs, createFuelLog, getExpenses, createExpense } = require('../controllers/fuelExpenseController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const analystOrManager = authorize('financial_analyst', 'fleet_manager');

router.route('/fuel')
  .get(protect, getFuelLogs)
  .post(protect, analystOrManager, createFuelLog);

router.route('/expenses')
  .get(protect, getExpenses)
  .post(protect, analystOrManager, createExpense);

module.exports = router;
