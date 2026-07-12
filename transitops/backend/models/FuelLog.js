const mongoose = require('mongoose');

const FuelLogSchema = new mongoose.Schema({
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
  liters: {
    type: Number,
    required: [true, 'Fuel quantity (liters) is required'],
    min: [0, 'Liters cannot be negative']
  },
  costPerLiter: {
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
  }
}, { timestamps: true });

module.exports = mongoose.model('FuelLog', FuelLogSchema);
