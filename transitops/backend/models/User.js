const mongoose = require('mongoose');
const applyBaseSchema = require('../utils/applyBaseSchema');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    index: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'viewer', 'driver'],
    required: [true, 'Role is required']
  },
  driverProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  dateOfBirth: {
    type: String
  },
  joiningDate: {
    type: String
  },
  salary: {
    type: Number
  },
  profilePhoto: {
    type: String
  },
  employeeId: {
    type: String
  },
  department: {
    type: String
  },
  location: {
    type: String
  },
  emergencyContact: {
    type: String
  },
  address: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  lastLogin: {
    type: Date
  },
  theme: {
    type: String,
    enum: ['dark', 'light', 'system'],
    default: 'system'
  },
  accentColor: {
    type: String,
    default: 'orange'
  },
  density: {
    type: String,
    enum: ['comfortable', 'compact'],
    default: 'comfortable'
  },
  fontSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  animations: {
    type: Boolean,
    default: true
  },
  sidebarState: {
    type: String,
    enum: ['expanded', 'collapsed'],
    default: 'expanded'
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  // Prevent double hashing if already a bcrypt hash
  if (typeof this.passwordHash === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.passwordHash)) {
    return next();
  }
  const salt = await bcrypt.genSalt(12); // Increased cost factor to 12
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

applyBaseSchema(UserSchema);

module.exports = mongoose.model('User', UserSchema);
