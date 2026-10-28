const express = require('express');
const router = express.Router();
const { login, getMe, updateMe, updatePassword, forgotPassword, resetPassword, refreshToken, deleteUser, getUsers, createUser, updateUser } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, updatePasswordSchema } = require('../validators/authValidator');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 1000, // 1000 in dev/test, 5 in prod
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes.' }
});


router.post('/login', authLimiter, validate(loginSchema), login);

router.post('/refresh', refreshToken);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.route('/me')
  .get(protect, getMe)
  .put(protect, validate(updateProfileSchema), updateMe);

router.put('/password', protect, validate(updatePasswordSchema), updatePassword);


router.route('/users')
  .get(protect, authorize('fleet_manager'), getUsers)
  .post(protect, authorize('fleet_manager'), createUser);

router.route('/users/:id')
  .put(protect, authorize('fleet_manager'), updateUser);

router.delete('/users/:id', protect, authorize('fleet_manager'), deleteUser);

module.exports = router;
