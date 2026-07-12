/**
 * Role-based access control middleware
 * Usage: authorize('fleet_manager', 'dispatcher')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user ? req.user.role : 'none'}`
      });
    }
    next();
  };
};

module.exports = { authorize };
