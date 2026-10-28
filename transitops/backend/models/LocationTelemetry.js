const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const LocationTelemetrySchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  accuracy: { type: Number },
  speed: { type: Number },
  heading: { type: Number },
  recordedAt: { type: Date, required: true, index: true }
}, { timestamps: true });

LocationTelemetrySchema.index({ location: '2dsphere' });
LocationTelemetrySchema.index({ driver: 1, recordedAt: -1 });

applyBaseSchema(LocationTelemetrySchema);
module.exports = mongoose.model('LocationTelemetry', LocationTelemetrySchema);
