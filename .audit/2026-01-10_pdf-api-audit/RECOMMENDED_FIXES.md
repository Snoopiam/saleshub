# Recommended Fixes for PDF Generation Endpoint

## Fix 1: Add Retry Logic to PuppeteerPdfService

**Location:** `backend/src/services/puppeteerPdfService.js`

Add retry wrapper around `generatePDF`:

```javascript
/**
 * Generate PDF with retry logic
 * @param {Object} data - Offer data
 * @param {Object} branding - Branding settings
 * @param {string} template - Template type
 * @param {number} retries - Number of retries (default: 2)
 * @returns {Buffer} PDF buffer
 */
async generatePDF(data, branding = {}, template = 'landscape', retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const browser = await this.getBrowser();
      let page;

      try {
        page = await browser.newPage();

        const html = this.generateHTML(data, branding, template);

        await page.setContent(html, {
          waitUntil: ['load', 'domcontentloaded'],
          timeout: 30000
        });

        // Wait for fonts with timeout
        try {
          await Promise.race([
            page.evaluateHandle('document.fonts.ready'),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Font timeout')), 10000)
            )
          ]);
        } catch (fontError) {
          console.warn('[Puppeteer] Font loading timeout, continuing anyway');
        }

        const isPortrait = template === 'portrait';
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: !isPortrait,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        return pdfBuffer;

      } finally {
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            console.error('[Puppeteer] Error closing page:', closeError.message);
          }
        }
      }
    } catch (error) {
      const isConnectionError =
        error.message?.includes('Connection closed') ||
        error.message?.includes('Target closed') ||
        error.message?.includes('Protocol error') ||
        error.message?.includes('Session closed');

      if (isConnectionError && attempt <= retries) {
        console.log(`[Puppeteer] Connection error on attempt ${attempt}, retrying...`);
        // Force browser restart
        this.browser = null;
        continue;
      }

      throw error;
    }
  }
}
```

---

## Fix 2: Add Mutex for Browser Access

Add a simple mutex to prevent race conditions:

```javascript
class PuppeteerPdfService {
  constructor() {
    this.browser = null;
    this.browserLock = Promise.resolve();
  }

  /**
   * Get browser with mutex lock to prevent race conditions
   */
  async getBrowser() {
    return new Promise((resolve, reject) => {
      this.browserLock = this.browserLock.then(async () => {
        try {
          if (!this.browser || !this.browser.isConnected()) {
            if (this.browser) {
              console.log('[Puppeteer] Browser disconnected, relaunching...');
              this.browser = null;
            }

            console.log('[Puppeteer] Launching browser...');
            this.browser = await puppeteer.launch({
              headless: 'new',
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--font-render-hinting=none'
              ]
            });

            this.browser.on('disconnected', () => {
              console.log('[Puppeteer] Browser disconnected event');
              this.browser = null;
            });

            console.log('[Puppeteer] Browser launched successfully');
          }
          resolve(this.browser);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}
```

---

## Fix 3: Add Async Handler Wrapper

**Location:** `backend/src/routes/index.js`

```javascript
const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// PDF Generation - wrapped with async handler
router.post('/pdf/generate', asyncHandler(pdfController.generatePDF));
router.post('/pdf/preview', asyncHandler(pdfController.generatePreview));

// ... rest of routes
```

---

## Fix 4: Add Circuit Breaker (Optional but Recommended)

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailure = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF-OPEN';
        console.log('[CircuitBreaker] Entering HALF-OPEN state');
      } else {
        const error = new Error('Service temporarily unavailable');
        error.status = 503;
        error.retryAfter = Math.ceil((this.resetTimeout - (Date.now() - this.lastFailure)) / 1000);
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`[CircuitBreaker] Circuit OPEN after ${this.failures} failures`);
    }
  }
}

// Usage in pdfController.js
const circuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });

async function generatePDF(req, res) {
  try {
    const pdfBuffer = await circuitBreaker.execute(() =>
      puppeteerPdfService.generatePDF(data, branding, template)
    );
    // ... rest of handler
  } catch (error) {
    if (error.status === 503) {
      return res.status(503)
        .set('Retry-After', error.retryAfter)
        .json({
          error: 'Service temporarily unavailable',
          message: 'PDF generation is temporarily disabled. Please try again later.',
          retryAfter: error.retryAfter
        });
    }
    // ... rest of error handling
  }
}
```

---

## Quick Test to Verify Fix

After applying fixes, test with:

```bash
# Run server
npm start

# Test PDF generation (requires curl)
curl -X POST http://localhost:8000/api/pdf/generate \
  -H "Content-Type: application/json" \
  -d '{"data":{"projectName":"Test","unitNo":"101"}}' \
  -o test.pdf

# Check if PDF was created
ls -la test.pdf
```

---

## Verification Checklist

After applying fixes, verify:

- [ ] PDF generates successfully on first attempt
- [ ] If browser crashes, retry succeeds
- [ ] No "Connection closed" errors in logs
- [ ] Concurrent requests don't cause race conditions
- [ ] Server handles graceful shutdown properly

---

*These fixes address the critical issues identified in the audit report.*
