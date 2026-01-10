/**
 * PDF Controller
 * Handles PDF generation requests using Puppeteer
 */

const puppeteerPdfService = require('../services/puppeteerPdfService');

// Request timeout (60 seconds)
const REQUEST_TIMEOUT_MS = 60000;

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

    // Validate data is an object
    if (typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'data must be an object'
      });
    }

    console.log('[PDF] Generating PDF for:', data.projectName || 'Unnamed');
    console.log('[PDF] Template:', template || 'landscape');

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF_TIMEOUT')), REQUEST_TIMEOUT_MS);
    });

    // Race between PDF generation and timeout
    const pdfBuffer = await Promise.race([
      puppeteerPdfService.generatePDF(
        data,
        branding || {},
        template || 'landscape'
      ),
      timeoutPromise
    ]);

    // Validate buffer
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      console.error('[PDF] Invalid buffer returned');
      return res.status(500).json({
        error: 'PDF generation failed',
        message: 'Generated PDF is empty or invalid'
      });
    }

    // Set headers for downloadable PDF
    const filename = sanitizeFilename(data.projectName || 'SalesHUB_Offer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log('[PDF] Generated successfully:', filename, `(${pdfBuffer.length} bytes)`);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('[PDF] Generation Error:', error.message);

    // Handle timeout
    if (error.message === 'PDF_TIMEOUT') {
      return res.status(504).json({
        error: 'PDF generation timeout',
        message: 'The document took too long to generate. Try reducing image sizes.'
      });
    }

    // Handle specific Puppeteer errors with user-friendly messages
    let userMessage = 'An error occurred while generating the PDF. Please try again.';

    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      userMessage = 'PDF generation took too long. Try reducing image sizes.';
    } else if (error.message?.includes('Protocol error') || error.message?.includes('Target closed')) {
      userMessage = 'Browser error occurred. Please try again.';
    } else if (error.message?.includes('Connection closed')) {
      userMessage = 'Browser connection lost. Please try again.';
    } else if (error.message?.includes('memory') || error.message?.includes('OOM')) {
      userMessage = 'Server ran out of memory. Try reducing image sizes.';
    }

    res.status(500).json({
      error: 'PDF generation failed',
      message: userMessage
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
      error: 'Not Implemented',
      message: 'Server-side preview not implemented. Use client-side preview.'
    });

  } catch (error) {
    console.error('[Preview] Error:', error.message);
    res.status(500).json({
      error: 'Preview generation failed',
      message: 'An error occurred while generating the preview.'
    });
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
