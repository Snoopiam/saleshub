/**
 * Branding Module
 * Logo, color, and company customization
 */

import { getById, toast, compressImageFile } from '../utils/helpers.js';
import { getBranding, saveBranding, getLabels, saveLabels } from './storage.js';
import { saveImage, deleteImage } from './imageStorage.js';

/**
 * Initialize branding functionality
 */
export function initBranding() {
    loadBrandingSettings();
    setupColorPicker();
    setupLogoUpload();
    applyBranding();
}

/**
 * Load branding settings into the form
 */
export function loadBrandingSettings() {
    const branding = getBranding();
    const labels = getLabels();

    // Branding tab
    const companyName = getById('brandCompanyName');
    const primaryColor = getById('brandPrimaryColor');
    const primaryColorHex = getById('brandPrimaryColorHex');
    const footerText = getById('brandFooterText');

    if (companyName) companyName.value = branding.companyName || '';
    if (primaryColor) primaryColor.value = branding.primaryColor || '#62c6c1';
    if (primaryColorHex) primaryColorHex.value = branding.primaryColor || '#62c6c1';
    if (footerText) footerText.value = branding.footerText || 'SALE OFFER';

    // Show logo preview if exists
    if (branding.logo) {
        showLogoPreview(branding.logo);
    }

    // Labels tab
    const labelRefund = getById('labelRefund');
    const labelBalance = getById('labelBalance');
    const labelPremium = getById('labelPremium');
    const labelAdmin = getById('labelAdmin');
    const labelAdgm = getById('labelAdgm');
    const labelAgency = getById('labelAgency');

    if (labelRefund) labelRefund.value = labels.refund || '';
    if (labelBalance) labelBalance.value = labels.balance || '';
    if (labelPremium) labelPremium.value = labels.premium || '';
    if (labelAdmin) labelAdmin.value = labels.admin || '';
    if (labelAdgm) labelAdgm.value = labels.adgm || '';
    if (labelAgency) labelAgency.value = labels.agency || '';
}

/**
 * Set up color picker synchronization
 */
function setupColorPicker() {
    const colorPicker = getById('brandPrimaryColor');
    const colorHex = getById('brandPrimaryColorHex');

    if (colorPicker && colorHex) {
        // Sync picker to hex input
        colorPicker.addEventListener('input', (e) => {
            colorHex.value = e.target.value.toUpperCase();
            previewColor(e.target.value);
        });

        // Sync hex input to picker
        colorHex.addEventListener('input', (e) => {
            let value = e.target.value;
            if (!value.startsWith('#')) {
                value = '#' + value;
            }
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorPicker.value = value;
                previewColor(value);
            }
        });
    }
}

/**
 * Preview color change without saving
 * @param {string} color - Color hex value
 */
function previewColor(color) {
    document.documentElement.style.setProperty('--primary-color', color);
}

/**
 * Set up logo upload
 * Uses PERSISTENT STORAGE with IndexedDB:
 * - Original quality stored in IndexedDB + window.originalImages.logo (for PDF export)
 * - Compressed version stored in localStorage (for preview/persistence)
 */
function setupLogoUpload() {
    const logoUpload = getById('brandLogoUpload');
    const logoFileName = getById('logoFileName');

    if (logoUpload) {
        logoUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    toast('Please upload an image file', 'error');
                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    toast('Image must be less than 5MB', 'error');
                    return;
                }

                // PERSISTENT STORAGE: Save original to IndexedDB (survives refresh)
                window.originalImages.logo = file;
                saveImage('logo', file).catch(err => {
                    console.warn('[Branding] Could not save logo to IndexedDB:', err);
                });

                if (logoFileName) {
                    logoFileName.textContent = file.name;
                }

                // Compress for localStorage preview (400px max width, 70% quality)
                // Original quality preserved in IndexedDB for PDF export
                try {
                    const compressedBase64 = await compressImageFile(file, 400, 0.7);
                    showLogoPreview(compressedBase64);
                    toast('Logo uploaded (high quality preserved)', 'success');
                } catch (error) {
                    // Fallback to original if compression fails
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        showLogoPreview(e.target.result);
                    };
                    reader.readAsDataURL(file);
                    toast('Logo uploaded', 'success');
                }
            }
        });
    }
}

/**
 * Show logo preview
 * @param {string} base64 - Base64 image data
 */
function showLogoPreview(base64) {
    const preview = getById('logoPreview');
    if (preview) {
        preview.textContent = '';
        const img = document.createElement('img');
        img.src = base64;
        img.alt = 'Logo Preview';
        preview.appendChild(img);
        preview.dataset.logo = base64;
    }
}

/**
 * Save branding settings
 */
export function saveBrandingSettings() {
    const branding = {
        companyName: getById('brandCompanyName')?.value || 'Kennedy Property',
        primaryColor: getById('brandPrimaryColor')?.value || '#62c6c1',
        logo: getById('logoPreview')?.dataset.logo || '',
        footerText: getById('brandFooterText')?.value || 'SALE OFFER'
    };

    const labels = {
        refund: getById('labelRefund')?.value || 'Refund (40% of Original Price)',
        balance: getById('labelBalance')?.value || 'Balance Resale Clause**',
        premium: getById('labelPremium')?.value || 'Premium (Selling Price - Original Price)',
        admin: getById('labelAdmin')?.value || 'Admin Fees (SAAS)',
        adgm: getById('labelAdgm')?.value || 'ADGM Reg. Fee (2% of Original Price)',
        agency: getById('labelAgency')?.value || 'Agency Fees (2% of Selling Price + Vat)'
    };

    saveBranding(branding);
    saveLabels(labels);
    applyBranding();

    toast('Settings saved', 'success');
}

/**
 * Apply branding to the document
 */
export function applyBranding() {
    const branding = getBranding();
    const labels = getLabels();

    // Apply primary color
    document.documentElement.style.setProperty('--primary-color', branding.primaryColor);

    // Apply logo
    const logoImg = getById('logoImg');
    if (logoImg && branding.logo) {
        logoImg.src = branding.logo;
    }

    // Apply footer text
    const footerSub = document.querySelector('.footer-sub');
    if (footerSub) {
        footerSub.textContent = branding.footerText || 'SALE OFFER';
    }

    // Apply labels
    const labelElements = {
        'label_refund_amount': labels.refund,
        'label_balance_resale': labels.balance,
        'label_premium_price': labels.premium,
        'label_admin_fees': labels.admin,
        'label_adgm_transfer': labels.adgm,
        'label_agency_fees': labels.agency
    };

    Object.entries(labelElements).forEach(([id, text]) => {
        const el = getById(id);
        if (el) el.textContent = text;
    });
}

/**
 * Reset branding to defaults
 */
export async function resetBranding() {
    const defaultBranding = {
        companyName: 'Kennedy Property',
        primaryColor: '#62c6c1',
        logo: '',
        footerText: 'SALE OFFER'
    };

    const defaultLabels = {
        refund: 'Refund (40% of Original Price)',
        balance: 'Balance Resale Clause**',
        premium: 'Premium (Selling Price - Original Price)',
        admin: 'Admin Fees (SAAS)',
        adgm: 'ADGM Reg. Fee (2% of Original Price)',
        agency: 'Agency Fees (2% of Selling Price + Vat)'
    };

    // Clear original logo from memory and IndexedDB
    window.originalImages.logo = null;
    await deleteImage('logo').catch(() => {});

    saveBranding(defaultBranding);
    saveLabels(defaultLabels);
    loadBrandingSettings();
    applyBranding();

    toast('Branding reset to defaults', 'success');
}

/**
 * Get current branding for export
 * @returns {Object} Current branding settings
 */
export function getCurrentBranding() {
    return getBranding();
}
