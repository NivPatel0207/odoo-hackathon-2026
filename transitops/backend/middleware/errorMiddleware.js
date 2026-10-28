const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  logger.error(`${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for field '${field}': '${err.keyValue[field]}' already exists.`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const responseMessage = (statusCode === 500 && isProduction) 
    ? 'Internal Server Error' 
    : message;

  res.status(statusCode).json({
    success: false,
    message: responseMessage,
    ...(!isProduction && { stack: err.stack })
  });
};

module.exports = errorMiddleware;
