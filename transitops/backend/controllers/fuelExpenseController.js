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
      .populate('vehicle', 'name registrationNumber')
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
      .populate('vehicle', 'name registrationNumber')
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

module.exports = { getFuelLogs, createFuelLog, getExpenses, createExpense };
