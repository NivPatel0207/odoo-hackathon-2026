const FuelLog = require('../models/FuelLog');
const Expense = require('../models/Expense');
const Vehicle = require('../models/Vehicle');

// ─── FUEL LOGS ───────────────────────────────────────────────────────────────

// @desc    Get all fuel logs
// @route   GET /api/fuel-expenses/fuel
// @access  Private (all roles)
const getFuelLogs = async (req, res, next) => {
  try {
    const { vehicle } = req.query;
    const filter = {};
    if (vehicle) filter.vehicle = vehicle;
    const logs = await FuelLog.find(filter)
      .populate('vehicle', 'name registrationNumber fuelType')
      .populate('trip', 'tripCode')
      .sort({ date: -1 });
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
};

// @desc    Create fuel log
// @route   POST /api/fuel-expenses/fuel
// @access  Private (financial_analyst, fleet_manager)
const createFuelLog = async (req, res, next) => {
  try {
    const log = await FuelLog.create(req.body);
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
};

// ─── EXPENSES ────────────────────────────────────────────────────────────────

// @desc    Get all expenses
// @route   GET /api/fuel-expenses/expenses
// @access  Private (all roles)
const getExpenses = async (req, res, next) => {
  try {
    const { vehicle, expenseType } = req.query;
    const filter = {};
    if (vehicle) filter.vehicle = vehicle;
    if (expenseType) filter.expenseType = expenseType;
    const expenses = await Expense.find(filter)
      .populate('vehicle', 'name registrationNumber fuelType')
      .populate('trip', 'tripCode')
      .sort({ date: -1 });
    res.json({ success: true, count: expenses.length, data: expenses });
  } catch (err) {
    next(err);
  }
};

// @desc    Create expense
// @route   POST /api/fuel-expenses/expenses
// @access  Private (financial_analyst, fleet_manager)
const createExpense = async (req, res, next) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

// ─── LIVE PRICING MOCK ─────────────────────────────────────────────────────────

// @desc    Get live dynamic fuel rates
// @route   GET /api/fuel-expenses/live-rates
// @access  Private (all roles)
const getLiveRates = async (req, res, next) => {
  try {
    // Generate a pseudo-random multiplier based on the current date
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    // Use the seed to create a multiplier between 0.98 and 1.02 (±2% fluctuation)
    const random = Math.sin(seed) * 10000;
    const fluctuation = 0.98 + (random - Math.floor(random)) * 0.04;

    const baseRates = {
      diesel: 89.62,
      gasoline: 96.72,
      cng: 76.59,
      electric: 15.00,
      hybrid: 92.00
    };

    const liveRates = {};
    for (const [fuel, price] of Object.entries(baseRates)) {
      liveRates[fuel] = Number((price * fluctuation).toFixed(2));
    }

    res.json({ success: true, data: liveRates });
  } catch (err) {
    next(err);
  }
};


// @desc    Approve/Reject fuel log
// @route   PUT /api/fuel-expenses/fuel/:id/approve
// @access  Private (financial_analyst, fleet_manager)
const approveFuelLog = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      res.status(400); throw new Error('Invalid status');
    }
    const log = await FuelLog.findById(req.params.id);
    if (!log) { res.status(404); throw new Error('Fuel log not found'); }
    
    log.status = status;
    log.approvedBy = req.user.id;
    if (status === 'rejected' && reason) log.rejectionReason = reason;
    await log.save();
    
    res.json({ success: true, data: log });
  } catch (err) { next(err); }
};

// @desc    Approve/Reject expense
// @route   PUT /api/fuel-expenses/expenses/:id/approve
// @access  Private (financial_analyst, fleet_manager)
const approveExpense = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      res.status(400); throw new Error('Invalid status');
    }
    const exp = await Expense.findById(req.params.id);
    if (!exp) { res.status(404); throw new Error('Expense not found'); }
    
    exp.status = status;
    exp.approvedBy = req.user.id;
    if (status === 'rejected' && reason) exp.rejectionReason = reason;
    await exp.save();
    
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
};

module.exports = { getFuelLogs, createFuelLog, approveFuelLog, getExpenses, createExpense, approveExpense, getLiveRates };
