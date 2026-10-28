const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'],
    required: true
  },
  modelName: {
    type: String,
    required: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changes: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

// Auto-delete audit logs after 30 days (2592000 seconds = 30 * 24 * 60 * 60)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
