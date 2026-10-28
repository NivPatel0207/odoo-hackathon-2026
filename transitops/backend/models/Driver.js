const mongoose = require('mongoose');
const mongooseFieldEncryption = require('../utils/encryption').fieldEncryption;
const applyBaseSchema = require('../utils/applyBaseSchema');

const DriverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  licenseCategory: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E'],
    required: [true, 'License category is required']
  },
  licenseExpiryDate: {
    type: Date,
    required: [true, 'License expiry date is required']
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  safetyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  status: {
    type: String,
    enum: ['available', 'on_trip', 'off_duty', 'suspended', 'draft'],
    default: 'available'
  },
  paymentType: {
    type: String,
    enum: ['monthly', 'per_trip'],
    default: 'monthly'
  },
  paymentAmount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: 0,
    default: 0
  },
  kyc: {
    aadharNumber: { 
      type: String, 
      required: [true, 'Aadhar number is required'],
      trim: true 
    },
    aadharVerified: { type: Boolean, default: false }
  },
  notes: {
    type: String,
    trim: true
  },
  defaultVehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null
  }
}, { timestamps: true });

applyBaseSchema(DriverSchema);

if (!process.env.ENCRYPTION_SECRET) {
  throw new Error('FATAL ERROR: ENCRYPTION_SECRET environment variable is not defined.');
}

DriverSchema.plugin(mongooseFieldEncryption, { fields: ['licenseNumber', 'contactNumber', 'kyc.aadharNumber'], secret: process.env.ENCRYPTION_SECRET });

module.exports = mongoose.model('Driver', DriverSchema);
