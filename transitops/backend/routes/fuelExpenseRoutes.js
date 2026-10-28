const express = require('express');
const router = express.Router();
const { getFuelLogs, createFuelLog, getExpenses, createExpense, getLiveRates, approveFuelLog, approveExpense } = require('../controllers/fuelExpenseController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validateFuelLog, validateExpense } = require('../validators/entityValidators');

const analystOrManager = authorize('financial_analyst', 'fleet_manager');

router.route('/live-rates')
  .get(protect, getLiveRates);

router.route('/fuel')
  .get(protect, getFuelLogs)
  .post(protect, analystOrManager, validateFuelLog, createFuelLog);

router.route('/expenses')
  .get(protect, getExpenses)
  .post(protect, analystOrManager, validateExpense, createExpense);

router.route('/fuel/:id/approve')
  .put(protect, analystOrManager, approveFuelLog);

router.route('/expenses/:id/approve')
  .put(protect, analystOrManager, approveExpense);

module.exports = router;
