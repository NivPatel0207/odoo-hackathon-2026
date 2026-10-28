require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const errorMiddleware = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const { PORT, NODE_ENV } = require('./config/env');
const { swaggerUi, specs } = require('./docs/swagger');
const statusMonitor = require('express-status-monitor');

// Connect to database
connectDB();

// Startup assertions — fail fast if critical env vars are missing
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not defined. Cannot start server.');
  process.exit(1);
}

const app = express();

// Metrics
app.use(statusMonitor());

// Middleware
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' }
}));

app.use(compression());

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '5mb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: process.env.NODE_ENV === 'production' ? 100 : 5000, // 5000 for dev, 100 for prod
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

if (NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API Version 1 Routes
const v1Router = express.Router();
v1Router.use('/auth', require('./routes/authRoutes'));
v1Router.use('/vehicles', require('./routes/vehicleRoutes'));
v1Router.use('/drivers', require('./routes/driverRoutes'));
v1Router.use('/trips', require('./routes/tripRoutes'));
v1Router.use('/maintenance', require('./routes/maintenanceRoutes'));
v1Router.use('/fuel-expenses', require('./routes/fuelExpenseRoutes'));
v1Router.use('/reports', require('./routes/reportRoutes'));
v1Router.use('/ai', require('./routes/aiRoutes'));
v1Router.use('/notifications', require('./routes/notificationRoutes'));
v1Router.use('/planner', require('./routes/plannerRoutes'));
v1Router.use('/driver-portal', require('./routes/driverPortalRoutes'));
v1Router.use('/payroll', require('./routes/payrollRoutes'));

app.use('/api/v1', v1Router);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', message: 'TransitOps API is running', timestamp: new Date() });
});

// In-memory cache flush (used by clear/seed tools)
const { cache } = require('./middleware/cacheMiddleware');
app.post('/api/v1/cache/flush', (req, res) => {
  if (cache && typeof cache.flushAll === 'function') {
    cache.flushAll();
  }
  res.json({ success: true, message: 'In-memory cache flushed' });
});

// Error Middleware (must be last)
app.use(errorMiddleware);

const server = app.listen(PORT, () => {
  logger.info(`🚀 TransitOps Server running on http://localhost:${PORT}`);
  logger.info(`📚 Swagger Docs available at http://localhost:${PORT}/api-docs`);
  logger.info(`📊 Metrics available at http://localhost:${PORT}/status`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    const mongoose = require('mongoose');
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  });
  setTimeout(() => { process.exit(1); }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = app;
