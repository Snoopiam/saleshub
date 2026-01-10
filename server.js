require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pdfRoutes = require('./backend/src/routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:8000', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api', pdfRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SalesHUB Backend running on http://localhost:${PORT}`);
  console.log(`📊 PDF Generation: /api/pdf/generate`);
  console.log(`📝 Templates: /api/templates`);
  console.log(`⚙️  Settings: /api/settings`);
});
