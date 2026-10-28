const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['Meeting', 'Maintenance', 'Trip', 'Driver Shift', 'Other'],
    default: 'Meeting'
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Planned', 'Ongoing', 'Completed', 'Cancelled'],
    default: 'Planned'
  }
}, { timestamps: true });

applyBaseSchema(EventSchema);

module.exports = mongoose.model('Event', EventSchema);
