const Incident = require('../models/Incident');

exports.getIncidents = async (req, res, next) => {
  try {
    const { status, driverId } = req.query;
    let query = {};
    if (status) query.status = status;
    if (driverId) query.driver = driverId;
    
    // Safety officers/fleet managers can see all.
    // We assume route is protected by authMiddleware.
    
    const incidents = await Incident.find(query)
      .populate('driver')
      .populate('vehicle')
      .populate('trip')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    next(error);
  }
};

exports.getDriverIncidents = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    
    // Drivers can only see their own
    if (req.user.role === 'driver' && req.user.driverProfileId?.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const incidents = await Incident.find({ driver: driverId })
      .populate('vehicle')
      .populate('trip')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    next(error);
  }
};

exports.investigateIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    
    if (incident.status === 'resolved') {
      return res.status(400).json({ success: false, message: 'Incident already resolved' });
    }
    
    incident.status = 'investigating';
    incident.assignedTo = req.user.id;
    await incident.save();
    
    res.status(200).json({ success: true, message: 'Incident is now under investigation', data: incident });
  } catch (error) {
    next(error);
  }
};

exports.resolveIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    
    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    
    if (incident.status === 'resolved') {
      return res.status(400).json({ success: false, message: 'Incident already resolved' });
    }
    
    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    incident.resolvedBy = req.user.id;
    incident.resolutionNotes = resolutionNotes;
    await incident.save();
    
    res.status(200).json({ success: true, message: 'Incident resolved', data: incident });
  } catch (error) {
    next(error);
  }
};
