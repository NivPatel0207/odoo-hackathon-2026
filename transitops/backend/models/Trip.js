const mongoose = require('mongoose');

let tripCounter = 0;

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
    ref: 'Vehicle',
    required: [true, 'Vehicle is required']
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: [true, 'Driver is required']
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
  status: {
    type: String,
    enum: ['draft', 'dispatched', 'completed', 'cancelled'],
    default: 'draft'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Auto-generate tripCode before saving
TripSchema.pre('save', async function (next) {
  if (this.isNew && !this.tripCode) {
    const count = await mongoose.model('Trip').countDocuments();
    this.tripCode = `TRIP-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Trip', TripSchema);
