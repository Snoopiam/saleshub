/**
 * PDF Export Module - Backend Integration
 * Uses Puppeteer backend for high-quality PDFs with real selectable text
 *
 * PERSISTENT IMAGE STORAGE:
 * - Original quality images stored in IndexedDB (survives page refresh)
 * - Compressed versions stored in localStorage (for preview/persistence)
 * - This module loads original images from IndexedDB for best PDF quality
 */

import { fileToBase64 } from '../utils/helpers.js';
import { getImageAsBase64 } from './imageStorage.js';

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
 * Convert image URL to base64 data URL
 * @param {string} url - Image URL (relative or absolute)
 * @returns {Promise<string>} Base64 data URL
 */
async function urlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to convert image to base64'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[PDF Export] Could not convert URL to base64:', error.message);
    return null;
  }
}

/**
 * Get logo from DOM element if available
 * Handles both data URLs and static file paths
 * @returns {Promise<string|null>} Base64 data URL or null
 */
async function getLogoFromDOM() {
  const logoImg = document.querySelector('#logoImg');
  if (!logoImg) return null;

  const src = logoImg.getAttribute('src');
  if (!src) return null;

  // If it's already a data URL, use it directly
  if (src.startsWith('data:image')) {
    console.log('[PDF Export] Using logo from DOM (data URL)');
    return src;
  }

  // If it's a file path, fetch and convert to base64
  if (src.startsWith('assets/') || src.startsWith('/') || src.startsWith('http')) {
    console.log('[PDF Export] Converting logo from file path:', src);
    const base64 = await urlToBase64(src);
    if (base64) {
      console.log('[PDF Export] Logo converted to base64 successfully');
      return base64;
    }
  }

  return null;
}

/**
 * Get original quality images for PDF export
 * Uses IndexedDB for persistent storage, falls back to window.originalImages, localStorage, or DOM
 * @param {Object} data - Offer data with compressed images
 * @param {Object} branding - Branding with compressed logo
 * @returns {Promise<{pdfData: Object, pdfBranding: Object}>}
 */
async function getOriginalImagesForPDF(data, branding) {
  // Clone objects to avoid mutating originals
  const pdfData = { ...data };
  const pdfBranding = { ...branding };

  // Try to get original floor plan from IndexedDB (persistent)
  try {
    const floorPlanBase64 = await getImageAsBase64('floorPlan');
    if (floorPlanBase64) {
      console.log('[PDF Export] Using original quality floor plan from IndexedDB');
      pdfData.floorPlanImage = floorPlanBase64;
    } else if (window.originalImages?.floorPlan) {
      // Fallback to memory if IndexedDB empty
      console.log('[PDF Export] Using original quality floor plan from memory');
      pdfData.floorPlanImage = await fileToBase64(window.originalImages.floorPlan);
    } else {
      console.log('[PDF Export] Using compressed floor plan from localStorage');
    }
  } catch (error) {
    console.warn('[PDF Export] Could not get original floor plan:', error.message);
  }

  // Try to get original logo from multiple sources
  try {
    // 1. Try IndexedDB first (original quality, persistent)
    const logoBase64 = await getImageAsBase64('logo');
    if (logoBase64) {
      console.log('[PDF Export] Using original quality logo from IndexedDB');
      pdfBranding.logo = logoBase64;
    }
    // 2. Try memory (original quality, session only)
    else if (window.originalImages?.logo) {
      console.log('[PDF Export] Using original quality logo from memory');
      pdfBranding.logo = await fileToBase64(window.originalImages.logo);
    }
    // 3. Try localStorage (compressed)
    else if (pdfBranding.logo) {
      console.log('[PDF Export] Using compressed logo from localStorage');
    }
    // 4. Try DOM element (static file or data URL)
    else {
      const domLogo = await getLogoFromDOM();
      if (domLogo) {
        pdfBranding.logo = domLogo;
      } else {
        console.log('[PDF Export] No logo found in any source');
      }
    }
  } catch (error) {
    console.warn('[PDF Export] Could not get logo:', error.message);
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

    // Get original quality images from IndexedDB for PDF
    const { pdfData, pdfBranding } = await getOriginalImagesForPDF(data, branding);

    // Debug log to verify branding
    console.log('[PDF Export] Branding data:', {
      hasLogo: !!pdfBranding.logo,
      logoLength: pdfBranding.logo?.length || 0,
      createdBy: pdfBranding.createdBy || '(empty)'
    });

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

    // Build filename: projectName_unitNo_HQ.pdf
    const filename = buildFilename(data.projectName, data.unitNo, 'HQ');
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
 * Get current branding from storage and DOM
 * Reads from localStorage, but falls back to DOM for createdBy text
 */
export function getCurrentBranding() {
  let branding = {
    companyName: 'Kennedy Property',
    primaryColor: '#62c6c1',
    logo: '',
    footerText: 'SALE OFFER',
    createdBy: '',
    labels: {}
  };

  try {
    const stored = localStorage.getItem('salesOfferApp');
    if (stored) {
      const state = JSON.parse(stored);
      branding = {
        companyName: state.branding?.companyName || 'Kennedy Property',
        primaryColor: state.branding?.primaryColor || '#62c6c1',
        logo: state.branding?.logo || '',
        footerText: state.branding?.footerText || 'SALE OFFER',
        createdBy: state.branding?.createdBy || '',
        labels: state.labels || {}
      };
    }
  } catch (e) {
    console.warn('[PDF Export] Could not read branding from storage:', e);
  }

  // If createdBy is empty, read from DOM (the hardcoded text in index.html)
  if (!branding.createdBy) {
    const createdByElement = document.querySelector('.created-by-footer');
    if (createdByElement) {
      const text = createdByElement.textContent?.trim() || '';
      if (text) {
        branding.createdBy = text;
        console.log('[PDF Export] Read createdBy from DOM:', text);
      }
    }
  }

  return branding;
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
 * Build filename from project name, unit number, and export type
 * Format: projectName_unitNo_exportType (e.g., palm-jumeirah_A-1205_HQ)
 */
function buildFilename(projectName, unitNo, exportType) {
  const parts = [];

  if (projectName) {
    parts.push(sanitizeFilename(projectName));
  }

  if (unitNo) {
    parts.push(sanitizeFilename(unitNo));
  }

  if (exportType) {
    parts.push(exportType);
  }

  return parts.length > 0 ? parts.join('_') : 'saleshub-offer';
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
