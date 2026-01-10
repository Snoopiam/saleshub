require('dotenv').config();
const express = require('express');
const path = require('path');
const pdfRoutes = require('./backend/src/routes');
const puppeteerPdfService = require('./backend/src/services/puppeteerPdfService');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes (before static files)
app.use('/api', pdfRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend files
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler for API routes
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);

  if (res.headersSent) {
    return next(err);
  }

  if (req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      error: err.name || 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }

  res.status(err.status || 500).sendFile(path.join(__dirname, 'index.html'));
});

// Graceful shutdown handlers
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Closing browser and shutting down...`);
  try {
    await puppeteerPdfService.close();
    console.log('Browser closed successfully');
  } catch (error) {
    console.error('Error closing browser:', error.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await puppeteerPdfService.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
app.listen(PORT, () => {
  console.log(`\nSalesHUB running on http://localhost:${PORT}\n`);
  console.log(`   App:          http://localhost:${PORT}`);
  console.log(`   PDF API:      http://localhost:${PORT}/api/pdf/generate`);
  console.log(`   Health:       http://localhost:${PORT}/health\n`);
});
