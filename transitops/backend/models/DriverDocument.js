const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const DriverDocumentSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  documentType: { type: String, enum: ['license', 'medical_card', 'background_check', 'insurance', 'other'], required: true },
  fileUrl: { type: String, required: true },
  issueDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  rejectionReason: { type: String }
}, { timestamps: true });

applyBaseSchema(DriverDocumentSchema);
module.exports = mongoose.model('DriverDocument', DriverDocumentSchema);
