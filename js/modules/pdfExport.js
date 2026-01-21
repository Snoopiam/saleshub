/**
 * PDF Export Module - Backend Integration
 * Uses Puppeteer backend for high-quality PDFs with real selectable text
 *
 * PERSISTENT IMAGE STORAGE:
 * - Original quality images stored in IndexedDB (survives page refresh)
 * - Compressed versions stored in localStorage (for preview/persistence)
 * - This module loads original images from IndexedDB for best PDF quality
 *
 * FIXES APPLIED:
 * - H-05: Added user feedback for image conversion errors
 * - H-07: Fixed URL object memory leak with try-finally
 * - M-01: Added retry logic with exponential backoff
 * - M-11: Added progress indicators during retries
 */

import { fileToBase64, toast, showLoading } from '../utils/helpers.js';
import { getImageAsBase64 } from './imageStorage.js';

// API endpoint - relative path (same server serves frontend + API)
const API_BASE = '/api';

// Default timeout for PDF generation (60 seconds)
const PDF_TIMEOUT_MS = 60000;

// M-01: Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

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
 * M-01: Fetch with retry and exponential backoff
 * M-11: Updates loading indicator with progress during retries
 * Retries on network errors and 5xx server errors
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout per attempt in milliseconds
 * @param {string} operationName - Name of operation for progress display
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, timeoutMs = PDF_TIMEOUT_MS, operationName = 'Generating PDF') {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // M-11: Update progress indicator on each attempt
      if (attempt > 0) {
        showLoading(`${operationName}... (Retry ${attempt}/${MAX_RETRIES - 1})`);
      }

      const response = await fetchWithTimeout(url, options, timeoutMs);

      // Don't retry on client errors (4xx) - these are intentional
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx)
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        console.warn(`[PDF Export] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${lastError.message}`);

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
          console.log(`[PDF Export] Retrying in ${delay}ms...`);

          // M-11: Show countdown during retry delay
          showLoading(`Server busy. Retrying in ${Math.round(delay / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return response; // Return last response on final attempt
      }

      // Success (2xx/3xx)
      return response;

    } catch (error) {
      lastError = error;
      console.warn(`[PDF Export] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${error.message}`);

      // Don't retry on timeout errors (already took too long)
      if (error.message.includes('timed out')) {
        throw error;
      }

      // Retry on network errors
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        console.log(`[PDF Export] Retrying in ${delay}ms...`);

        // M-11: Show countdown during retry delay
        showLoading(`Connection failed. Retrying in ${Math.round(delay / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Convert image URL to base64 data URL
 * H-05: Shows toast warning on conversion failure
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
    // H-05: Show user feedback for image conversion errors
    toast('Warning: Could not load image. PDF may be missing some images.', 'warning');
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
 * Compress image if it exceeds size limit
 * Prevents 413 Payload Too Large errors on PDF generation
 * @param {string} base64Image - Base64 encoded image
 * @param {number} maxSizeKB - Maximum size in KB (default 8000 = 8MB)
 * @param {number} quality - JPEG quality (0-1, default 0.85)
 * @returns {Promise<string>} Compressed base64 image
 */
async function compressImageIfNeeded(base64Image, maxSizeKB = 8000, quality = 0.85) {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    return base64Image;
  }

  // Calculate current size in KB
  const base64Data = base64Image.split(',')[1] || base64Image;
  const currentSizeKB = Math.floor((base64Data.length * 3) / 4 / 1024);

  // If under limit, return as-is
  if (currentSizeKB <= maxSizeKB) {
    console.log(`[PDF Export] Image is ${currentSizeKB}KB, under ${maxSizeKB}KB limit`);
    return base64Image;
  }

  console.log(`[PDF Export] Compressing image from ${currentSizeKB}KB to under ${maxSizeKB}KB`);
  showLoading(`Compressing image (${currentSizeKB}KB -> ${maxSizeKB}KB)...`);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');

      // Calculate scale factor to reduce dimensions proportionally
      const ratio = Math.sqrt(maxSizeKB / currentSizeKB) * 0.9; // 0.9 safety margin
      canvas.width = Math.floor(img.width * ratio);
      canvas.height = Math.floor(img.height * ratio);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to JPEG for better compression
      const compressed = canvas.toDataURL('image/jpeg', quality);
      const newSizeKB = Math.floor((compressed.split(',')[1].length * 3) / 4 / 1024);
      console.log(`[PDF Export] Compressed to ${newSizeKB}KB (${canvas.width}x${canvas.height})`);

      resolve(compressed);
    };
    img.onerror = () => {
      console.warn('[PDF Export] Failed to compress image, using original');
      resolve(base64Image);
    };
    img.src = base64Image;
  });
}

/**
 * Get original quality images for PDF export
 * M-11: Shows progress during image loading
 * Uses IndexedDB for persistent storage, falls back to window.originalImages, localStorage, or DOM
 * @param {Object} data - Offer data with compressed images
 * @param {Object} branding - Branding with compressed logo
 * @returns {Promise<{pdfData: Object, pdfBranding: Object}>}
 */
async function getOriginalImagesForPDF(data, branding) {
  // M-11: Update progress
  showLoading('Preparing images...');

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
    // H-05: Show user feedback
    toast('Warning: Using compressed floor plan image.', 'warning');
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

  // Compress images if they exceed size limits to prevent 413 errors
  // Floor plan: max 8MB, Logo: max 2MB
  if (pdfData.floorPlanImage) {
    pdfData.floorPlanImage = await compressImageIfNeeded(pdfData.floorPlanImage, 8000);
  }
  if (pdfBranding.logo) {
    pdfBranding.logo = await compressImageIfNeeded(pdfBranding.logo, 2000);
  }

  return { pdfData, pdfBranding };
}

/**
 * Generate PDF using Puppeteer backend
 * M-01: Uses retry with exponential backoff for resilience
 * M-11: Shows progress during generation
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

    // M-11: Update progress
    showLoading('Sending to server...');

    // Debug log to verify branding
    console.log('[PDF Export] Branding data:', {
      hasLogo: !!pdfBranding.logo,
      logoLength: pdfBranding.logo?.length || 0,
      createdBy: pdfBranding.createdBy || '(empty)'
    });

    // M-01: Use fetchWithRetry for resilience
    // M-11: Pass operation name for progress display
    const response = await fetchWithRetry(`${API_BASE}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: pdfData,
        branding: pdfBranding,
        template: template
      })
    }, PDF_TIMEOUT_MS, 'Generating PDF');

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

    // M-11: Update progress
    showLoading('Downloading PDF...');

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
 * H-07: Download blob as file with proper cleanup
 * Wrapped in try-finally to ensure URL is always revoked
 */
function downloadBlob(blob, filename) {
  let url = null;
  try {
    url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // H-07: Always revoke URL to prevent memory leak
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
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
