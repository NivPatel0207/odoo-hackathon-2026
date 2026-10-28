const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/optimize-route', (req, res) => {
  const { source, destination } = req.body;
  // Mock AI Route Optimization logic
  setTimeout(() => {
    res.json({
      success: true,
      route: [
        { lat: 18.5204, lng: 73.8567, name: source },
        { lat: 19.0760, lng: 72.8777, name: 'AI Waypoint 1' },
        { lat: 19.2183, lng: 72.9781, name: 'AI Waypoint 2' },
        { lat: 28.7041, lng: 77.1025, name: destination }
      ],
      distanceSaved: Math.floor(Math.random() * 50) + 10,
      etaSaved: '45 mins'
    });
  }, 1000);
});

// Use the new smart AI controller for chat
router.post('/assistant', protect, aiController.assist);

module.exports = router;
