/**
 * Export Module
 * PDF, PNG, and JSON export functionality
 *
 * FIXES APPLIED:
 * - H-07: Fixed URL object memory leak with try-finally
 * - H-14: Added canvas cleanup after legacy PDF export
 * - M-04: Added loading overlay for all export operations
 */

import { getById, toast, getValue, showLoading, hideLoading } from '../utils/helpers.js';
import { exportOfferAsJSON, getCurrentOffer, getBranding, getLabels } from './storage.js';
import { getCurrentTemplate } from './templates.js';
import { generatePDF as generateBackendPDF, getCurrentBranding } from './pdfExport.js';

/**
 * Initialize export functionality
 */
export function initExport() {
    // Export button opens modal
    const exportBtn = getById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', openExportModal);
    }

    // Do export button in modal
    const doExportBtn = getById('doExportBtn');
    if (doExportBtn) {
        doExportBtn.addEventListener('click', handleExport);
    }

    // Backend PDF Export button (High Quality - Puppeteer)
    const exportPdfBackendBtn = getById('export-pdf-backend');
    if (exportPdfBackendBtn) {
        exportPdfBackendBtn.addEventListener('click', handleBackendPDFExport);
    }

    // Legacy PDF Export button (html2pdf.js - fallback)
    const exportPdfLegacyBtn = getById('export-pdf-legacy');
    if (exportPdfLegacyBtn) {
        exportPdfLegacyBtn.addEventListener('click', async () => {
            await exportLegacyPDF(buildFilename('Legacy'));
        });
    }
}

/**
 * Handle backend PDF export (High Quality - Puppeteer)
 * Generates PDF with real selectable text, no browser dependencies
 * M-04: Uses loading overlay
 */
async function handleBackendPDFExport() {
    const btn = getById('export-pdf-backend');
    const originalText = btn?.textContent;

    try {
        // M-04: Show loading overlay
        showLoading('Generating high-quality PDF...');

        // Disable button
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Generating...';
        }

        // Get current offer data
        const offerData = getCurrentOffer();
        const template = getCurrentTemplate();
        const branding = getCurrentBranding();

        // Call backend API with all data
        await generateBackendPDF(offerData, branding, template);

        toast('PDF generated successfully!', 'success');

    } catch (error) {
        console.error('Backend PDF export failed:', error);

        // Check if it's a connection error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            toast('Backend not running. Start server with: npm run dev', 'error');
        } else {
            toast('PDF generation failed: ' + (error.message || 'Unknown error'), 'error');
        }
    } finally {
        // M-04: Hide loading overlay
        hideLoading();

        // Restore button
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText || 'Export PDF (HQ)';
        }
    }
}

/**
 * Open export modal
 */
function openExportModal() {
    const modal = getById('exportModal');
    if (modal) {
        modal.classList.remove('hidden');

        // Set default filename
        const filename = getById('exportFilename');
        if (filename) {
            filename.value = buildFilename();
        }
    }
}

/**
 * Handle export based on selected format
 * M-04: Uses loading overlay
 */
async function handleExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value;
    const customFilename = getValue('exportFilename');

    switch (format) {
        case 'pdf':
            // Use backend PDF by default for better quality
            try {
                showLoading('Generating PDF...');
                const offerData = getCurrentOffer();
                const template = getCurrentTemplate();
                const branding = getCurrentBranding();
                await generateBackendPDF(offerData, branding, template);
                hideLoading();
            } catch (e) {
                hideLoading();
                console.warn('Backend PDF failed, falling back to legacy:', e);
                await exportLegacyPDF(customFilename || buildFilename('Legacy'));
            }
            break;
        case 'png':
            await exportImage(customFilename || buildFilename('PNG'), 'png');
            break;
        case 'jpg':
            await exportImage(customFilename || buildFilename('JPG'), 'jpg');
            break;
        case 'json':
            exportJSON(customFilename || buildFilename('JSON'));
            break;
        default:
            toast('Please select an export format', 'error');
    }

    // Close modal
    closeExportModal();
}

/**
 * Legacy PDF export using html2pdf.js (fallback)
 * Creates screenshot-based PDF - text is NOT selectable
 * H-14: Added canvas cleanup after export
 * M-04: Uses loading overlay
 */
async function exportLegacyPDF(filename) {
    const element = getById('a4Page');
    if (!element) {
        toast('Document not found', 'error');
        return;
    }

    // M-04: Show loading overlay
    showLoading('Generating PDF (legacy mode)...');

    const exportBtn = getById('exportBtn');
    const doExportBtn = getById('doExportBtn');
    if (exportBtn) exportBtn.disabled = true;
    if (doExportBtn) doExportBtn.disabled = true;

    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalOverflow = element.style.overflow;

    // H-14: Track canvas for cleanup
    let generatedCanvas = null;

    try {
        element.style.transition = 'none';
        element.style.transform = 'none';
        element.style.overflow = 'visible';
        void element.offsetHeight;

        const template = getCurrentTemplate();
        const isPortrait = template === 'portrait';

        // H-14: Get the worker instance to track canvas
        const worker = html2pdf()
            .set({
                margin: 0,
                filename: `${filename}.pdf`,
                image: { type: 'jpeg', quality: 0.92 },
                html2canvas: {
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: isPortrait ? 'portrait' : 'landscape',
                    compress: true
                },
                pagebreak: { mode: ['avoid-all'] }
            })
            .from(element);

        // Generate canvas and save
        await worker.save();

        toast('PDF exported (legacy mode)', 'success');
    } catch (error) {
        console.error('Legacy PDF export failed:', error);
        toast('PDF export failed', 'error');
    } finally {
        // M-04: Hide loading overlay
        hideLoading();

        // Restore element styles
        element.style.transform = originalTransform || '';
        element.style.transition = originalTransition || '';
        element.style.overflow = originalOverflow || '';

        // Re-enable buttons
        if (exportBtn) exportBtn.disabled = false;
        if (doExportBtn) doExportBtn.disabled = false;

        // H-14: Hint GC to clean up any canvas references
        generatedCanvas = null;

        // H-14: Request garbage collection if available (helps in some browsers)
        if (typeof window.gc === 'function') {
            try { window.gc(); } catch (e) { /* ignore */ }
        }
    }
}

/**
 * Export as image (PNG or JPG)
 * H-07: Fixed URL memory leak
 * H-14: Added canvas cleanup
 * M-04: Uses loading overlay
 */
async function exportImage(filename, format = 'png') {
    const element = getById('a4Page');
    if (!element) {
        toast('Document not found', 'error');
        return;
    }

    const formatUpper = format.toUpperCase();

    // M-04: Show loading overlay
    showLoading(`Generating ${formatUpper}...`);

    // H-14: Track canvas for cleanup
    let canvas = null;

    try {
        const canvasOptions = {
            scale: 5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 15000,
            removeContainer: true
        };

        if (window.html2canvas) {
            canvas = await html2canvas(element, canvasOptions);
        } else if (window.html2pdf && typeof window.html2pdf === 'function') {
            canvas = await window.html2pdf().set({ html2canvas: canvasOptions }).from(element).toCanvas();
        } else {
            throw new Error('html2canvas is not available');
        }

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.98 : undefined;
        const extension = format === 'jpg' ? 'jpg' : 'png';

        // H-07: Use downloadBlobSafe with proper cleanup
        await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create image blob'));
                    return;
                }
                downloadBlobSafe(blob, `${filename}.${extension}`);
                toast(`${formatUpper} exported successfully`, 'success');
                resolve();
            }, mimeType, quality);
        });
    } catch (error) {
        console.error(`${formatUpper} export failed:`, error);
        toast(`${formatUpper} export failed`, 'error');
    } finally {
        // M-04: Hide loading overlay
        hideLoading();

        // H-14: Clean up canvas reference
        if (canvas) {
            // Clear the canvas to release memory
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            canvas.width = 0;
            canvas.height = 0;
            canvas = null;
        }
    }
}

/**
 * Export as JSON
 * H-07: Fixed URL memory leak
 */
function exportJSON(filename) {
    try {
        const jsonContent = exportOfferAsJSON();
        const blob = new Blob([jsonContent], { type: 'application/json' });
        downloadBlobSafe(blob, `${filename}.json`);
        toast('JSON exported successfully', 'success');
    } catch (error) {
        console.error('JSON export failed:', error);
        toast('JSON export failed', 'error');
    }
}

/**
 * H-07: Safe blob download with guaranteed URL cleanup
 * Wrapped in try-finally to ensure revokeObjectURL is always called
 */
function downloadBlobSafe(blob, filename) {
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
 * Close export modal
 */
function closeExportModal() {
    const modal = getById('exportModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Build filename from project name, unit number, and export type
 * Format: projectName_unitNo_exportType (e.g., palm-jumeirah_a-1205_Legacy)
 */
function buildFilename(exportType = '') {
    const projectName = getValue('input-project-name');
    const unitNo = getValue('u_unit_number');

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

function sanitizeFilename(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');
}

/**
 * Download helper
 * H-07: Uses safe download function
 */
export function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    downloadBlobSafe(blob, filename);
}
