const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for system-wide broadcasts, though ideally required
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  referenceId: {
    type: mongoose.Schema.Types.ObjectId // Can be vehicleId, tripId, etc.
  }
}, { timestamps: true });

NotificationSchema.index({ userId: 1, referenceId: 1, type: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', NotificationSchema);
