require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pdfRoutes = require('./backend/src/routes');
const puppeteerPdfService = require('./backend/src/services/puppeteerPdfService');
const mongoConnection = require('./backend/src/db/connection');
const { metricsMiddleware, getMetrics } = require('./backend/src/services/metricsService');
const requestQueue = require('./backend/src/services/requestQueue');

const app = express();
const PORT = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === 'production';

// =============================================================================
// M-05: ENVIRONMENT VALIDATION
// =============================================================================
function validateEnvironment() {
  const warnings = [];
  const errors = [];

  // Check if running in production without explicit NODE_ENV
  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV not set - defaulting to development mode');
  }

  // Production-required variables
  if (isProduction) {
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI is required in production');
    }
    if (!process.env.ALLOWED_ORIGINS) {
      warnings.push('ALLOWED_ORIGINS not set - using default localhost values');
    }
  } else {
    // Development warnings
    if (!process.env.MONGODB_URI) {
      warnings.push('MONGODB_URI not set - using localhost:27017/saleshub');
    }
  }

  // Log warnings
  warnings.forEach(w => console.warn(`[ENV Warning] ${w}`));

  // Fail fast on errors
  if (errors.length > 0) {
    errors.forEach(e => console.error(`[ENV Error] ${e}`));
    console.error('\nServer cannot start due to missing environment variables.');
    console.error('Please set the required variables in your .env file or environment.\n');
    process.exit(1);
  }
}

validateEnvironment();

// =============================================================================
// H-12: REQUEST ID TRACKING MIDDLEWARE
// =============================================================================
app.use((req, res, next) => {
  // Generate unique request ID or use existing from header
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  // H-12: Log request with ID for tracing
  if (!isProduction) {
    console.log(`[${req.requestId.slice(0, 8)}] ${req.method} ${req.path}`);
  }

  next();
});

// =============================================================================
// M-06: METRICS MIDDLEWARE
// =============================================================================
app.use(metricsMiddleware);

// =============================================================================
// SECURITY MIDDLEWARE (C-05: Security Headers)
// =============================================================================
app.use(helmet({
  contentSecurityPolicy: false,  // CSP handled in HTML meta tag
  crossOriginEmbedderPolicy: false  // Allow image loading
}));

// =============================================================================
// CORS CONFIGURATION (C-08)
// =============================================================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8000', 'http://127.0.0.1:8000'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400
}));

// =============================================================================
// COMPRESSION
// =============================================================================
app.use(compression());

// =============================================================================
// REQUEST TIMEOUT (C-12)
// =============================================================================
app.use((req, res, next) => {
  req.setTimeout(120000);  // 2 minutes
  res.setTimeout(120000);
  next();
});

// =============================================================================
// BODY PARSER (C-07: Reduced from 50mb to 10mb)
// =============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// RATE LIMITING (C-03)
// =============================================================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // 100 requests per window
  message: { error: 'Too many requests', message: 'Please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const pdfLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,  // 20 PDF generations per window (Puppeteer is resource-intensive)
  message: { error: 'Too many PDF requests', message: 'Please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use('/api/pdf', pdfLimiter);
app.use('/api', apiLimiter);

// API Routes (before static files)
app.use('/api', pdfRoutes);

// =============================================================================
// H-11: ENHANCED HEALTH CHECK
// =============================================================================
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    services: {
      server: 'ok',
      mongodb: 'unknown',
      puppeteer: 'unknown'
    }
  };

  // Check MongoDB connection
  try {
    if (mongoConnection.isConnected()) {
      // Try a ping operation
      const db = await mongoConnection.getDb();
      await db.command({ ping: 1 });
      health.services.mongodb = 'ok';
    } else {
      health.services.mongodb = 'disconnected';
    }
  } catch (error) {
    health.services.mongodb = 'error';
    health.mongoError = isProduction ? 'Connection failed' : error.message;
  }

  // Check Puppeteer browser status
  try {
    // Check if browser is connected (without launching a new one)
    if (puppeteerPdfService.browser && puppeteerPdfService.browser.isConnected()) {
      health.services.puppeteer = 'ok';
    } else {
      health.services.puppeteer = 'not_initialized';
    }
  } catch (error) {
    health.services.puppeteer = 'error';
    health.puppeteerError = isProduction ? 'Check failed' : error.message;
  }

  // Determine overall status
  const hasError = Object.values(health.services).some(s => s === 'error');
  const hasWarning = Object.values(health.services).some(s => s === 'disconnected' || s === 'not_initialized');

  if (hasError) {
    health.status = 'error';
    return res.status(503).json(health);
  } else if (hasWarning) {
    health.status = 'degraded';
  }

  res.json(health);
});

// Simple readiness check (lighter weight than health)
app.get('/ready', (req, res) => {
  res.json({ ready: true, timestamp: new Date().toISOString() });
});

// =============================================================================
// M-06: METRICS ENDPOINT
// =============================================================================
app.get('/metrics', (req, res) => {
  res.json(getMetrics());
});

// =============================================================================
// STATIC FILE SERVING (C-04: Restricted to specific directories)
// =============================================================================
// Only serve specific public directories - NOT the entire project
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback to index.html for SPA routing (but not for API or static files)
app.get('*', (req, res, next) => {
  // Don't serve index.html for API routes or file extensions
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =============================================================================
// ERROR HANDLER (C-11: Sanitized for production)
// =============================================================================
app.use((err, req, res, next) => {
  // H-12: Include request ID in error logs
  const logContext = {
    requestId: req.requestId,
    message: err.message,
    name: err.name,
    status: err.status,
    path: req.path
  };

  // Log full error server-side
  if (isProduction) {
    console.error('[Server Error]:', logContext);
  } else {
    console.error('[Server Error]:', { ...logContext, stack: err.stack });
  }

  if (res.headersSent) {
    return next(err);
  }

  if (req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      error: isProduction ? 'Internal Server Error' : (err.name || 'Error'),
      message: isProduction ? 'An unexpected error occurred' : err.message,
      requestId: req.requestId  // H-12: Include for support reference
    });
  }

  res.status(err.status || 500).sendFile(path.join(__dirname, 'index.html'));
});

// =============================================================================
// GRACEFUL SHUTDOWN (C-01: Close MongoDB connection, M-10: Clear request queue)
// =============================================================================
let server;

async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }

  // M-10: Clear pending queue tasks
  const cleared = requestQueue.clearQueue();
  if (cleared > 0) {
    console.log(`Cleared ${cleared} pending PDF requests from queue`);
  }

  try {
    await puppeteerPdfService.close();
    console.log('Browser closed successfully');
  } catch (error) {
    console.error('Error closing browser:', error.message);
  }

  // C-01: Close MongoDB connection
  try {
    await mongoConnection.close();
  } catch (error) {
    console.error('Error closing MongoDB:', error.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  requestQueue.clearQueue();
  await puppeteerPdfService.close();
  await mongoConnection.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// =============================================================================
// START SERVER
// =============================================================================
server = app.listen(PORT, () => {
  if (!isProduction) {
    console.log(`\nSalesHUB running on http://localhost:${PORT}\n`);
    console.log(`   App:          http://localhost:${PORT}`);
    console.log(`   PDF API:      http://localhost:${PORT}/api/pdf/generate`);
    console.log(`   Queue Status: http://localhost:${PORT}/api/pdf/queue-status`);
    console.log(`   Health:       http://localhost:${PORT}/health`);
    console.log(`   Ready:        http://localhost:${PORT}/ready`);
    console.log(`   Metrics:      http://localhost:${PORT}/metrics\n`);
  } else {
    console.log(`[${new Date().toISOString()}] SalesHUB started on port ${PORT}`);
  }
});
