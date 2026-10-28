const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/:id/download', protect, documentController.downloadDocument);
router.get('/driver/:driverId', protect, authorize('fleet_manager', 'safety_officer'), documentController.getDriverDocumentsForAdmin);
router.put('/:id/verify', protect, authorize('fleet_manager', 'safety_officer'), documentController.verifyDocument);

module.exports = router;
