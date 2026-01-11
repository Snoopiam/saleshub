/* ============================================================================
   APP.JS - Final Version with Handover Sync
   ============================================================================
*/

import { getById, queryAll, setValue, getValue, setText, formatCurrency, debounce, toast, on, escapeHtml, validateFileType, checkFileSize, compressImageFile } from './utils/helpers.js';
import { saveCurrentOffer, getCurrentOffer, getTemplates, saveTemplate, loadTemplate, deleteTemplate } from './modules/storage.js';
import { initCalculator, runAllCalculations, calculateTotal, restoreLockStates } from './modules/calculator.js';
import { initValidator, clearAllErrors } from './modules/validator.js';
// IMPORT SYNC FUNCTION
import { initPaymentPlan, updatePreview as updatePaymentPreview, getPaymentPlan, setPaymentPlan, syncHandoverWithTotal } from './modules/paymentPlan.js';
import { initBranding, loadBrandingSettings, saveBrandingSettings, applyBranding } from './modules/branding.js';
import { initTemplates } from './modules/templates.js';
import { initExport } from './modules/export.js';
import { initExcel } from './modules/excel.js';
import { initBeta } from './modules/beta.js';
import { initCategory, getReadyPropertyData, setReadyPropertyData, updatePreviewForCategory } from './modules/category.js';
// IndexedDB for persistent original images
import { saveImage, restoreImages, clearAllImages } from './modules/imageStorage.js';

const debouncedSave = debounce(saveFormData, 500);
const debouncedPreview = debounce(updatePreview, 150);
let lastFocusedElement = null;

async function init() {
    // Restore original images from IndexedDB before other init
    await restoreImages();

    initTemplates();
    initCalculator();
    initValidator();
    initPaymentPlan();
    initCategory();
    initBeta();
    initBranding();
    initExport();
    initExcel();
    setupFormListeners();
    setupModalListeners();
    setupButtonListeners();
    setupFileUploads();
    loadFormData();
    restoreLockStates();
    applyBranding();
    updatePreview();
}

function setupFormListeners() {
    const formFields = queryAll('#inputPanel input[type="text"], #inputPanel input[type="number"]');
    formFields.forEach(field => {
        field.addEventListener('input', () => {
            debouncedSave();
            debouncedPreview();
        });
    });

    document.addEventListener('dataImported', () => {
        updatePreview();
        debouncedSave();
    });
}

function openModal(modalId) {
    const modal = getById(modalId);
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    const focusable = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) setTimeout(() => focusable[0].focus(), 50);
    setupFocusTrap(modal);
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    if (modal._focusTrapHandler) {
        modal.removeEventListener('keydown', modal._focusTrapHandler);
        modal._focusTrapHandler = null;
    }
    if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

function setupFocusTrap(modal) {
    if (modal._focusTrapHandler) modal.removeEventListener('keydown', modal._focusTrapHandler);
    const focusableElements = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length === 0) return;
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const trapFocus = (e) => {
        if (!modal.classList.contains('hidden')) {
            if (e.key === 'Escape') { closeModal(modal); return; }
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstFocusable) {
                    lastFocusable.focus(); e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                    firstFocusable.focus(); e.preventDefault();
                }
            }
        }
    };
    modal._focusTrapHandler = trapFocus;
    modal.addEventListener('keydown', trapFocus);
}

function setupModalListeners() {
    queryAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal')));
    });
    queryAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => closeModal(e.target.closest('.modal')));
    });
    queryAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            queryAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            queryAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === `tab-${tabId}`));
        });
    });
    const saveSettingsBtn = getById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            saveBrandingSettings();
            getById('settingsModal')?.classList.add('hidden');
            updatePreview();
        });
    }
    const doSaveTemplateBtn = getById('doSaveTemplateBtn');
    if (doSaveTemplateBtn) {
        doSaveTemplateBtn.addEventListener('click', handleSaveTemplate);
    }
}

function setupButtonListeners() {
    on('settingsBtn', 'click', () => { loadBrandingSettings(); openModal('settingsModal'); });
    on('saveTemplateBtn', 'click', () => { renderTemplatesList(); openModal('saveTemplateModal'); });
    on('clearAllBtn', 'click', () => { if (confirm('Clear all fields? This will reset the form.')) clearForm(); });
    on('printBtn', 'click', () => window.print());
}

function setupFileUploads() {
    const fpUpload = getById('floorplan_upload');
    if (fpUpload) fpUpload.addEventListener('change', handleFloorPlanUpload);
}

async function handleFloorPlanUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const errorContainer = getById('floorPlanError');
    const showError = (msg) => { if (errorContainer) { errorContainer.textContent = msg; errorContainer.classList.remove('hidden'); } toast(msg, 'error'); };
    const clearError = () => { if (errorContainer) errorContainer.classList.add('hidden'); };

    if (!checkFileSize(file, 100)) { showError('File size exceeds 100MB limit'); e.target.value = ''; return; }
    const isValidType = await validateFileType(file, ['image/']);
    if (!isValidType) { showError('Invalid image file. Please upload a JPG, PNG, or WebP image.'); e.target.value = ''; return; }

    clearError();

    // PERSISTENT STORAGE: Save original to IndexedDB (survives refresh)
    window.originalImages.floorPlan = file;
    saveImage('floorPlan', file).catch(err => {
        console.warn('[App] Could not save floor plan to IndexedDB:', err);
    });

    const img = getById('floorPlanImg');
    const placeholder = getById('imgPlaceholder');
    const fileName = getById('floorPlanFileName');
    const rawObjectUrl = URL.createObjectURL(file);

    if (img) {
        if (img.dataset.rawObjectUrl) URL.revokeObjectURL(img.dataset.rawObjectUrl);
        img.dataset.rawObjectUrl = rawObjectUrl;
        img.src = rawObjectUrl;
        img.style.display = 'block';
        const unitModel = getValue('select-unit-model');
        img.alt = unitModel ? `Floor plan for ${unitModel}` : 'Floor plan image';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (fileName) fileName.textContent = escapeHtml(file.name);
    toast('Floor plan uploaded (high quality preserved)', 'success');

    // DUAL STORAGE: Compress for localStorage preview (800px, 60% quality)
    // Original quality preserved in IndexedDB for PDF export
    compressImageFile(file, 800, 0.6).then(compressedDataUrl => {
        saveCurrentOffer({ floorPlanImage: compressedDataUrl });
    }).catch(() => { /* Silent fail - image displayed from original file */ });
}

function saveFormData() {
    const offer = {
        projectName: getValue('input-project-name'),
        unitNo: getValue('input-unit-number'),
        unitType: getValue('input-unit-type'),
        bedrooms: getValue('select-unit-model'),
        views: getValue('select-views'),
        internalArea: getValue('input-internal-area'),
        balconyArea: getValue('input-balcony-area'),
        totalArea: getValue('input-total-area'),
        villaInternal: getValue('input-villa-internal'),
        villaTerrace: getValue('input-villa-terrace'),
        bua: getValue('input-built-up-area'),
        gfa: getValue('input-gross-floor-area'),
        villaTotal: getValue('input-villa-total'),
        plotSize: getValue('input-plot-size'),
        plotSizeOnly: getValue('input-plot-size-only'),
        allowedBuild: getValue('input-allowed-build'),
        originalPrice: getValue('input-original-price'),
        sellingPrice: getValue('input-selling-price'),
        resaleClausePercent: getValue('input-resale-clause'),
        amountPaidPercent: getValue('input-amount-paid-percent'),
        amountPaid: getValue('input-amount-paid'),
        refund: getValue('input-refund-amount'),
        balanceResale: getValue('input-balance-resale'),
        premium: getValue('input-premium-amount'),
        adminFees: getValue('input-admin-fees'),
        adgmTransfer: getValue('input-adgm-transfer'),
        adgmTermination: getValue('input-adgm-termination-fee'),
        adgmElectronic: getValue('input-adgm-electronic-fee'),
        agencyFees: getValue('input-agency-fees'),
        // FIX: Include calculated total for PDF export
        totalPayment: calculateTotal(),
        paymentPlan: getPaymentPlan(),
        readyProperty: getReadyPropertyData()
    };
    saveCurrentOffer(offer);
}

function loadFormData() {
    const offer = getCurrentOffer();
    setValue('input-project-name', offer.projectName);
    setValue('input-unit-number', offer.unitNo);
    setValue('input-unit-type', offer.unitType);
    setValue('select-unit-model', offer.bedrooms);
    setValue('select-views', offer.views);
    setValue('input-internal-area', offer.internalArea);
    setValue('input-balcony-area', offer.balconyArea);
    setValue('input-total-area', offer.totalArea);
    setValue('input-villa-internal', offer.villaInternal);
    setValue('input-villa-terrace', offer.villaTerrace);
    setValue('input-built-up-area', offer.bua);
    setValue('input-gross-floor-area', offer.gfa);
    setValue('input-villa-total', offer.villaTotal);
    setValue('input-plot-size', offer.plotSize);
    setValue('input-plot-size-only', offer.plotSizeOnly);
    setValue('input-allowed-build', offer.allowedBuild);
    setValue('input-original-price', offer.originalPrice);
    setValue('input-selling-price', offer.sellingPrice);
    setValue('input-resale-clause', offer.resaleClausePercent);
    setValue('input-amount-paid-percent', offer.amountPaidPercent);
    setValue('input-amount-paid', offer.amountPaid);
    setValue('input-refund-amount', offer.refund);
    setValue('input-balance-resale', offer.balanceResale);
    setValue('input-premium-amount', offer.premium);
    setValue('input-admin-fees', offer.adminFees);
    setValue('input-adgm-transfer', offer.adgmTransfer || offer.adgm);
    setValue('input-adgm-termination-fee', offer.adgmTermination);
    setValue('input-adgm-electronic-fee', offer.adgmElectronic);
    setValue('input-agency-fees', offer.agencyFees);

    if (offer.paymentPlan && offer.paymentPlan.length > 0) setPaymentPlan(offer.paymentPlan);
    if (offer.readyProperty) setReadyPropertyData(offer.readyProperty);
    if (offer.floorPlanImage) {
        const img = getById('floorPlanImg');
        const placeholder = getById('imgPlaceholder');
        if (img) { img.src = offer.floorPlanImage; img.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
    }
    runAllCalculations();
}

/**
 * [CRITICAL UPDATE] Ensure sync logic works
 */
function updatePreview() {
    const unitType = getValue('input-unit-type').toLowerCase();
    setText('disp_project_footer', getValue('input-project-name') || '-');
    setText('display-unit-number', getValue('input-unit-number') || '-');
    setText('disp_unit_type', getValue('input-unit-type') || '-');
    setText('disp_title', getValue('select-unit-model') || '-');
    setText('disp_views', getValue('select-views') || '-');

    updatePreviewAreaRows(unitType);

    setText('disp_original_price', formatCurrency(getValue('input-original-price')));
    setText('disp_selling_price', formatCurrency(getValue('input-selling-price')));
    setText('disp_refund', formatCurrency(getValue('input-refund-amount')));
    setText('disp_balance_resale', formatCurrency(getValue('input-balance-resale')));
    setText('disp_premium', formatCurrency(getValue('input-premium-amount')));
    setText('disp_admin_fees', formatCurrency(getValue('input-admin-fees')));
    setText('disp_adgm_transfer', formatCurrency(getValue('input-adgm-transfer')));
    setText('disp_adgm_termination', formatCurrency(getValue('input-adgm-termination-fee')));
    setText('disp_adgm_electronic', formatCurrency(getValue('input-adgm-electronic-fee')));
    setText('disp_agency_fees', formatCurrency(getValue('input-agency-fees')));

    const total = calculateTotal();
    setText('disp_total', formatCurrency(total));

    // Also update the input display if it exists (for calculator visuals)
    const totalDisplayEl = getById('display-total-payment');
    if (totalDisplayEl) totalDisplayEl.textContent = formatCurrency(total);

    // 1. Force the row value to update
    syncHandoverWithTotal(total);

    // 2. Pass the exact total to the table renderer to ensure it uses it
    updatePaymentPreview(total);

    updatePreviewForCategory();
}

function updatePreviewAreaRows(unitType) {
    const standardRows = ['disp_row_internal', 'disp_row_balcony', 'disp_row_area'];
    const villaRows = ['disp_row_villa_internal', 'disp_row_villa_terrace', 'disp_row_built_up_area', 'disp_row_gross_floor_area', 'disp_row_villa_total', 'disp_row_plotsize'];
    const plotRows = ['disp_row_plot_size', 'disp_row_allowed_build'];

    [...standardRows, ...villaRows, ...plotRows].forEach(id => {
        const row = getById(id); if (row) row.style.display = 'none';
    });

    if (unitType === 'villa' || unitType === 'townhouse') {
        villaRows.forEach(id => { const row = getById(id); if (row) row.style.display = ''; });
        setText('disp_villa_internal', getValue('input-villa-internal') || '-');
        setText('disp_villa_terrace', getValue('input-villa-terrace') || '-');
        setText('disp_built_up_area', getValue('input-built-up-area') || '-');
        setText('disp_gross_floor_area', getValue('input-gross-floor-area') || '-');
        setText('disp_villa_total', getValue('input-villa-total') || '-');
        setText('disp_plot_size', getValue('input-plot-size') || '-');
    } else if (unitType === 'plot') {
        plotRows.forEach(id => { const row = getById(id); if (row) row.style.display = ''; });
        setText('disp_plot_size_only', getValue('input-plot-size-only') || '-');
        setText('disp_allowed_build', getValue('input-allowed-build') || '-');
    } else {
        standardRows.forEach(id => { const row = getById(id); if (row) row.style.display = ''; });
        const internalVal = getValue('input-internal-area');
        const balconyVal = getValue('input-balcony-area');
        const totalVal = getValue('input-total-area');
        setText('disp_internal', internalVal ? `${internalVal} Sq.Ft` : '-');
        setText('disp_balcony', balconyVal ? `${balconyVal} Sq.Ft` : '-');
        setText('display-total-area', totalVal ? `${totalVal} Sq.Ft` : '-');
    }
}

async function clearForm() {
    queryAll('#inputPanel input[type="text"], #inputPanel input[type="number"]').forEach(input => input.value = '');
    // [FIX] Clear to single empty row (matches new default)
    setPaymentPlan([
        { date: '', percentage: '', amount: '' }
    ]);
    const img = getById('floorPlanImg');
    if (img) img.src = 'assets/logos/Asset%201@2x.png';
    const placeholder = getById('imgPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    // Clear original images from memory and IndexedDB
    window.originalImages.floorPlan = null;
    window.originalImages.logo = null;
    await clearAllImages().catch(() => {});

    clearAllErrors();
    saveFormData();
    updatePreview();
    toast('Form cleared', 'success');
}

function handleSaveTemplate() {
    const nameInput = getById('templateName');
    const name = nameInput?.value?.trim();
    if (!name) { toast('Please enter a template name', 'error'); return; }
    saveTemplate(name, getCurrentOffer());
    if (nameInput) nameInput.value = '';
    getById('saveTemplateModal')?.classList.add('hidden');
    renderTemplatesList();
}

// Create SVG icon element safely (no innerHTML)
function createSvgIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('viewBox', '0 0 24 24');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-width', '2');

    if (type === 'load') {
        path.setAttribute('d', 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12');
    } else if (type === 'delete') {
        path.setAttribute('d', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16');
    }

    svg.appendChild(path);
    return svg;
}

function renderTemplatesList() {
    const container = getById('savedTemplatesList');
    if (!container) return;
    const templates = getTemplates();
    container.textContent = '';
    if (templates.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = 'padding: 12px; color: #9ca3af; font-size: 13px;';
        p.textContent = 'No saved templates';
        container.appendChild(p);
        return;
    }
    templates.forEach(template => {
        const div = document.createElement('div');
        div.className = 'template-item';
        div.dataset.id = template.id;
        div.setAttribute('tabindex', '0');
        div.setAttribute('role', 'listitem');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'template-item-name';
        nameSpan.textContent = template.name;
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'template-item-actions';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-template-btn';
        loadBtn.type = 'button';
        loadBtn.appendChild(createSvgIcon('load'));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-template-btn';
        deleteBtn.type = 'button';
        deleteBtn.appendChild(createSvgIcon('delete'));

        actionsDiv.appendChild(loadBtn);
        actionsDiv.appendChild(deleteBtn);
        div.appendChild(nameSpan);
        div.appendChild(actionsDiv);
        container.appendChild(div);
    });
    container.querySelectorAll('.load-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); handleLoadTemplate(e.target.closest('.template-item').dataset.id); });
    });
    container.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); if(confirm('Delete this template?')) { deleteTemplate(e.target.closest('.template-item').dataset.id); renderTemplatesList(); } });
    });
}

function handleLoadTemplate(templateId) {
    const template = loadTemplate(templateId);
    if (!template) { toast('Template not found', 'error'); return; }
    const offer = template.data;
    setValue('input-project-name', offer.projectName);
    setValue('input-unit-number', offer.unitNo);
    setValue('input-unit-type', offer.unitType);
    setValue('select-unit-model', offer.bedrooms);
    setValue('select-views', offer.views);
    setValue('input-internal-area', offer.internalArea);
    setValue('input-balcony-area', offer.balconyArea);
    setValue('input-total-area', offer.totalArea);
    setValue('input-villa-internal', offer.villaInternal);
    setValue('input-villa-terrace', offer.villaTerrace);
    setValue('input-built-up-area', offer.bua);
    setValue('input-gross-floor-area', offer.gfa);
    setValue('input-villa-total', offer.villaTotal);
    setValue('input-plot-size', offer.plotSize);
    setValue('input-plot-size-only', offer.plotSizeOnly);
    setValue('input-allowed-build', offer.allowedBuild);
    setValue('input-original-price', offer.originalPrice);
    setValue('input-selling-price', offer.sellingPrice);
    setValue('input-resale-clause', offer.resaleClausePercent);
    setValue('input-amount-paid-percent', offer.amountPaidPercent);
    setValue('input-amount-paid', offer.amountPaid);
    setValue('input-refund-amount', offer.refund);
    setValue('input-balance-resale', offer.balanceResale);
    setValue('input-premium-amount', offer.premium);
    setValue('input-admin-fees', offer.adminFees);
    setValue('input-adgm-transfer', offer.adgmTransfer || offer.adgm);
    setValue('input-adgm-termination-fee', offer.adgmTermination);
    setValue('input-adgm-electronic-fee', offer.adgmElectronic);
    setValue('input-agency-fees', offer.agencyFees);
    if (offer.paymentPlan) setPaymentPlan(offer.paymentPlan);
    runAllCalculations();
    updatePreview();
    saveFormData();
    getById('saveTemplateModal')?.classList.add('hidden');
    toast(`Template "${template.name}" loaded`, 'success');
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveFormData(); });
window.addEventListener('beforeunload', () => saveFormData());
document.addEventListener('clearForm', () => clearForm());
document.addEventListener('loadTemplate', (e) => { if (e.detail && e.detail.id) handleLoadTemplate(e.detail.id); });
document.addEventListener('unitTypeChanged', () => updatePreview());
document.addEventListener('categoryChanged', () => { updatePreview(); debouncedSave(); });
document.addEventListener('occupancyChanged', () => { updatePreview(); debouncedSave(); });
