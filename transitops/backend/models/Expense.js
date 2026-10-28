const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const ExpenseSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: [true, 'Driver is required']
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle is required']
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    default: null
  },
  expenseType: {
    type: String,
    enum: ['toll', 'insurance', 'tax', 'fine', 'parking', 'other'],
    required: [true, 'Expense type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  receiptUrl: {
    type: String,
    trim: true
  }
}, { timestamps: true });

applyBaseSchema(ExpenseSchema);

module.exports = mongoose.model('Expense', ExpenseSchema);
