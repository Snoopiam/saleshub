/**
 * PDF Controller
 * Handles PDF generation requests using Puppeteer
 *
 * FIXES APPLIED:
 * - M-06: Added metrics collection for PDF generation
 * - M-10: Added request queue to limit concurrent Puppeteer instances
 */

const puppeteerPdfService = require('../services/puppeteerPdfService');
const { recordPdfGeneration } = require('../services/metricsService');
const requestQueue = require('../services/requestQueue');

// Request timeout (60 seconds)
const REQUEST_TIMEOUT_MS = 60000;

// H-08: Maximum payment plan rows allowed
const MAX_PAYMENT_PLAN_ROWS = 50;

// H-10: Maximum image size (10MB - increased to support high-quality floor plans)
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Generate high-quality PDF with real selectable text
 * POST /api/pdf/generate
 * M-06: Records metrics for each generation attempt
 * M-10: Uses request queue to limit concurrency
 */
async function generatePDF(req, res) {
  const startTime = Date.now(); // M-06: Track start time

  try {
    const { data, branding, template } = req.body;

    // Validate input
    if (!data) {
      recordPdfGeneration(false, 0, 'validation_error');
      return res.status(400).json({ error: 'Offer data is required' });
    }

    // Validate data is an object
    if (typeof data !== 'object' || Array.isArray(data)) {
      recordPdfGeneration(false, 0, 'validation_error');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'data must be an object'
      });
    }

    // H-08: Validate and limit payment plan rows
    if (data.paymentPlan && Array.isArray(data.paymentPlan)) {
      if (data.paymentPlan.length > MAX_PAYMENT_PLAN_ROWS) {
        console.log(`[PDF] Truncating payment plan from ${data.paymentPlan.length} to ${MAX_PAYMENT_PLAN_ROWS} rows`);
        data.paymentPlan = data.paymentPlan.slice(0, MAX_PAYMENT_PLAN_ROWS);
      }
    }

    // H-10: Validate image sizes
    const imageSizeError = validateImageSizes(data, branding);
    if (imageSizeError) {
      recordPdfGeneration(false, Date.now() - startTime, 'image_too_large');
      return res.status(413).json({
        error: 'Image too large',
        message: imageSizeError
      });
    }

    // M-10: Check queue capacity before adding
    if (!requestQueue.hasCapacity()) {
      recordPdfGeneration(false, Date.now() - startTime, 'queue_full');
      return res.status(503).json({
        error: 'Server busy',
        message: 'Too many PDF requests. Please try again in a moment.',
        retryAfterMs: requestQueue.getEstimatedWaitMs()
      });
    }

    console.log('[PDF] Generating PDF for:', data.projectName || 'Unnamed');
    console.log('[PDF] Template:', template || 'landscape');
    console.log('[PDF] Queue status:', requestQueue.getQueueStatus());

    // M-10: Wrap PDF generation in queue
    const pdfBuffer = await requestQueue.enqueue(async () => {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PDF_TIMEOUT')), REQUEST_TIMEOUT_MS);
      });

      // Race between PDF generation and timeout
      return Promise.race([
        puppeteerPdfService.generatePDF(
          data,
          branding || {},
          template || 'landscape'
        ),
        timeoutPromise
      ]);
    });

    // Validate buffer
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      console.error('[PDF] Invalid buffer returned');
      recordPdfGeneration(false, Date.now() - startTime, 'empty_buffer');
      return res.status(500).json({
        error: 'PDF generation failed',
        message: 'Generated PDF is empty or invalid'
      });
    }

    // M-06: Record successful generation
    const durationMs = Date.now() - startTime;
    recordPdfGeneration(true, durationMs);

    // Set headers for downloadable PDF
    const filename = sanitizeFilename(data.projectName || 'SalesHUB_Offer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log('[PDF] Generated successfully:', filename, `(${pdfBuffer.length} bytes, ${durationMs}ms)`);

    res.send(pdfBuffer);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[PDF] Generation Error:', error.message);

    // M-10: Handle queue errors
    if (error.message === 'QUEUE_FULL') {
      recordPdfGeneration(false, durationMs, 'queue_full');
      return res.status(503).json({
        error: 'Server busy',
        message: 'Too many PDF requests. Please try again in a moment.'
      });
    }

    if (error.message === 'QUEUE_CLEARED') {
      recordPdfGeneration(false, durationMs, 'queue_cleared');
      return res.status(503).json({
        error: 'Server shutting down',
        message: 'Server is restarting. Please try again in a moment.'
      });
    }

    // Handle timeout
    if (error.message === 'PDF_TIMEOUT') {
      recordPdfGeneration(false, durationMs, 'timeout');
      return res.status(504).json({
        error: 'PDF generation timeout',
        message: 'The document took too long to generate. Try reducing image sizes.'
      });
    }

    // M-06: Classify error type for metrics
    let errorType = 'unknown';
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      errorType = 'timeout';
    } else if (error.message?.includes('Protocol error') || error.message?.includes('Target closed')) {
      errorType = 'browser_error';
    } else if (error.message?.includes('Connection closed')) {
      errorType = 'connection_error';
    } else if (error.message?.includes('memory') || error.message?.includes('OOM')) {
      errorType = 'memory_error';
    }

    recordPdfGeneration(false, durationMs, errorType);

    // Handle specific Puppeteer errors with user-friendly messages
    let userMessage = 'An error occurred while generating the PDF. Please try again.';

    if (errorType === 'timeout') {
      userMessage = 'PDF generation took too long. Try reducing image sizes.';
    } else if (errorType === 'browser_error') {
      userMessage = 'Browser error occurred. Please try again.';
    } else if (errorType === 'connection_error') {
      userMessage = 'Browser connection lost. Please try again.';
    } else if (errorType === 'memory_error') {
      userMessage = 'Server ran out of memory. Try reducing image sizes.';
    }

    res.status(500).json({
      error: 'PDF generation failed',
      message: userMessage
    });
  }
}

/**
 * H-10: Validate image sizes in request data
 * @param {Object} data - Offer data
 * @param {Object} branding - Branding data
 * @returns {string|null} Error message or null if valid
 */
function validateImageSizes(data, branding) {
  // Check floor plan image
  if (data?.floorPlanImage) {
    const size = getBase64Size(data.floorPlanImage);
    if (size > MAX_IMAGE_SIZE_BYTES) {
      return `Floor plan image too large (${(size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`;
    }
  }

  // Check logo
  if (branding?.logo) {
    const size = getBase64Size(branding.logo);
    if (size > MAX_IMAGE_SIZE_BYTES) {
      return `Logo image too large (${(size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`;
    }
  }

  return null;
}

/**
 * Get approximate size of base64 string in bytes
 * @param {string} base64 - Base64 encoded string
 * @returns {number} Size in bytes
 */
function getBase64Size(base64) {
  if (!base64 || typeof base64 !== 'string') return 0;

  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  if (!base64Data) return 0;

  // Base64 encodes 3 bytes into 4 characters
  // Account for padding
  const padding = (base64Data.match(/=/g) || []).length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
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
 * M-10: Get queue status endpoint
 * GET /api/pdf/queue-status
 */
function getQueueStatus(req, res) {
  res.json(requestQueue.getQueueStatus());
}

/**
 * H-18: Sanitize filename for safe download
 * Unified with frontend sanitization logic
 */
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'SalesHUB_Offer';

  return name
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100) || 'SalesHUB_Offer';
}

module.exports = { generatePDF, generatePreview, getQueueStatus, sanitizeFilename };
