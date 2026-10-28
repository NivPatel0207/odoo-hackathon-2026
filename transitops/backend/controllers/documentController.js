const DriverDocument = require('../models/DriverDocument');
const path = require('path');
const fs = require('fs');
const Notification = require('../models/Notification');

exports.getDriverDocumentsForAdmin = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const docs = await DriverDocument.find({ driver: driverId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    next(error);
  }
};

exports.verifyDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const doc = await DriverDocument.findById(id).populate('driver');
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    doc.verificationStatus = status;
    doc.verifiedBy = req.user.id;
    doc.verifiedAt = new Date();
    
    if (status === 'rejected') {
      doc.rejectionReason = rejectionReason || 'No reason provided';
    } else {
      doc.rejectionReason = undefined;
    }

    await doc.save();
    
    // Notify Driver
    await Notification.create({
      title: `Document ${status.toUpperCase()}`,
      message: `Your ${doc.documentType.replace('_', ' ')} has been ${status}.${status === 'rejected' ? ' Reason: ' + doc.rejectionReason : ''}`,
      type: status === 'verified' ? 'success' : 'error',
      referenceId: doc.driver._id
    });

    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

exports.downloadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await DriverDocument.findById(id);
    
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Access control
    const isDriverOwner = req.user.role === 'driver' && req.user.driverProfileId?.toString() === doc.driver.toString();
    const isBackOffice = ['fleet_manager', 'safety_officer'].includes(req.user.role);
    
    if (!isDriverOwner && !isBackOffice) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this document' });
    }

    // doc.fileUrl should look like /private/documents/filename.ext
    const filename = path.basename(doc.fileUrl);
    const filepath = path.join(__dirname, '../private/documents', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.sendFile(filepath);
  } catch (error) {
    next(error);
  }
};
