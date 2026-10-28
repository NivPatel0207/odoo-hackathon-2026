const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');



// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        dateOfBirth: user.dateOfBirth,
        joiningDate: user.joiningDate,
        salary: user.salary,
        profilePhoto: user.profilePhoto,
        employeeId: user.employeeId,
        department: user.department,
        location: user.location,
        emergencyContact: user.emergencyContact,
        address: user.address,
        driverProfileId: user.driverProfileId,
        status: user.status,
        lastLogin: user.lastLogin,
        theme: user.theme,
        accentColor: user.accentColor,
        density: user.density,
        fontSize: user.fontSize,
        animations: user.animations,
        sidebarState: user.sidebarState,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    if (err.message === 'Invalid email or password') {
      return res.status(401).json({ success: false, message: err.message });
    }
    if (err.message === 'Account is not active') {
      return res.status(403).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// @desc    Refresh JWT Token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    
    // Ignore expiration to refresh
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    const user = await require('../models/User').findOne({ _id: decoded.id, deleted: { $ne: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found or deleted' });
    if (user.status !== 'Active') return res.status(403).json({ success: false, message: 'Account is not active' });
    
    const newToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
    res.json({ success: true, token: newToken });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// Helper to send email
const sendEmail = async (options) => {
  let transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
  }

  const message = {
    from: `${process.env.FROM_NAME || 'TransitOps'} <${process.env.FROM_EMAIL || 'noreply@transitops.com'}>`,
    to: options.email,
    subject: options.subject,
    html: options.html
  };

  const info = await transporter.sendMail(message);
  if (!process.env.SMTP_HOST) {
    console.log('Ethereal Email Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, a password reset link has been sent.' });
    }

    // Create a one-time use token by combining a secret with the user's current password hash.
    // If the password changes, this hash changes, invalidating the token.
    const secret = process.env.JWT_SECRET + user.passwordHash;
    const token = jwt.sign({ id: user._id }, secret, { expiresIn: '15m' });

    // The reset URL points to the frontend login page with a token parameter
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500/transitops/frontend';
    const resetUrl = `${frontendUrl}/index.html?reset_token=${token}&id=${user._id}`;

    const html = `
      <h3>Password Reset Request</h3>
      <p>You requested a password reset for your TransitOps account.</p>
      <p>Please click the link below to set a new password. This link is valid for 15 minutes.</p>
      <a href="${resetUrl}" target="_blank">Reset Password</a>
      <br><br>
      <p>If you did not request this, please ignore this email.</p>
    `;

    try {
      await sendEmail({ email: user.email, subject: 'TransitOps Password Reset', html });
      res.json({ success: true, message: 'If that email is registered, a password reset link has been sent.' });
    } catch (err) {
      console.error('Email could not be sent', err);
      res.status(500).json({ success: false, message: 'Email could not be sent' });
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { id, token, password } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid token or user' });
    }

    const secret = process.env.JWT_SECRET + user.passwordHash;
    try {
      jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Set new password (the pre-save hook will hash it)
    user.passwordHash = password;
    await user.save();

    res.json({ success: true, message: 'Password has been updated successfully. You may now log in.' });
  } catch (err) {
    next(err);
  }
};

// @desc    Update User Profile
// @route   PUT /api/auth/me
// @access  Private
const updateMe = async (req, res, next) => {
  try {
    const { 
      name, email, phone, dateOfBirth, joiningDate, profilePhoto,
      employeeId, department, location, emergencyContact, address, theme,
      accentColor, density, fontSize, animations, sidebarState
    } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (joiningDate !== undefined) user.joiningDate = joiningDate;
    // Security: Salary is strictly managed by HR/Management via Team or Payroll; self-service editing is prevented
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (department !== undefined) user.department = department;
    if (location !== undefined) user.location = location;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
    if (address !== undefined) user.address = address;
    if (theme !== undefined) user.theme = theme;
    if (accentColor !== undefined) user.accentColor = accentColor;
    if (density !== undefined) user.density = density;
    if (fontSize !== undefined) user.fontSize = fontSize;
    if (animations !== undefined) user.animations = animations;
    if (sidebarState !== undefined) user.sidebarState = sidebarState;

    // Fallback for legacy seeded users missing a phone number
    if (!user.phone && phone === undefined) {
      user.phone = '0000000000';
    }

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        dateOfBirth: user.dateOfBirth,
        joiningDate: user.joiningDate,
        salary: user.salary,
        profilePhoto: user.profilePhoto,
        employeeId: user.employeeId,
        department: user.department,
        location: user.location,
        emergencyContact: user.emergencyContact,
        address: user.address,
        driverProfileId: user.driverProfileId,
        status: user.status,
        lastLogin: user.lastLogin,
        theme: user.theme,
        accentColor: user.accentColor,
        density: user.density,
        fontSize: user.fontSize,
        animations: user.animations,
        sidebarState: user.sidebarState,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update User Password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide both current and new password' });
    }
    await authService.updatePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    if (err.message === 'Incorrect current password') {
      return res.status(401).json({ success: false, message: err.message });
    }
    next(err);
  }
};
// @desc    Delete User completely
// @route   DELETE /api/auth/users/:id
// @access  Private
const deleteUser = async (req, res, next) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Bidirectional cascade: If deleting a driver user, also delete their driver profile
    const Driver = require('../models/Driver');
    if (user.driverProfileId) {
      await Driver.findByIdAndDelete(user.driverProfileId);
    } else if (user.role === 'driver') {
      await Driver.deleteMany({
        $or: [
          { name: user.name },
          { contactNumber: user.phone }
        ]
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User and linked driver profile deleted successfully' });
  } catch (err) {
    next(err);
  }
};


// --- TEAM MANAGEMENT (Admin/Fleet Manager Only) ---

const getUsers = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { name, email, password, role, phone, salary, department } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password || 'password123',
      role,
      phone: phone || '0000000000',
      salary: salary ? Number(salary) : 0,
      department: department || 'Operations'
    });

    const userData = user.toObject();
    delete userData.passwordHash;
    res.status(201).json({ success: true, data: userData });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const User = require('../models/User');
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updateFields = {};
    if (req.body.name) updateFields.name = req.body.name;
    if (req.body.role) updateFields.role = req.body.role;
    if (req.body.status) updateFields.status = req.body.status;
    if (req.body.phone) updateFields.phone = req.body.phone;
    if (req.body.department) updateFields.department = req.body.department;
    if (req.body.salary !== undefined) updateFields.salary = Number(req.body.salary);

    user = await User.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true
    }).select('-passwordHash');

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  login, getMe, updateMe, updatePassword, forgotPassword, resetPassword, refreshToken, deleteUser, getUsers, createUser, updateUser };
