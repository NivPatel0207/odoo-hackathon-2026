const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const SettlementSchema = new mongoose.Schema({
  beneficiaryType: {
    type: String,
    enum: ['driver', 'staff'],
    default: 'driver'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  beneficiaryName: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    trim: true
  },
  periodStart: {
    type: Date,
    default: () => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  },
  periodEnd: {
    type: Date,
    default: Date.now
  },
  trips: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip'
  }],
  basePay: {
    type: Number,
    required: true,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  netPay: {
    type: Number,
    required: true,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'cash', 'cheque'],
    default: 'bank_transfer'
  },
  transactionRef: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'paid'
  },
  paidAt: {
    type: Date,
    default: Date.now
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  },
  isDeficitPayout: {
    type: Boolean,
    default: false
  },
  deficitOverrideBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deficitOverrideReason: {
    type: String,
    trim: true
  }
}, { timestamps: true });

applyBaseSchema(SettlementSchema);

module.exports = mongoose.model('Settlement', SettlementSchema);
