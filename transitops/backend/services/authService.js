const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');

class AuthService {
  generateToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRE || '7d' 
    });
  }

  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user || !(await user.comparePassword(password))) {
      throw new Error('Invalid email or password');
    }
    if (user.status !== 'Active') {
      throw new Error('Account is not active');
    }
    await require('../models/User').updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );
    user.lastLogin = new Date();
    const token = this.generateToken(user._id);
    return { user, token };
  }
  
  async getMe(id) {
    return await userRepository.findById(id);
  }

  async updatePassword(id, currentPassword, newPassword) {
    const user = await userRepository.findByIdWithPassword(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (!(await user.comparePassword(currentPassword))) {
      throw new Error('Incorrect current password');
    }
    user.passwordHash = newPassword; // The pre-save hook will hash it
    await user.save();
    return true;
  }
}

module.exports = new AuthService();
