require('dotenv').config();
const express = require('express');
const path = require('path');
const pdfRoutes = require('./backend/src/routes');

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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SalesHUB running on http://localhost:${PORT}\n`);
  console.log(`   📄 App:          http://localhost:${PORT}`);
  console.log(`   📊 PDF API:      http://localhost:${PORT}/api/pdf/generate`);
  console.log(`   ❤️  Health:       http://localhost:${PORT}/health\n`);
});
