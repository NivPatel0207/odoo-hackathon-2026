const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const FuelLogSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  quantity: {
    type: Number,
    required: [true, 'Fuel quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  costPerUnit: {
    type: Number,
    default: 0
  },
  cost: {
    type: Number,
    required: [true, 'Fuel cost is required'],
    min: 0
  },
  station: {
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

applyBaseSchema(FuelLogSchema);

module.exports = mongoose.model('FuelLog', FuelLogSchema);
