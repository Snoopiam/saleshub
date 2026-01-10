/**
 * PDF Controller
 * Handles PDF generation requests using Puppeteer
 */

const puppeteerPdfService = require('../services/puppeteerPdfService');

/**
 * Generate high-quality PDF with real selectable text
 * POST /api/pdf/generate
 */
async function generatePDF(req, res) {
  try {
    const { data, branding, template } = req.body;

    // Validate input
    if (!data) {
      return res.status(400).json({ error: 'Offer data is required' });
    }

    console.log('[PDF] Generating PDF for:', data.projectName || 'Unnamed');
    console.log('[PDF] Template:', template || 'landscape');

    // Generate PDF with Puppeteer
    const pdfBuffer = await puppeteerPdfService.generatePDF(
      data,
      branding || {},
      template || 'landscape'
    );

    // Set headers for downloadable PDF
    const filename = sanitizeFilename(data.projectName || 'SalesHUB_Offer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log('[PDF] Generated successfully:', filename, `(${pdfBuffer.length} bytes)`);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('[PDF] Generation Error:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message
    });
  }
}

/**
 * Generate preview (returns image)
 * POST /api/pdf/preview
 */
async function generatePreview(req, res) {
  try {
    const { data, branding, template } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Offer data is required' });
    }

    // For now, redirect to client-side preview
    // Could implement server-side preview with Puppeteer screenshot if needed
    res.status(501).json({
      message: 'Server-side preview not implemented. Use client-side preview.'
    });

  } catch (error) {
    console.error('[Preview] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100) || 'SalesHUB_Offer';
}

module.exports = { generatePDF, generatePreview };
