/**
 * Puppeteer PDF Service
 * Generates high-quality PDFs with real selectable text
 * Layout matches the live preview exactly
 *
 * FIXES APPLIED:
 * - Added mutex lock to prevent race conditions on browser access
 * - Added retry logic for connection errors
 * - Improved error handling for browser disconnection
 * - Fixed: Convert Uint8Array to Buffer for proper response handling
 * - Synced CSS with frontend preview styles (shadow, fonts, footer)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

// Connection error patterns that should trigger retry
const CONNECTION_ERROR_PATTERNS = [
  'Connection closed',
  'Target closed',
  'Protocol error',
  'Session closed',
  'Browser disconnected',
  'Navigation failed'
];

class PuppeteerPdfService {
  constructor() {
    this.browser = null;
    this.browserLock = Promise.resolve(); // Mutex for browser access
  }

  /**
   * Check if error is a connection-related error that warrants retry
   */
  isConnectionError(error) {
    const message = error?.message || '';
    return CONNECTION_ERROR_PATTERNS.some(pattern => message.includes(pattern));
  }

  /**
   * Initialize browser instance with mutex lock to prevent race conditions
   * Multiple concurrent requests will wait for the lock before accessing browser
   */
  async getBrowser() {
    return new Promise((resolve, reject) => {
      this.browserLock = this.browserLock.then(async () => {
        try {
          // Check if browser exists AND is still connected
          if (!this.browser || !this.browser.isConnected()) {
            if (this.browser) {
              console.log('[Puppeteer] Browser disconnected, relaunching...');
              try {
                await this.browser.close();
              } catch (e) {
                // Ignore close errors on disconnected browser
              }
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

            // Handle browser disconnect events
            this.browser.on('disconnected', () => {
              console.log('[Puppeteer] Browser disconnected event');
              this.browser = null;
            });

            console.log('[Puppeteer] Browser launched successfully');
          }
          resolve(this.browser);
        } catch (error) {
          console.error('[Puppeteer] Failed to get browser:', error.message);
          reject(error);
        }
      });
    });
  }

  /**
   * Force browser restart - used after connection errors
   */
  async forceRestartBrowser() {
    console.log('[Puppeteer] Force restarting browser...');
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    this.browser = null;
    return this.getBrowser();
  }

  /**
   * Generate PDF from offer data with retry logic
   * @param {Object} data - Offer data (matches frontend state)
   * @param {Object} branding - Branding settings (logo, colors, etc.)
   * @param {string} template - Template type: 'landscape', 'portrait', 'minimal'
   * @param {number} maxRetries - Maximum retry attempts (default: 2)
   * @returns {Buffer} PDF buffer
   */
  async generatePDF(data, branding = {}, template = 'landscape', maxRetries = 2) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this._generatePDFInternal(data, branding, template);
      } catch (error) {
        lastError = error;

        // Check if this is a connection error that warrants retry
        if (this.isConnectionError(error) && attempt <= maxRetries) {
          console.log(`[Puppeteer] Connection error on attempt ${attempt}/${maxRetries + 1}: ${error.message}`);
          console.log('[Puppeteer] Restarting browser and retrying...');

          // Force browser restart before retry
          try {
            await this.forceRestartBrowser();
          } catch (restartError) {
            console.error('[Puppeteer] Failed to restart browser:', restartError.message);
          }

          continue;
        }

        // Non-recoverable error or max retries exceeded
        throw error;
      }
    }

    // Should not reach here, but just in case
    throw lastError;
  }

  /**
   * Internal PDF generation logic (called by generatePDF with retry wrapper)
   */
  async _generatePDFInternal(data, branding, template) {
    const browser = await this.getBrowser();
    let page;

    try {
      page = await browser.newPage();

      // Generate HTML from template
      const html = this.generateHTML(data, branding, template);

      // Set content with networkidle0 for complete resource loading
      await page.setContent(html, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 30000
      });

      // Wait for fonts with timeout to prevent hanging
      try {
        await Promise.race([
          page.evaluateHandle('document.fonts.ready'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Font timeout')), 10000)
          )
        ]);
        console.log('[Puppeteer] Fonts loaded successfully');
      } catch (fontError) {
        console.warn('[Puppeteer] Font loading timeout - PDF may use fallback fonts');
      }

      // Generate PDF
      const isPortrait = template === 'portrait';
      const pdfData = await page.pdf({
        format: 'A4',
        landscape: !isPortrait,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      // FIXED: Puppeteer returns Uint8Array, convert to Node.js Buffer
      return Buffer.from(pdfData);

    } finally {
      // Safe page close with error handling
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.error('[Puppeteer] Error closing page:', closeError.message);
        }
      }
    }
  }

  /**
   * Generate HTML that matches the live preview
   * CSS synchronized with frontend preview.css and landscape.css
   */
  generateHTML(data, branding, template) {
    const primaryColor = branding.primaryColor || '#62c6c1';
    const companyName = branding.companyName || 'Kennedy Property';
    const footerText = branding.footerText || 'SALE OFFER';
    const createdBy = branding.createdBy || '';
    const isPortrait = template === 'portrait';
    const isOffPlan = data.category !== 'ready';

    // Format currency helper
    const formatCurrency = (value) => {
      if (!value) return '-';
      const num = parseFloat(value);
      if (isNaN(num)) return '-';
      return `AED ${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    };

    // Format area helper
    const formatArea = (value) => {
      if (!value) return '-';
      const num = parseFloat(value);
      if (isNaN(num)) return '-';
      return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Sq.Ft`;
    };

    // Generate payment plan rows
    const paymentPlanRows = (data.paymentPlan || []).map(row => `
      <tr>
        <td>${row.date || '-'}</td>
        <td style="text-align: center;">${row.percentage || '-'}%</td>
        <td style="text-align: right;">${formatCurrency(row.amount)}</td>
      </tr>
    `).join('');

    // Logo HTML
    const logoHtml = branding.logo
      ? `<img src="${branding.logo}" alt="Logo" class="logo-img" />`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.projectName || 'Sales Offer'}</title>
  <!-- SYNCED: Font weights match frontend index.html -->
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary-color: ${primaryColor};
      --text-dark: #1a1a1a;
      --text-gray: #4a5568;
      --text-gray-medium: #6b7280;
      --text-emphasis: #2d3748;
      --border-light: #e2e8f0;
      --border-lighter: #edf2f7;
      --paper-bg: #fafafa;
    }

    @page {
      size: A4 ${isPortrait ? 'portrait' : 'landscape'};
      margin: 0;
    }

    body {
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
      background: white;
      color: var(--text-dark);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .a4-page {
      width: ${isPortrait ? '210mm' : '297mm'};
      height: ${isPortrait ? '297mm' : '210mm'};
      padding: 40px;
      position: relative;
      background: var(--paper-bg);
      display: flex;
      flex-direction: column;
    }

    /* Header Bar */
    .header-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 8mm;
      background-color: var(--primary-color);
    }

    /* Logo - SYNCED with landscape.css */
    .logo-area {
      position: absolute;
      top: 12mm;
      right: 15mm;
      width: 130px;
      height: 65px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }

    .logo-img {
      max-height: 60px;
      max-width: 100%;
      width: auto;
      object-fit: contain;
    }

    /* Document Header */
    .document-header {
      margin-top: 5mm;
      margin-bottom: 20px;
    }

    .main-title {
      font-size: ${isPortrait ? '32px' : '40px'};
      font-weight: 900;
      color: var(--text-dark);
      line-height: 1;
      letter-spacing: -0.02em;
    }

    /* Content Row */
    .content-row {
      display: flex;
      flex-direction: ${isPortrait ? 'column' : 'row'};
      gap: 30px;
      flex: 1;
      align-items: flex-start;
      min-height: 0;
    }

    .column-left {
      width: ${isPortrait ? '100%' : '40%'};
      display: flex;
      flex-direction: column;
    }

    .column-right {
      width: ${isPortrait ? '100%' : '60%'};
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 20px;
    }

    /* Floor Plan - SYNCED: shadow opacity matches preview.css */
    .floorplan-frame {
      width: 100%;
      height: ${isPortrait ? '80mm' : '140mm'};
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .floorplan-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      /* SYNCED: Matches preview.css drop-shadow opacity (0.603) */
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.603));
    }

    /* Tables */
    .table-title {
      color: var(--primary-color);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      padding: 8px 0 6px 0;
      text-align: left;
    }

    .data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 10px;
      margin-bottom: 10px;
    }

    .data-table td {
      padding: 3px 0;
      border-bottom: 1px solid var(--border-lighter);
      vertical-align: middle;
    }

    .data-table td:first-child {
      font-weight: 600;
      width: 65%;
      color: var(--text-gray);
      padding-right: 10px;
    }

    .data-table td:last-child {
      font-weight: 500;
      color: var(--text-emphasis);
      text-align: right;
      padding-left: 10px;
    }

    .divider-row td {
      height: 12px;
      border-bottom: none !important;
    }

    .total-row td {
      border-top: 2px solid var(--border-light);
      border-bottom: none;
      font-weight: 800;
      color: var(--text-dark);
      padding-top: 8px;
      font-size: 11px;
    }

    /* Payment Plan Table */
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .payment-table th {
      color: var(--primary-color);
      font-weight: 700;
      font-size: 11px;
      padding: 3px 0;
      text-align: left;
    }

    .payment-table th:nth-child(2) { text-align: center; }
    .payment-table th:nth-child(3) { text-align: right; }

    .payment-table td {
      padding: 3px 0;
      border-bottom: 1px solid var(--border-lighter);
    }

    /* Footer - SYNCED with preview.css */
    .footer-area {
      position: absolute;
      bottom: 12mm;
      right: 15mm;
      text-align: right;
    }

    /* SYNCED: font-size matches preview.css (14px, not 18px) */
    .footer-proj {
      font-weight: 900;
      font-size: 14px;
      color: var(--text-dark);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .footer-sub {
      font-size: 10px;
      color: var(--primary-color);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-top: 4px;
    }

    /* Created By Footer - SYNCED with preview.css */
    .created-by-footer {
      position: absolute;
      bottom: 5mm;
      left: 15mm;
      right: 15mm;
      text-align: center;
      font-size: 8px;
      color: var(--text-gray-medium);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      /* SYNCED: Prevent text wrapping, matches preview.css */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div class="a4-page">
    <div class="header-bar"></div>

    <div class="logo-area">
      ${logoHtml}
    </div>

    <div class="document-header">
      <div class="main-title">${data.bedrooms || data.unitModel || '-'}</div>
    </div>

    <div class="content-row">
      <div class="column-left">
        <!-- Property Details -->
        <div class="table-title">Property Details</div>
        <table class="data-table">
          <tbody>
            <tr>
              <td>Unit No</td>
              <td>${data.unitNo || '-'}</td>
            </tr>
            <tr>
              <td>Unit Type</td>
              <td>${data.unitType || '-'}</td>
            </tr>
            <tr>
              <td>Views</td>
              <td>${data.views || '-'}</td>
            </tr>
            <tr>
              <td>Internal Area</td>
              <td>${formatArea(data.internalArea)}</td>
            </tr>
            <tr>
              <td>Balcony Area</td>
              <td>${formatArea(data.balconyArea)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Area</td>
              <td>${formatArea(data.totalArea)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Financial Breakdown -->
        <div class="table-title">Financial Breakdown</div>
        <table class="data-table">
          <tbody>
            ${isOffPlan ? `
            <tr>
              <td>Original Price</td>
              <td>${formatCurrency(data.originalPrice)}</td>
            </tr>
            ` : ''}
            <tr>
              <td>Selling Price</td>
              <td>${formatCurrency(data.sellingPrice)}</td>
            </tr>
            ${isOffPlan ? `
            <tr class="divider-row"><td colspan="2"></td></tr>
            <tr>
              <td>${branding.labels?.refund || 'Refund (Amount Paid to Developer)'}</td>
              <td>${formatCurrency(data.refund)}</td>
            </tr>
            <tr>
              <td>${branding.labels?.balance || 'Balance Resale Clause'}</td>
              <td>${formatCurrency(data.balanceResale)}</td>
            </tr>
            <tr>
              <td>${branding.labels?.premium || 'Premium (Selling Price - Original Price)'}</td>
              <td>${formatCurrency(data.premium)}</td>
            </tr>
            ` : ''}
            <tr>
              <td>${branding.labels?.admin || 'Admin Fees (SAAS)'}</td>
              <td>${formatCurrency(data.adminFees)}</td>
            </tr>
            <tr>
              <td>${branding.labels?.adgm || 'ADGM Reg. Fee (2% of Original Price)'}</td>
              <td>${formatCurrency(data.adgmTransfer)}</td>
            </tr>
            ${data.adgmTermination ? `
            <tr>
              <td>ADGM Termination Fee</td>
              <td>${formatCurrency(data.adgmTermination)}</td>
            </tr>
            ` : ''}
            ${data.adgmElectronic ? `
            <tr>
              <td>ADGM Electronic Service Fee</td>
              <td>${formatCurrency(data.adgmElectronic)}</td>
            </tr>
            ` : ''}
            <tr>
              <td>${branding.labels?.agency || 'Agency Fees (2% of Selling Price + VAT)'}</td>
              <td>${formatCurrency(data.agencyFees)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Initial Payment</td>
              <td>${formatCurrency(data.totalPayment)}</td>
            </tr>
          </tbody>
        </table>

        ${isOffPlan && data.paymentPlan?.length > 0 ? `
        <!-- Payment Plan -->
        <div class="table-title">Payment Plan</div>
        <table class="payment-table">
          <thead>
            <tr>
              <th>Date of Payment</th>
              <th>%</th>
              <th>Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            ${paymentPlanRows}
          </tbody>
        </table>
        ` : ''}
      </div>

      <div class="column-right">
        <div class="floorplan-frame">
          ${data.floorPlanImage ? `<img src="${data.floorPlanImage}" alt="Floor Plan" class="floorplan-img" />` : ''}
        </div>
      </div>
    </div>

    <div class="footer-area">
      <div class="footer-proj">${data.projectName || '-'}</div>
      <div class="footer-sub">${footerText}</div>
    </div>

    ${createdBy ? `<div class="created-by-footer">${createdBy}</div>` : ''}
  </div>
</body>
</html>
    `;
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('[Puppeteer] Error closing browser:', error.message);
      }
      this.browser = null;
    }
  }
}

module.exports = new PuppeteerPdfService();
