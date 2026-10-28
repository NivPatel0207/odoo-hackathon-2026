require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');

const testApi = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/transitops');
    const user = await User.findOne();
    if (!user) { console.log('No user found'); process.exit(1); }
    
    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });
    
    // Emulate fetch
    const res = await fetch('http://localhost:5000/api/v1/notifications', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    const data = await res.json();
    console.log('Response:', data);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
testApi();
