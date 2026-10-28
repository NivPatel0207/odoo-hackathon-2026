const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const DriverLogSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  status: {
    type: String,
    enum: ['OFF_DUTY', 'SLEEPER', 'DRIVING', 'ON_DUTY'],
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  durationMinutes: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    trim: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

applyBaseSchema(DriverLogSchema);

module.exports = mongoose.model('DriverLog', DriverLogSchema);
