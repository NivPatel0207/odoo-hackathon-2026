const Notification = require('../models/Notification');

// @desc    Get all notifications
// @route   GET /api/v1/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'driver' && req.user.driverProfileId) {
      // Lazy Evaluation: Check for Document Expiry
      const DriverDocument = require('../models/DriverDocument');
      const docs = await DriverDocument.find({ driver: req.user.driverProfileId });
      const now = new Date();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      
      for (const doc of docs) {
        if (!doc.expiryDate) continue;
        
        const timeRemaining = new Date(doc.expiryDate) - now;
        let title = null;
        let message = null;
        let type = null;
        
        if (timeRemaining < 0) {
          title = 'Document Expired';
          message = `Your ${doc.documentType.replace('_', ' ')} expired on ${new Date(doc.expiryDate).toLocaleDateString()}`;
          type = 'error';
        } else if (timeRemaining < thirtyDays) {
          title = 'Document Expiring Soon';
          message = `Your ${doc.documentType.replace('_', ' ')} will expire on ${new Date(doc.expiryDate).toLocaleDateString()}`;
          type = 'warning';
        }
        
        if (title) {
          try {
            await Notification.create({
              userId: req.user._id,
              title,
              message,
              type,
              referenceId: doc._id
            });
          } catch (e) {
            if (e.code !== 11000) console.error("Notification creation error", e);
          }
        }
      }
    }

    const query = { $or: [{ userId: req.user._id }, { userId: { $exists: false } }, { userId: null }] };
    const notifications = await Notification.find(query).sort('-createdAt').limit(50);
    
    // Transform read status based on readBy for broadcast notifications
    const data = notifications.map(notif => {
      const n = notif.toObject();
      if (!n.userId && n.readBy && n.readBy.some(id => id.toString() === req.user._id.toString())) {
        n.read = true;
      }
      return n;
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    
    // Explicit and safe read model for broadcast notifications
    if (!notification.userId) {
      if (!notification.readBy) notification.readBy = [];
      if (!notification.readBy.some(id => id.toString() === req.user._id.toString())) {
        notification.readBy.push(req.user._id);
        await notification.save();
      }
      const data = notification.toObject();
      data.read = true;
      return res.json({ success: true, data });
    }

    // Ownership check for individual notifications
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to this notification' });
    }
    
    notification.read = true;
    await notification.save();
    
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};
