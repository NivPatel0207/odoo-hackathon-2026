const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

const auditLog = async (action, modelName, documentId, userId, changes = {}) => {
  try {
    await AuditLog.create({
      action,
      modelName,
      documentId,
      userId,
      changes
    });
  } catch (error) {
    logger.error('Failed to write audit log', error);
  }
};

module.exports = auditLog;
