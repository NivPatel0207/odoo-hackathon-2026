const mongoose = require('mongoose');

const MaintenanceSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle is required']
  },
  description: {
    type: String,
    required: [true, 'Maintenance description is required'],
    trim: true
  },
  maintenanceType: {
    type: String,
    enum: ['preventive', 'corrective', 'inspection', 'emergency'],
    default: 'corrective'
  },
  cost: {
    type: Number,
    default: 0,
    min: 0
  },
  dateStart: {
    type: Date,
    default: Date.now
  },
  dateEnd: {
    type: Date
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Maintenance', MaintenanceSchema);
