/**
 * Export Module
 * PDF, PNG, and JSON export functionality
 */

import { getById, toast, getValue } from '../utils/helpers.js';
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
            await exportLegacyPDF(getDefaultFilename());
        });
    }
}

/**
 * Handle backend PDF export (High Quality - Puppeteer)
 * Generates PDF with real selectable text, no browser dependencies
 */
async function handleBackendPDFExport() {
    const btn = getById('export-pdf-backend');
    const originalText = btn?.textContent;

    try {
        // Disable button and show loading state
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Generating...';
        }

        toast('Generating high-quality PDF...', 'info');

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
            filename.value = getDefaultFilename();
        }
    }
}

/**
 * Handle export based on selected format
 */
async function handleExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value;
    const filename = getValue('exportFilename') || getDefaultFilename();

    switch (format) {
        case 'pdf':
            // Use backend PDF by default for better quality
            try {
                const offerData = getCurrentOffer();
                const template = getCurrentTemplate();
                const branding = getCurrentBranding();
                await generateBackendPDF(offerData, branding, template);
            } catch (e) {
                console.warn('Backend PDF failed, falling back to legacy:', e);
                await exportLegacyPDF(filename);
            }
            break;
        case 'png':
            await exportImage(filename, 'png');
            break;
        case 'jpg':
            await exportImage(filename, 'jpg');
            break;
        case 'json':
            exportJSON(filename);
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
 */
async function exportLegacyPDF(filename) {
    const element = getById('a4Page');
    if (!element) {
        toast('Document not found', 'error');
        return;
    }

    toast('Generating PDF (legacy mode)...', 'info');

    const exportBtn = getById('exportBtn');
    const doExportBtn = getById('doExportBtn');
    if (exportBtn) exportBtn.disabled = true;
    if (doExportBtn) doExportBtn.disabled = true;

    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalOverflow = element.style.overflow;

    try {
        element.style.transition = 'none';
        element.style.transform = 'none';
        element.style.overflow = 'visible';
        void element.offsetHeight;

        const template = getCurrentTemplate();
        const isPortrait = template === 'portrait';

        await html2pdf()
            .set({
                margin: 0,
                filename: `${filename}.pdf`,
                image: { type: 'png', quality: 1.0 },
                html2canvas: {
                    scale: 4,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: isPortrait ? 'portrait' : 'landscape',
                    compress: false
                },
                pagebreak: { mode: ['avoid-all'] }
            })
            .from(element)
            .save();

        toast('PDF exported (legacy mode)', 'success');
    } catch (error) {
        console.error('Legacy PDF export failed:', error);
        toast('PDF export failed', 'error');
    } finally {
        element.style.transform = originalTransform || '';
        element.style.transition = originalTransition || '';
        element.style.overflow = originalOverflow || '';
        if (exportBtn) exportBtn.disabled = false;
        if (doExportBtn) doExportBtn.disabled = false;
    }
}

/**
 * Export as image (PNG or JPG)
 */
async function exportImage(filename, format = 'png') {
    const element = getById('a4Page');
    if (!element) {
        toast('Document not found', 'error');
        return;
    }

    const formatUpper = format.toUpperCase();
    toast(`Generating ${formatUpper}...`, 'info');

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

        let canvas = null;
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

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast(`${formatUpper} exported successfully`, 'success');
        }, mimeType, quality);
    } catch (error) {
        console.error(`${formatUpper} export failed:`, error);
        toast(`${formatUpper} export failed`, 'error');
    }
}

/**
 * Export as JSON
 */
function exportJSON(filename) {
    try {
        const jsonContent = exportOfferAsJSON();
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast('JSON exported successfully', 'success');
    } catch (error) {
        console.error('JSON export failed:', error);
        toast('JSON export failed', 'error');
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

function getDefaultFilename() {
    return sanitizeFilename(getValue('input-project-name') || 'saleshub-offer');
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
 */
export function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
