const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vehicle name is required'],
    trim: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  vehicleType: {
    type: String,
    enum: ['truck', 'van', 'bus', 'pickup', 'trailer', 'tanker'],
    required: [true, 'Vehicle type is required']
  },
  maxLoadCapacity: {
    type: Number,
    required: [true, 'Max load capacity (kg) is required'],
    min: [0, 'Load capacity cannot be negative']
  },
  odometer: {
    type: Number,
    default: 0,
    min: 0
  },
  acquisitionCost: {
    type: Number,
    default: 0
  },
  region: {
    type: String,
    trim: true,
    default: 'Central'
  },
  status: {
    type: String,
    enum: ['available', 'on_trip', 'in_shop', 'retired'],
    default: 'available'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);
