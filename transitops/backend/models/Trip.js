const mongoose = require('mongoose');
const crypto = require('crypto');
const applyBaseSchema = require('../utils/applyBaseSchema');

const TripSchema = new mongoose.Schema({
  tripCode: {
    type: String,
    unique: true
  },
  source: {
    type: String,
    required: [true, 'Source location is required'],
    trim: true
  },
  destination: {
    type: String,
    required: [true, 'Destination is required'],
    trim: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
    // Removed required for unassigned loads
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
    // Removed required for unassigned loads
  },
  customerName: {
    type: String,
    trim: true
  },
  commodityType: {
    type: String,
    trim: true
  },
  rateType: {
    type: String,
    enum: ['flat', 'per_mile'],
    default: 'flat'
  },
  rate: {
    type: Number,
    default: 0
  },
  pickupTime: {
    type: Date
  },
  deliveryTime: {
    type: Date
  },
  cargoWeight: {
    type: Number,
    required: [true, 'Cargo weight (kg) is required'],
    min: [0, 'Cargo weight cannot be negative']
  },
  plannedDistance: {
    type: Number,
    default: 0
  },
  actualDistance: {
    type: Number,
    default: 0
  },
  fuelConsumed: {
    type: Number,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  scheduledDate: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  eta: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['draft', 'assigned', 'accepted', 'loading', 'dispatched', 'in_transit', 'arrived', 'delivered', 'completed', 'delayed', 'cancelled'],
    default: 'draft'
  },
  notes: {
    type: String,
    trim: true
  },
  epod: {
    recipientName: { type: String, trim: true },
    quantityDelivered: { type: Number, min: 0 },
    condition: { type: String, enum: ['Good', 'Damaged'] },
    customerSignature: { type: String }, // Base64 data URL
    deliveryPhoto: { type: String }, // Base64 data URL
    capturedAt: { type: Date }
  },
  preTripInspection: {
    brakes: { type: Boolean },
    engine: { type: Boolean },
    tyres: { type: Boolean },
    headlights: { type: Boolean },
    indicators: { type: Boolean },
    horn: { type: Boolean },
    mirrors: { type: Boolean },
    oil: { type: Boolean },
    coolant: { type: Boolean },
    fuel: { type: Boolean },
    emergencyKit: { type: Boolean },
    fireExtinguisher: { type: Boolean },
    documents: { type: Boolean },
    vehicleCondition: { type: String, enum: ['Safe', 'Minor Issue', 'Unsafe'] },
    completedAt: { type: Date }
  }
}, { timestamps: true });

// Auto-generate tripCode before saving
TripSchema.pre('save', async function (next) {
  if (this.isNew && !this.tripCode) {
    const uniqueId = crypto.randomUUID().split('-')[0].toUpperCase();
    this.tripCode = `TRIP-${uniqueId}`;
  }
  next();
});

applyBaseSchema(TripSchema);

TripSchema.index({ status: 1 });
TripSchema.index({ scheduledDate: -1 });

module.exports = mongoose.model('Trip', TripSchema);
