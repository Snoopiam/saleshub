const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const templateController = require('../controllers/templateController');
const settingsController = require('../controllers/settingsController');

/**
 * Async handler wrapper to catch errors in async route handlers
 * Ensures all async errors are properly forwarded to Express error middleware
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ===== PDF Generation =====
router.post('/pdf/generate', asyncHandler(pdfController.generatePDF));
router.post('/pdf/preview', asyncHandler(pdfController.generatePreview));
router.get('/pdf/queue-status', pdfController.getQueueStatus); // M-10: Queue status endpoint

// ===== Templates =====
router.get('/templates', asyncHandler(templateController.listTemplates));
router.post('/templates', asyncHandler(templateController.createTemplate));
router.get('/templates/:id', asyncHandler(templateController.getTemplate));
router.put('/templates/:id', asyncHandler(templateController.updateTemplate));
router.delete('/templates/:id', asyncHandler(templateController.deleteTemplate));

// ===== Settings =====
router.get('/settings', asyncHandler(settingsController.getSettings));
router.put('/settings', asyncHandler(settingsController.updateSettings));

// ===== Branding =====
router.get('/branding', asyncHandler(settingsController.getBranding));
router.put('/branding', asyncHandler(settingsController.updateBranding));

module.exports = router;
