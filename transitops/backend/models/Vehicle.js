const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

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
  fuelType: {
    type: String,
    enum: ['diesel', 'gasoline', 'cng', 'electric', 'hybrid'],
    default: 'diesel'
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
  maintenanceInterval: {
    type: Number,
    default: 10000
  },
  nextMaintenanceMileage: {
    type: Number,
    default: 10000
  },
  region: {
    type: String,
    trim: true,
    default: 'Central'
  },
  status: {
    type: String,
    enum: ['available', 'on_trip', 'in_shop', 'retired', 'draft'],
    default: 'available'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

applyBaseSchema(VehicleSchema);

VehicleSchema.index({ status: 1 });
VehicleSchema.index({ vehicleType: 1 });

module.exports = mongoose.model('Vehicle', VehicleSchema);
