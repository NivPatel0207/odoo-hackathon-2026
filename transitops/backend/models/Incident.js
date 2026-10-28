const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const IncidentSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  type: { type: String, enum: ['accident', 'breakdown', 'spill', 'medical', 'other'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: ['reported', 'investigating', 'resolved'], default: 'reported' },
  location: { type: String, trim: true },
  description: { type: String, required: true },
  mediaUrls: [{ type: String }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNotes: { type: String }
}, { timestamps: true });

applyBaseSchema(IncidentSchema);
module.exports = mongoose.model('Incident', IncidentSchema);
