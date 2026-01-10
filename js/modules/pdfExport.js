/**
 * PDF Export Module - Backend Integration
 * Uses Puppeteer backend for high-quality PDFs with real selectable text
 *
 * DUAL STORAGE STRATEGY:
 * - Original quality images stored in window.originalImages (for PDF export)
 * - Compressed versions stored in localStorage (for preview/persistence)
 * - This module uses original images when available for best PDF quality
 */

import { fileToBase64 } from '../utils/helpers.js';

// API endpoint - relative path (same server serves frontend + API)
const API_BASE = '/api';

// Default timeout for PDF generation (60 seconds)
const PDF_TIMEOUT_MS = 60000;

/**
 * Fetch with timeout using AbortController
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = PDF_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The PDF is taking too long to generate.');
    }
    throw error;
  }
}

/**
 * Get original quality images for PDF export
 * Uses window.originalImages if available, falls back to localStorage versions
 * @param {Object} data - Offer data with compressed images
 * @param {Object} branding - Branding with compressed logo
 * @returns {Promise<{pdfData: Object, pdfBranding: Object}>}
 */
async function getOriginalImagesForPDF(data, branding) {
  // Clone objects to avoid mutating originals
  const pdfData = { ...data };
  const pdfBranding = { ...branding };

  // DUAL STORAGE: Use original floor plan if available
  if (window.originalImages?.floorPlan) {
    try {
      console.log('[PDF Export] Using original quality floor plan');
      pdfData.floorPlanImage = await fileToBase64(window.originalImages.floorPlan);
    } catch (error) {
      console.warn('[PDF Export] Could not read original floor plan, using compressed:', error.message);
      // Keep the compressed version from data
    }
  }

  // DUAL STORAGE: Use original logo if available
  if (window.originalImages?.logo) {
    try {
      console.log('[PDF Export] Using original quality logo');
      pdfBranding.logo = await fileToBase64(window.originalImages.logo);
    } catch (error) {
      console.warn('[PDF Export] Could not read original logo, using compressed:', error.message);
      // Keep the compressed version from branding
    }
  }

  return { pdfData, pdfBranding };
}

/**
 * Generate PDF using Puppeteer backend
 * @param {Object} data - Offer data from getCurrentOffer()
 * @param {Object} branding - Branding settings
 * @param {string} template - Template type: 'landscape', 'portrait', 'minimal'
 * @returns {Promise<{success: boolean}>}
 */
export async function generatePDF(data, branding = {}, template = 'landscape') {
  // Check if offline
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  try {
    console.log('[PDF Export] Generating PDF...');

    // DUAL STORAGE: Get original quality images for PDF
    const { pdfData, pdfBranding } = await getOriginalImagesForPDF(data, branding);

    const response = await fetchWithTimeout(`${API_BASE}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: pdfData,
        branding: pdfBranding,
        template: template
      })
    }, PDF_TIMEOUT_MS);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle specific status codes
      if (response.status === 504) {
        throw new Error('PDF generation timed out. Try reducing image sizes or simplifying the document.');
      }
      if (response.status === 413) {
        throw new Error('Document too large. Please reduce image sizes.');
      }

      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    // Validate response content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/pdf')) {
      throw new Error('Invalid response from server. Expected PDF file.');
    }

    // Download the PDF
    const blob = await response.blob();

    // Validate blob
    if (!blob || blob.size === 0) {
      throw new Error('Received empty PDF file. Please try again.');
    }

    const filename = sanitizeFilename(data.projectName || 'SalesHUB_Offer');
    downloadBlob(blob, `${filename}.pdf`);

    return { success: true };

  } catch (error) {
    console.error('[PDF Export] Error:', error);

    // Provide user-friendly error messages
    if (error.name === 'TypeError' && !navigator.onLine) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please ensure the server is running.');
    }

    throw error;
  }
}

/**
 * Check if backend is available
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check

    const response = await fetch('/health', {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
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
    const response = await fetchWithTimeout(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data, createdAt: new Date() })
    }, 30000);
    if (!response.ok) throw new Error('Failed to save template');
    return await response.json();
  } catch (error) {
    console.error('[Template] Save Error:', error);
    throw error;
  }
}

export async function loadTemplates() {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/templates`, {}, 10000);
    if (!response.ok) throw new Error('Failed to load templates');
    return await response.json();
  } catch (error) {
    console.error('[Template] Load Error:', error);
    return [];
  }
}

export async function loadTemplate(id) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/templates/${id}`, {}, 10000);
    if (!response.ok) throw new Error('Failed to load template');
    return await response.json();
  } catch (error) {
    console.error('[Template] Load Error:', error);
    throw error;
  }
}

export async function updateBranding(branding) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding)
    }, 10000);
    if (!response.ok) throw new Error('Failed to update branding');
    return await response.json();
  } catch (error) {
    console.error('[Branding] Update Error:', error);
    throw error;
  }
}
