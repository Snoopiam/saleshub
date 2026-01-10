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

const debouncedSave = debounce(saveFormData, 500);
const debouncedPreview = debounce(updatePreview, 150);
let lastFocusedElement = null;

function init() {
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

    // DUAL STORAGE STRATEGY: Store original for PDF generation
    // Original stays in memory, compressed version goes to localStorage
    window.originalImages.floorPlan = file;

    const img = getById('floorPlanImg');
    const placeholder = getById('imgPlaceholder');
    const fileName = getById('floorPlanFileName');
    const rawObjectUrl = URL.createObjectURL(file);

    if (img) {
        if (img.dataset.rawObjectUrl) URL.revokeObjectURL(img.dataset.rawObjectUrl);
        img.dataset.rawObjectUrl = rawObjectUrl;
        img.src = rawObjectUrl;
        img.style.display = 'block';
        const unitModel = getValue('u_unit_model');
        img.alt = unitModel ? `Floor plan for ${unitModel}` : 'Floor plan image';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (fileName) fileName.textContent = escapeHtml(file.name);
    toast('Floor plan uploaded (high quality)', 'success');

    // DUAL STORAGE: Compress aggressively for localStorage (800px, 60% quality)
    // Original quality preserved in window.originalImages for PDF export
    compressImageFile(file, 800, 0.6).then(compressedDataUrl => {
        saveCurrentOffer({ floorPlanImage: compressedDataUrl });
    }).catch(() => { /* Silent fail - image displayed from original file */ });
}

function saveFormData() {
    const offer = {
        projectName: getValue('input-project-name'),
        unitNo: getValue('u_unit_number'),
        unitType: getValue('u_unit_type'),
        bedrooms: getValue('u_unit_model'),
        views: getValue('u_views'),
        internalArea: getValue('input-internal-area'),
        balconyArea: getValue('input-balcony-area'),
        totalArea: getValue('input-total-area'),
        villaInternal: getValue('u_villa_internal'),
        villaTerrace: getValue('u_villa_terrace'),
        bua: getValue('u_built_up_area'),
        gfa: getValue('u_gross_floor_area'),
        villaTotal: getValue('u_villa_total'),
        plotSize: getValue('u_plot_size'),
        plotSizeOnly: getValue('u_plot_size'),
        allowedBuild: getValue('u_allowed_build'),
        originalPrice: getValue('u_original_price'),
        sellingPrice: getValue('u_selling_price'),
        resaleClausePercent: getValue('u_resale_clause'),
        amountPaidPercent: getValue('u_amount_paid_percent'),
        amountPaid: getValue('u_amount_paid'),
        refund: getValue('input-refund-amount'),
        balanceResale: getValue('u_balance_resale'),
        premium: getValue('input-premium-amount'),
        adminFees: getValue('input-admin-fees'),
        adgm: getValue('u_adgm_transfer'),
        agencyFees: getValue('input-agency-fees'),
        paymentPlan: getPaymentPlan(),
        readyProperty: getReadyPropertyData()
    };
    saveCurrentOffer(offer);
}

function loadFormData() {
    const offer = getCurrentOffer();
    setValue('input-project-name', offer.projectName);
    setValue('u_unit_number', offer.unitNo);
    setValue('u_unit_type', offer.unitType);
    setValue('u_unit_model', offer.bedrooms);
    setValue('u_views', offer.views);
    setValue('input-internal-area', offer.internalArea);
    setValue('input-balcony-area', offer.balconyArea);
    setValue('input-total-area', offer.totalArea);
    setValue('u_original_price', offer.originalPrice);
    setValue('u_selling_price', offer.sellingPrice);
    setValue('u_resale_clause', offer.resaleClausePercent);
    setValue('u_amount_paid_percent', offer.amountPaidPercent);
    setValue('u_amount_paid', offer.amountPaid);
    setValue('input-refund-amount', offer.refund);
    setValue('u_balance_resale', offer.balanceResale);
    setValue('input-premium-amount', offer.premium);
    setValue('input-admin-fees', offer.adminFees);
    setValue('u_adgm_transfer', offer.adgm);
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

function clearForm() {
    queryAll('#inputPanel input[type="text"], #inputPanel input[type="number"]').forEach(input => input.value = '');
    // [FIX] Clear to single empty row (matches new default)
    setPaymentPlan([
        { date: '', percentage: '', amount: '' }
    ]);
    const img = getById('floorPlanImg');
    if (img) img.src = 'assets/logos/Asset%201@2x.png';
    const placeholder = getById('imgPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    // Clear original images from memory
    window.originalImages.floorPlan = null;
    window.originalImages.logo = null;

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
        // Static SVG icon - safe innerHTML usage
        loadBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-template-btn';
        deleteBtn.type = 'button';
        // Static SVG icon - safe innerHTML usage
        deleteBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';

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
    setValue('u_unit_number', offer.unitNo);
    setValue('u_unit_type', offer.unitType);
    setValue('u_unit_model', offer.bedrooms);
    setValue('u_views', offer.views);
    setValue('input-internal-area', offer.internalArea);
    setValue('input-balcony-area', offer.balconyArea);
    setValue('input-total-area', offer.totalArea);
    setValue('u_original_price', offer.originalPrice);
    setValue('u_selling_price', offer.sellingPrice);
    setValue('input-refund-amount', offer.refund);
    setValue('u_balance_resale', offer.balanceResale);
    setValue('input-premium-amount', offer.premium);
    setValue('input-admin-fees', offer.adminFees);
    setValue('u_adgm_transfer', offer.adgm);
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
