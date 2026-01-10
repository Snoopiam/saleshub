/**
 * PDF Export Module - Backend Integration
 * Uses Puppeteer backend for high-quality PDFs with real selectable text
 */

// API endpoint - relative path (same server serves frontend + API)
const API_BASE = '/api';

/**
 * Generate PDF using Puppeteer backend
 * @param {Object} data - Offer data from getCurrentOffer()
 * @param {Object} branding - Branding settings
 * @param {string} template - Template type: 'landscape', 'portrait', 'minimal'
 * @returns {Promise<{success: boolean}>}
 */
export async function generatePDF(data, branding = {}, template = 'landscape') {
  try {
    console.log('[PDF Export] Generating PDF...');

    const response = await fetch(`${API_BASE}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: data,
        branding: branding,
        template: template
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    // Download the PDF
    const blob = await response.blob();
    const filename = sanitizeFilename(data.projectName || 'SalesHUB_Offer');

    downloadBlob(blob, `${filename}.pdf`);

    return { success: true };

  } catch (error) {
    console.error('[PDF Export] Error:', error);
    throw error;
  }
}

/**
 * Check if backend is available
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch('/health', {
      method: 'GET'
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current branding from storage
 */
export function getCurrentBranding() {
  try {
    const stored = localStorage.getItem('salesOfferApp');
    if (stored) {
      const state = JSON.parse(stored);
      return {
        companyName: state.branding?.companyName || 'Kennedy Property',
        primaryColor: state.branding?.primaryColor || '#62c6c1',
        logo: state.branding?.logo || '',
        footerText: state.branding?.footerText || 'SALE OFFER',
        createdBy: state.branding?.createdBy || '',
        labels: state.labels || {}
      };
    }
  } catch (e) {
    console.warn('[PDF Export] Could not read branding:', e);
  }

  return {
    companyName: 'Kennedy Property',
    primaryColor: '#62c6c1',
    logo: '',
    footerText: 'SALE OFFER',
    createdBy: '',
    labels: {}
  };
}

/**
 * Download blob as file
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .substring(0, 100) || 'saleshub-offer';
}

/**
 * Legacy exports for backwards compatibility
 */
export async function saveAsTemplate(name, data) {
  try {
    const response = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data, createdAt: new Date() })
    });
    if (!response.ok) throw new Error('Failed to save template');
    return await response.json();
  } catch (error) {
    console.error('[Template] Save Error:', error);
    throw error;
  }
}

export async function loadTemplates() {
  try {
    const response = await fetch(`${API_BASE}/templates`);
    if (!response.ok) throw new Error('Failed to load templates');
    return await response.json();
  } catch (error) {
    console.error('[Template] Load Error:', error);
    return [];
  }
}

export async function loadTemplate(id) {
  try {
    const response = await fetch(`${API_BASE}/templates/${id}`);
    if (!response.ok) throw new Error('Failed to load template');
    return await response.json();
  } catch (error) {
    console.error('[Template] Load Error:', error);
    throw error;
  }
}

export async function updateBranding(branding) {
  try {
    const response = await fetch(`${API_BASE}/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding)
    });
    if (!response.ok) throw new Error('Failed to update branding');
    return await response.json();
  } catch (error) {
    console.error('[Branding] Update Error:', error);
    throw error;
  }
}
