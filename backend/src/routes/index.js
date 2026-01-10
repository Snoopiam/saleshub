const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const templateController = require('../controllers/templateController');
const settingsController = require('../controllers/settingsController');

// ===== PDF Generation =====
router.post('/pdf/generate', pdfController.generatePDF);
router.post('/pdf/preview', pdfController.generatePreview);

// ===== Templates =====
router.get('/templates', templateController.listTemplates);
router.post('/templates', templateController.createTemplate);
router.get('/templates/:id', templateController.getTemplate);
router.put('/templates/:id', templateController.updateTemplate);
router.delete('/templates/:id', templateController.deleteTemplate);

// ===== Settings =====
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

// ===== Branding =====
router.get('/branding', settingsController.getBranding);
router.put('/branding', settingsController.updateBranding);

module.exports = router;
