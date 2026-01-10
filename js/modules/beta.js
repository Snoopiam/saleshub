/**
 * BETA Features Module
 * Toggle and manage experimental features
 */

import { getById, queryAll, toast, formatCurrency, getNumericValue, getValue, createElement } from '../utils/helpers.js';
import { loadState, saveState, getCurrentOffer, getTemplates, deleteTemplate } from './storage.js';

// BETA feature flags
const BETA_FEATURES = {
    datePicker: true,
    currencyFormatting: true,
    dropdowns: true,
    zoomControls: true,
    offersDashboard: true,
    whatsappShare: true,
    pricePerSqft: true,
    calculators: true,
    enhancedExport: true,
    tooltips: true
};

let isBetaEnabled = false;

// AbortController for cleaning up event listeners when BETA is disabled
let betaAbortController = null;

/**
 * Initialize BETA module
 */
export function initBeta() {
    const state = loadState();
    isBetaEnabled = true;
    state.betaEnabled = true;
    saveState(state);
    enableBetaFeatures();
}

/**
 * Initialize BETA toggle switch (toggle is now in HTML, just add event listener)
 */
function createBetaToggle() {
    const toggle = getById('betaToggle');
    if (!toggle) return;

    // Set initial state from saved preference
    toggle.checked = isBetaEnabled;

    // Add event listener
    toggle.addEventListener('change', (e) => {
        isBetaEnabled = e.target.checked;
        saveBetaState();
        if (isBetaEnabled) {
            enableBetaFeatures();
            toast('BETA features enabled!', 'success');
        } else {
            disableBetaFeatures();
            toast('BETA features disabled', 'info');
        }
    });
}

/**
 * Save BETA state
 */
function saveBetaState() {
    const state = loadState();
    state.betaEnabled = isBetaEnabled;
    saveState(state);
}

/**
 * Enable all BETA features
 */
function enableBetaFeatures() {
    // Create new AbortController for this session's event listeners
    if (betaAbortController) {
        betaAbortController.abort();
    }
    betaAbortController = new AbortController();

    document.body.classList.add('beta-enabled');

    // Initialize each BETA feature
    if (BETA_FEATURES.datePicker) initDatePickers();
    if (BETA_FEATURES.currencyFormatting) initCurrencyFormatting();
    if (BETA_FEATURES.dropdowns) initDropdowns();
    if (BETA_FEATURES.zoomControls) initZoomControls();
    if (BETA_FEATURES.offersDashboard) initOffersDashboard();
    if (BETA_FEATURES.whatsappShare) initWhatsAppShare();
    if (BETA_FEATURES.pricePerSqft) initPricePerSqft();
    if (BETA_FEATURES.calculators) initCalculators();
    if (BETA_FEATURES.enhancedExport) initEnhancedExport();
    if (BETA_FEATURES.tooltips) initTooltips();
}

/**
 * Disable all BETA features with proper cleanup
 */
function disableBetaFeatures() {
    // Abort all event listeners registered with getBetaSignal()
    if (betaAbortController) {
        betaAbortController.abort();
        betaAbortController = null;
    }

    document.body.classList.remove('beta-enabled');

    // Remove BETA UI elements
    queryAll('.beta-feature').forEach(el => el.remove());
    queryAll('.beta-enhanced').forEach(el => {
        el.classList.remove('beta-enhanced');
    });

    // Destroy flatpickr instances if they exist
    queryAll('.flatpickr-input').forEach(el => {
        if (el._flatpickr) {
            el._flatpickr.destroy();
        }
    });

    // Remove dynamically added stylesheets
    queryAll('link[href*="flatpickr"]').forEach(el => el.remove());

    // Note: We still reload to fully reset state, but the abort above
    // prevents memory leaks during the session before reload
    window.location.reload();
}

/**
 * Check if BETA is enabled
 */
export function isBetaMode() {
    return isBetaEnabled;
}

// ============================================
// BETA FEATURE: Date Pickers
// ============================================
function initDatePickers() {
    // Add flatpickr CSS
    if (!document.querySelector('link[href*="flatpickr"]')) {
        const link = createElement('link', {
            rel: 'stylesheet',
            href: 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'
        });
        document.head.appendChild(link);

        // Add dark theme
        const darkLink = createElement('link', {
            rel: 'stylesheet',
            href: 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css'
        });
        document.head.appendChild(darkLink);
    }

    // Load flatpickr script
    if (!window.flatpickr) {
        const script = createElement('script', {
            src: 'https://cdn.jsdelivr.net/npm/flatpickr'
        });
        script.onload = () => applyDatePickers();
        document.head.appendChild(script);
    } else {
        applyDatePickers();
    }
}

function applyDatePickers() {
    // Apply to payment plan date inputs
    setTimeout(() => {
        const dateInputs = queryAll('#paymentPlanBody input[data-field="date"]');
        dateInputs.forEach(input => {
            if (!input._flatpickr) {
                const rawValue = (input.value || '').trim();
                const hasAlpha = /[a-z]/i.test(rawValue);
                const hasDigit = /\d/.test(rawValue);
                if (hasAlpha && !hasDigit) {
                    return;
                }

                flatpickr(input, {
                    dateFormat: 'd M Y',
                    allowInput: true,
                    allowInvalidPreload: true,
                    defaultDate: null,
                    parseDate: (dateStr, format) => {
                        if (!dateStr) return null;
                        if (/^on\s/i.test(dateStr)) return null;
                        return flatpickr.parseDate(dateStr, format);
                    },
                    theme: 'dark'
                });
            }
        });
    }, 500);
}

// ============================================
// BETA FEATURE: Currency Formatting
// ============================================
function initCurrencyFormatting() {
    const currencyFields = ['input-original-price', 'input-selling-price', 'input-refund-amount', 'input-premium-amount', 'input-admin-fees', 'input-adgm-transfer', 'input-agency-fees', 'input-balance-resale', 'input-amount-paid'];

    currencyFields.forEach(fieldId => {
        const input = getById(fieldId);
        if (!input || input.dataset.currencyFormatted) return;

        input.dataset.currencyFormatted = 'true';
        input.classList.add('beta-enhanced');

        // Store raw value in data attribute
        if (input.value) {
            input.dataset.rawValue = input.value.replace(/,/g, '');
        }

        // Format on blur - keep the raw numeric value accessible
        input.addEventListener('blur', () => {
            const rawValue = input.value.replace(/,/g, '');
            const value = parseFloat(rawValue);
            if (!isNaN(value) && value !== 0) {
                input.dataset.rawValue = rawValue;
                input.value = value.toLocaleString('en-US');
            } else if (rawValue === '' || rawValue === '0') {
                input.dataset.rawValue = rawValue;
                input.value = rawValue; // Keep empty or 0 as-is
            }
        });

        // Remove formatting on focus - restore raw value
        input.addEventListener('focus', () => {
            const rawValue = input.dataset.rawValue || input.value.replace(/,/g, '');
            input.value = rawValue;
        });

        // Update raw value on input
        input.addEventListener('input', () => {
            input.dataset.rawValue = input.value.replace(/,/g, '');
        });
    });
}

// ============================================
// BETA FEATURE: Dropdowns for common values
// ============================================
function initDropdowns() {
    // Unit Type dropdown - with show/hide logic for area fields
    const unitTypeInput = getById('input-unit-type');
    if (unitTypeInput && !unitTypeInput.dataset.dropdownAdded) {
        createSelectDropdown(unitTypeInput, 'unitTypeOptions', [
            'Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex',
            'Studio', 'Loft', 'Maisonette', 'Plot', 'Office', 'Retail'
        ]);
        // Add change listener for unit type logic
        unitTypeInput.addEventListener('change', handleUnitTypeChange);
        unitTypeInput.addEventListener('input', handleUnitTypeChange);
    }

    // Views dropdown - skip if already a native select element
    const viewsInput = getById('select-views');
    if (viewsInput && viewsInput.tagName !== 'SELECT' && !viewsInput.dataset.dropdownAdded) {
        createSelectDropdown(viewsInput, 'viewsOptions', [
            'Sea View', 'Marina View', 'Garden View', 'Pool View',
            'City View', 'Park View', 'Golf View', 'Mangrove View',
            'Lake View', 'Boulevard View', 'Community View', 'Landmark View'
        ]);
    }

    // Unit Model dropdown - skip if already a native select element
    const bedroomsInput = getById('select-unit-model');
    if (bedroomsInput && bedroomsInput.tagName !== 'SELECT' && !bedroomsInput.dataset.dropdownAdded) {
        // Load custom options from storage
        const state = loadState();
        const customOptions = state.customDropdowns?.unitModels || [];
        const defaultOptions = [
            'Studio', '1 Bedroom', '1 Bedroom + Maid', '2 Bedroom',
            '2 Bedroom + Maid', '3 Bedroom', '3 Bedroom + Maid',
            '4 Bedroom', '4 Bedroom + Maid', '5 Bedroom', '5 Bedroom + Maid',
            '6 Bedroom', '7 Bedroom'
        ];
        const allOptions = [...defaultOptions, ...customOptions.filter(o => !defaultOptions.includes(o))];
        createSelectDropdown(bedroomsInput, 'bedroomsOptions', allOptions, true); // true = allow custom
    }
}

/**
 * Create a proper select dropdown with keyboard navigation
 */
function createSelectDropdown(input, listId, options, allowCustom = false) {
    input.dataset.dropdownAdded = 'true';
    input.classList.add('beta-enhanced');

    // Create wrapper if not exists
    let wrapper = input.closest('.dropdown-wrapper');
    if (!wrapper) {
        wrapper = createElement('div', { className: 'dropdown-wrapper' });
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
    }

    // Create dropdown container
    const dropdown = createElement('div', { className: 'custom-dropdown hidden', id: `${listId}_dropdown` });

    // Track highlighted index for keyboard nav
    let highlightedIndex = -1;
    let isSelecting = false; // Flag to prevent reopening after selection

    // Add options
    options.forEach((opt, idx) => {
        const item = createElement('div', { className: 'dropdown-item', 'data-value': opt, 'data-index': idx });
        item.textContent = opt;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectOption(opt);
        });
        item.addEventListener('mouseenter', () => {
            highlightedIndex = idx;
            updateHighlight();
        });
        dropdown.appendChild(item);
    });

    // Add custom option if allowed
    if (allowCustom) {
        const customItem = createElement('div', { className: 'dropdown-item dropdown-custom', 'data-index': options.length });
        customItem.innerHTML = '<span class="custom-icon">+</span> Add custom option...';
        customItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideDropdown();
            showCustomOptionModal(input, listId);
        });
        dropdown.appendChild(customItem);
    }

    wrapper.appendChild(dropdown);

    // Add dropdown arrow button (replaces clear button)
    const arrowBtn = createElement('button', {
        className: 'dropdown-arrow-btn',
        type: 'button',
        title: 'Open dropdown'
    });
    arrowBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    arrowBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropdown.classList.contains('hidden')) {
            showDropdown();
            input.focus();
        } else {
            hideDropdown();
        }
    });
    wrapper.appendChild(arrowBtn);

    function selectOption(value) {
        isSelecting = true;
        input.value = value;
        hideDropdown();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // Reset flag after events propagate
        setTimeout(() => { isSelecting = false; }, 10);
    }

    function showDropdown() {
        dropdown.classList.remove('hidden');
        highlightedIndex = -1;
        filterDropdown(dropdown, ''); // Show all options
        // If there's a current value, highlight it
        const currentValue = input.value.toLowerCase();
        if (currentValue) {
            const items = getVisibleItems();
            items.forEach((item, idx) => {
                if (item.dataset.value.toLowerCase() === currentValue) {
                    highlightedIndex = idx;
                }
            });
        }
        updateHighlight();
    }

    function hideDropdown() {
        dropdown.classList.add('hidden');
        highlightedIndex = -1;
        clearHighlight();
    }

    function getVisibleItems() {
        return Array.from(dropdown.querySelectorAll('.dropdown-item')).filter(item => item.style.display !== 'none');
    }

    function updateHighlight() {
        clearHighlight();
        const items = getVisibleItems();
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
            items[highlightedIndex].classList.add('highlighted');
            // Scroll into view
            items[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function clearHighlight() {
        dropdown.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
    }

    // Show dropdown on focus
    input.addEventListener('focus', () => {
        showDropdown();
    });

    // Also show on click (in case already focused)
    input.addEventListener('click', () => {
        if (dropdown.classList.contains('hidden')) {
            showDropdown();
        }
    });

    // Filter on input - but not when selecting from dropdown
    input.addEventListener('input', () => {
        if (isSelecting) return; // Don't reopen if we just selected
        dropdown.classList.remove('hidden');
        filterDropdown(dropdown, input.value);
        highlightedIndex = 0;
        updateHighlight();
    });

    // Hide on blur (with delay for click to register)
    input.addEventListener('blur', () => {
        setTimeout(() => hideDropdown(), 150);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = getVisibleItems();
        const isOpen = !dropdown.classList.contains('hidden');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!isOpen) {
                    showDropdown();
                } else {
                    highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                    updateHighlight();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (isOpen) {
                    highlightedIndex = Math.max(highlightedIndex - 1, 0);
                    updateHighlight();
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (isOpen && highlightedIndex >= 0 && highlightedIndex < items.length) {
                    const item = items[highlightedIndex];
                    if (item.classList.contains('dropdown-custom')) {
                        hideDropdown();
                        showCustomOptionModal(input, listId);
                    } else {
                        selectOption(item.dataset.value);
                    }
                }
                break;

            case 'Escape':
                e.preventDefault();
                hideDropdown();
                break;

            case 'Tab':
                hideDropdown();
                break;
        }
    });
}

function filterDropdown(dropdown, query) {
    const items = dropdown.querySelectorAll('.dropdown-item:not(.dropdown-custom)');
    const lowerQuery = query.toLowerCase();
    items.forEach(item => {
        const matches = !query || item.dataset.value.toLowerCase().includes(lowerQuery);
        item.style.display = matches ? '' : 'none';
    });
    // Always show custom option
    const customItem = dropdown.querySelector('.dropdown-custom');
    if (customItem) {
        customItem.style.display = '';
    }
}

function showCustomOptionModal(input, listId) {
    const customValue = prompt('Enter custom option:');
    if (customValue && customValue.trim()) {
        const trimmed = customValue.trim();
        input.value = trimmed;

        // Save custom option to storage if it's the unit model field
        if (listId === 'bedroomsOptions') {
            const state = loadState();
            if (!state.customDropdowns) state.customDropdowns = {};
            if (!state.customDropdowns.unitModels) state.customDropdowns.unitModels = [];
            if (!state.customDropdowns.unitModels.includes(trimmed)) {
                state.customDropdowns.unitModels.push(trimmed);
                saveState(state);
            }

            // Add to dropdown
            const dropdown = getById(`${listId}_dropdown`);
            if (dropdown) {
                const customItem = dropdown.querySelector('.dropdown-custom');
                const newItem = createElement('div', { className: 'dropdown-item', 'data-value': trimmed });
                newItem.textContent = trimmed;
                newItem.addEventListener('click', () => {
                    input.value = trimmed;
                    dropdown.classList.add('hidden');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
                dropdown.insertBefore(newItem, customItem);
            }
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Handle Unit Type changes - show/hide relevant area field groups
 */
function handleUnitTypeChange() {
    const unitType = getValue('input-unit-type').toLowerCase();

    // Get area groups
    const standardAreaGroup = getById('standardAreaGroup');
    const villaAreaGroup = getById('villaAreaGroup');
    const plotAreaGroup = getById('plotAreaGroup');
    const totalAreaGroup = getById('totalAreaGroup');

    // Hide all first
    if (standardAreaGroup) standardAreaGroup.style.display = 'none';
    if (villaAreaGroup) villaAreaGroup.style.display = 'none';
    if (plotAreaGroup) plotAreaGroup.style.display = 'none';
    if (totalAreaGroup) totalAreaGroup.style.display = 'none';

    // Show based on unit type
    if (unitType === 'villa' || unitType === 'townhouse') {
        // Villa/Townhouse: Internal, Terrace, BUA, GFA, Total, Plot Size
        if (villaAreaGroup) villaAreaGroup.style.display = '';
    } else if (unitType === 'plot') {
        // Plot: Plot Size, Allowed Build Area
        if (plotAreaGroup) plotAreaGroup.style.display = '';
    } else {
        // Standard (Apartment, etc.): Internal, Balcony, Total Area
        if (standardAreaGroup) standardAreaGroup.style.display = '';
        if (totalAreaGroup) totalAreaGroup.style.display = '';
    }

    // Trigger recalculation
    document.dispatchEvent(new CustomEvent('unitTypeChanged', { detail: { unitType } }));
}

// ============================================
// BETA FEATURE: Zoom Controls
// ============================================
function initZoomControls() {
    const previewArea = getById('previewArea');
    if (!previewArea || document.querySelector('.zoom-controls')) return;

    const controls = createElement('div', { className: 'zoom-controls beta-feature' });
    controls.innerHTML = `
        <button class="zoom-btn" id="zoomOut" title="Zoom Out">−</button>
        <span class="zoom-level" id="zoomLevel">100%</span>
        <button class="zoom-btn" id="zoomIn" title="Zoom In">+</button>
        <button class="zoom-btn" id="zoomReset" title="Reset">↺</button>
    `;

    previewArea.insertBefore(controls, previewArea.firstChild);

    let currentZoom = 100;
    const page = getById('a4Page');

    getById('zoomIn')?.addEventListener('click', () => {
        currentZoom = Math.min(150, currentZoom + 10);
        applyZoom();
    });

    getById('zoomOut')?.addEventListener('click', () => {
        currentZoom = Math.max(50, currentZoom - 10);
        applyZoom();
    });

    getById('zoomReset')?.addEventListener('click', () => {
        currentZoom = 100;
        applyZoom();
    });

    function applyZoom() {
        if (page) {
            page.style.transform = `scale(${currentZoom / 100})`;
        }
        const levelDisplay = getById('zoomLevel');
        if (levelDisplay) {
            levelDisplay.textContent = `${currentZoom}%`;
        }
    }
}

// ============================================
// BETA FEATURE: Offers Dashboard
// ============================================
function initOffersDashboard() {
    // Add dashboard button
    const actionButtons = document.querySelector('.action-buttons');
    if (!actionButtons || document.querySelector('#dashboardBtn')) return;

    const dashboardBtn = createElement('button', {
        id: 'dashboardBtn',
        className: 'btn btn-secondary beta-feature',
        title: 'All Offers Dashboard'
    });
    dashboardBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
        </svg>
    `;

    actionButtons.insertBefore(dashboardBtn, actionButtons.firstChild);

    dashboardBtn.addEventListener('click', openDashboard);

    // Create dashboard modal
    createDashboardModal();
}

function createDashboardModal() {
    if (getById('dashboardModal')) return;

    const modal = createElement('div', {
        id: 'dashboardModal',
        className: 'modal hidden beta-feature'
    });

    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content modal-lg">
            <div class="modal-header">
                <h3>All Offers Dashboard</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="dashboard-toolbar">
                    <input type="text" id="dashboardSearch" class="input-field" placeholder="Search offers...">
                    <button id="newOfferBtn" class="btn btn-primary btn-sm">+ New Offer</button>
                </div>
                <div id="dashboardGrid" class="dashboard-grid">
                    <!-- Populated dynamically -->
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.add('hidden'));
    getById('dashboardSearch')?.addEventListener('input', (e) => filterDashboard(e.target.value));
    getById('newOfferBtn')?.addEventListener('click', () => {
        modal.classList.add('hidden');
        // Clear form for new offer
        document.dispatchEvent(new CustomEvent('clearForm'));
    });
}

function openDashboard() {
    const modal = getById('dashboardModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    renderDashboardGrid();
}

function renderDashboardGrid() {
    const grid = getById('dashboardGrid');
    if (!grid) return;

    const templates = getTemplates();
    const currentOffer = getCurrentOffer();

    // Clear grid using DOM to prevent XSS
    grid.innerHTML = '';

    // Current offer card - use DOM methods for XSS prevention
    const currentCard = createElement('div', { className: 'dashboard-card current' });

    const badge = createElement('div', { className: 'card-badge' });
    badge.textContent = 'Current';
    currentCard.appendChild(badge);

    const currentTitle = createElement('h4');
    currentTitle.textContent = currentOffer.projectName || '-';
    currentCard.appendChild(currentTitle);

    const currentUnit = createElement('p', { className: 'card-unit' });
    currentUnit.textContent = `${currentOffer.unitNo || '-'} - ${currentOffer.bedrooms || '-'}`;
    currentCard.appendChild(currentUnit);

    const currentPrice = createElement('p', { className: 'card-price' });
    currentPrice.textContent = formatCurrency(currentOffer.sellingPrice);
    currentCard.appendChild(currentPrice);

    const currentMeta = createElement('div', { className: 'card-meta' });
    currentMeta.textContent = 'In progress';
    currentCard.appendChild(currentMeta);

    grid.appendChild(currentCard);

    // Saved templates - use DOM methods for XSS prevention
    templates.forEach(template => {
        const card = createElement('div', { className: 'dashboard-card' });
        card.dataset.id = template.id;

        const title = createElement('h4');
        title.textContent = template.data.projectName || template.name;
        card.appendChild(title);

        const unit = createElement('p', { className: 'card-unit' });
        unit.textContent = `${template.data.unitNo || '-'} - ${template.data.bedrooms || '-'}`;
        card.appendChild(unit);

        const price = createElement('p', { className: 'card-price' });
        price.textContent = formatCurrency(template.data.sellingPrice);
        card.appendChild(price);

        const meta = createElement('div', { className: 'card-meta' });
        meta.textContent = new Date(template.createdAt).toLocaleDateString();
        card.appendChild(meta);

        const actions = createElement('div', { className: 'card-actions' });

        const loadBtn = createElement('button', { className: 'card-btn load-btn', title: 'Load' });
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('loadTemplate', { detail: { id: template.id } }));
            getById('dashboardModal')?.classList.add('hidden');
        });
        actions.appendChild(loadBtn);

        const duplicateBtn = createElement('button', { className: 'card-btn duplicate-btn', title: 'Duplicate' });
        duplicateBtn.textContent = 'Copy';
        duplicateBtn.addEventListener('click', () => duplicateOffer(template.id));
        actions.appendChild(duplicateBtn);

        const deleteBtn = createElement('button', { className: 'card-btn delete-btn', title: 'Delete' });
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this offer?')) {
                deleteTemplate(template.id);
                renderDashboardGrid();
            }
        });
        actions.appendChild(deleteBtn);

        card.appendChild(actions);
        grid.appendChild(card);
    });

    if (templates.length === 0) {
        const empty = createElement('p', { className: 'dashboard-empty' });
        empty.textContent = 'No saved offers yet. Save your current offer as a template to see it here.';
        grid.appendChild(empty);
    }
}

function filterDashboard(query) {
    const cards = queryAll('.dashboard-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
}

function duplicateOffer(templateId) {
    const templates = getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Import saveTemplate
    import('./storage.js').then(({ saveTemplate }) => {
        saveTemplate(`${template.name} (Copy)`, template.data, template.branding);
        renderDashboardGrid();
        toast('Offer duplicated', 'success');
    });
}

// ============================================
// BETA FEATURE: WhatsApp Share
// ============================================
function initWhatsAppShare() {
    const actionButtons = document.querySelector('.action-buttons');
    if (!actionButtons || document.querySelector('#whatsappBtn')) return;

    const whatsappBtn = createElement('button', {
        id: 'whatsappBtn',
        className: 'btn btn-whatsapp beta-feature',
        title: 'Share via WhatsApp'
    });
    whatsappBtn.innerHTML = `
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    `;

    // Insert after export button
    const exportBtn = getById('exportBtn');
    if (exportBtn) {
        exportBtn.parentNode.insertBefore(whatsappBtn, exportBtn.nextSibling);
    }

    whatsappBtn.addEventListener('click', shareViaWhatsApp);
}

function shareViaWhatsApp() {
    const offer = getCurrentOffer();

    const refund = parseFloat(offer.refund) || 0;
    const balance = parseFloat(offer.balanceResale) || 0;
    const premium = parseFloat(offer.premium) || 0;
    const admin = parseFloat(offer.adminFees) || 0;
    const adgm = parseFloat(offer.adgm) || 0;
    const agency = parseFloat(offer.agencyFees) || 0;
    const total = refund + balance + premium + admin + adgm + agency;

    const message = `*SalesHUB Offer*

*Project:* ${offer.projectName || '-'}
*Unit:* ${offer.unitNo || '-'}
*Type:* ${offer.bedrooms || '-'}
*Area:* ${offer.totalArea || '-'}

*Price:* ${formatCurrency(offer.sellingPrice)}
*Original:* ${formatCurrency(offer.originalPrice)}

*Financial Breakdown:*
• Refund (Paid to Developer): ${formatCurrency(refund)}
• Balance Resale Clause: ${formatCurrency(balance)}
• Premium: ${formatCurrency(premium)}
• Admin Fees (SAAS): ${formatCurrency(admin)}
• ADGM (2%): ${formatCurrency(adgm)}
• Agency Fees (2%+VAT): ${formatCurrency(agency)}

*Total Initial Payment:* ${formatCurrency(total)}

_Created by Sanoop Syamalan - Associate Director - Kennedy Property Brokers LLC_`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

// ============================================
// BETA FEATURE: Price Per Sq Ft
// ============================================
function initPricePerSqft() {
    // Add display after selling price
    const sellInput = getById('u_selling_price');
    if (!sellInput || document.querySelector('#pricePerSqft')) return;

    const container = sellInput.closest('.input-group');
    if (!container) return;

    const display = createElement('div', {
        id: 'pricePerSqft',
        className: 'price-per-sqft beta-feature'
    });
    display.innerHTML = '<span class="sqft-label">Price/Sq.Ft:</span> <span class="sqft-value">-</span>';

    container.appendChild(display);

    // Update on relevant field changes
    ['u_selling_price', 'input-internal-area', 'input-balcony-area', 'input-total-area'].forEach(fieldId => {
        getById(fieldId)?.addEventListener('input', updatePricePerSqft);
    });

    updatePricePerSqft();
}

function updatePricePerSqft() {
    const display = document.querySelector('#pricePerSqft .sqft-value');
    if (!display) return;

    const sellingPrice = getNumericValue('u_selling_price');
    const internal = getNumericValue('input-internal-area');
    const balcony = getNumericValue('input-balcony-area');
    const totalArea = internal + balcony;

    if (sellingPrice > 0 && totalArea > 0) {
        const pricePerSqft = sellingPrice / totalArea;
        display.textContent = `AED ${pricePerSqft.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    } else {
        display.textContent = '-';
    }
}

// ============================================
// BETA FEATURE: Calculators
// ============================================
function initCalculators() {
    // Add calculator section
    const financialSection = document.querySelector('h3.section-title + .grid-2')?.closest('.section-title')?.parentElement;
    if (!financialSection || document.querySelector('#calculatorsSection')) return;

    const section = createElement('div', {
        id: 'calculatorsSection',
        className: 'calculators-section beta-feature'
    });

    section.innerHTML = `
        <hr class="section-divider">
        <h3 class="section-title">Quick Calculators</h3>
        <div class="calculator-cards">
            <div class="calc-card">
                <span class="calc-label">ROI</span>
                <span class="calc-value" id="roiValue">-</span>
            </div>
            <div class="calc-card">
                <span class="calc-label">Commission (2%)</span>
                <span class="calc-value" id="commissionValue">-</span>
            </div>
            <div class="calc-card">
                <span class="calc-label">Profit</span>
                <span class="calc-value" id="profitValue">-</span>
            </div>
        </div>
    `;

    // Insert before payment plan section
    const paymentSection = Array.from(document.querySelectorAll('h3.section-title')).find(h => h.textContent.includes('Payment'));
    if (paymentSection) {
        paymentSection.parentElement.insertBefore(section, paymentSection.previousElementSibling);
    }

    // Update calculators on field changes
    ['u_original_price', 'u_selling_price', 'input-refund-amount'].forEach(fieldId => {
        getById(fieldId)?.addEventListener('input', updateCalculators);
    });

    updateCalculators();
}

function updateCalculators() {
    const original = getNumericValue('u_original_price');
    const selling = getNumericValue('u_selling_price');

    // ROI = (Selling - Original) / Original * 100
    const roiEl = getById('roiValue');
    if (roiEl) {
        if (original > 0) {
            const roi = ((selling - original) / original) * 100;
            roiEl.textContent = `${roi.toFixed(1)}%`;
            roiEl.className = `calc-value ${roi >= 0 ? 'positive' : 'negative'}`;
        } else {
            roiEl.textContent = '-';
        }
    }

    // Commission = 2% of selling
    const commEl = getById('commissionValue');
    if (commEl) {
        if (selling > 0) {
            commEl.textContent = formatCurrency(selling * 0.02);
        } else {
            commEl.textContent = '-';
        }
    }

    // Profit = Selling - Original
    const profitEl = getById('profitValue');
    if (profitEl) {
        const profit = selling - original;
        profitEl.textContent = formatCurrency(profit);
        profitEl.className = `calc-value ${profit >= 0 ? 'positive' : 'negative'}`;
    }
}

// ============================================
// BETA FEATURE: Enhanced Export
// ============================================
function initEnhancedExport() {
    const exportModal = getById('exportModal');
    if (!exportModal) return;

    const exportOptions = exportModal.querySelector('.export-options');
    if (!exportOptions || exportOptions.dataset.betaEnhanced) return;

    exportOptions.dataset.betaEnhanced = 'true';

    // Add new export options
    const additionalOptions = `
        <label class="export-option beta-feature">
            <input type="radio" name="exportFormat" value="whatsapp">
            <span class="option-label">
                <strong>WhatsApp Text</strong>
                <small>Copy formatted text for WhatsApp</small>
            </span>
        </label>
        <label class="export-option beta-feature">
            <input type="radio" name="exportFormat" value="email">
            <span class="option-label">
                <strong>Email Template</strong>
                <small>Open in email client</small>
            </span>
        </label>
        <label class="export-option beta-feature">
            <input type="radio" name="exportFormat" value="clipboard">
            <span class="option-label">
                <strong>Copy to Clipboard</strong>
                <small>Copy formatted summary</small>
            </span>
        </label>
    `;

    exportOptions.insertAdjacentHTML('beforeend', additionalOptions);

    // Handle new export types
    const doExportBtn = getById('doExportBtn');
    if (doExportBtn && !doExportBtn.dataset.betaEnhanced) {
        doExportBtn.dataset.betaEnhanced = 'true';

        doExportBtn.addEventListener('click', (e) => {
            const format = document.querySelector('input[name="exportFormat"]:checked')?.value;

            if (format === 'whatsapp') {
                e.stopPropagation();
                shareViaWhatsApp();
                exportModal.classList.add('hidden');
            } else if (format === 'email') {
                e.stopPropagation();
                exportViaEmail();
                exportModal.classList.add('hidden');
            } else if (format === 'clipboard') {
                e.stopPropagation();
                copyToClipboard();
                exportModal.classList.add('hidden');
            }
        }, true);
    }
}

function exportViaEmail() {
    const offer = getCurrentOffer();

    const refund = parseFloat(offer.refund) || 0;
    const balance = parseFloat(offer.balanceResale) || 0;
    const premium = parseFloat(offer.premium) || 0;
    const admin = parseFloat(offer.adminFees) || 0;
    const adgm = parseFloat(offer.adgm) || 0;
    const agency = parseFloat(offer.agencyFees) || 0;
    const total = refund + balance + premium + admin + adgm + agency;

    const subject = `SalesHUB Offer - ${offer.projectName || '-'} ${offer.unitNo || ''}`;
    const body = `SalesHUB Offer Details

Project: ${offer.projectName || '-'}
Unit: ${offer.unitNo || '-'}
Type: ${offer.bedrooms || '-'}
Area: ${offer.totalArea || '-'}

Selling Price: ${formatCurrency(offer.sellingPrice)}
Original Price: ${formatCurrency(offer.originalPrice)}

Financial Breakdown:
- Refund (Paid to Developer): ${formatCurrency(refund)}
- Balance Resale Clause: ${formatCurrency(balance)}
- Premium: ${formatCurrency(premium)}
- Admin Fees (SAAS): ${formatCurrency(admin)}
- ADGM (2%): ${formatCurrency(adgm)}
- Agency Fees (2%+VAT): ${formatCurrency(agency)}

Total Initial Payment: ${formatCurrency(total)}

Please find the detailed offer document attached.

Created by Sanoop Syamalan - Associate Director - Kennedy Property Brokers LLC`;

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function copyToClipboard() {
    const offer = getCurrentOffer();

    const refund = parseFloat(offer.refund) || 0;
    const balance = parseFloat(offer.balanceResale) || 0;
    const premium = parseFloat(offer.premium) || 0;
    const admin = parseFloat(offer.adminFees) || 0;
    const adgm = parseFloat(offer.adgm) || 0;
    const agency = parseFloat(offer.agencyFees) || 0;
    const total = refund + balance + premium + admin + adgm + agency;

    const text = `SalesHUB Offer - ${offer.projectName || '-'}

Project: ${offer.projectName || '-'}
Unit: ${offer.unitNo || '-'}
Type: ${offer.bedrooms || '-'}
Area: ${offer.totalArea || '-'}

Selling Price: ${formatCurrency(offer.sellingPrice)}
Original Price: ${formatCurrency(offer.originalPrice)}

Financial Breakdown:
- Refund (Paid to Developer): ${formatCurrency(refund)}
- Balance Resale Clause: ${formatCurrency(balance)}
- Premium: ${formatCurrency(premium)}
- Admin Fees (SAAS): ${formatCurrency(admin)}
- ADGM (2%): ${formatCurrency(adgm)}
- Agency Fees (2%+VAT): ${formatCurrency(agency)}

Total Initial Payment: ${formatCurrency(total)}

Created by Sanoop Syamalan - Associate Director - Kennedy Property Brokers LLC`;

    navigator.clipboard.writeText(text).then(() => {
        toast('Copied to clipboard!', 'success');
    }).catch(() => {
        toast('Failed to copy', 'error');
    });
}

// ============================================
// BETA FEATURE: Tooltips
// ============================================
function initTooltips() {
    const tooltips = {
        'input-project-name': 'The name of the development or project',
        'u_unit_number': 'Unit number or identifier (e.g., "A-101", "05 Layout")',
        'u_unit_type': 'Type of property (Apartment, Villa, etc.) - affects which area fields are shown',
        'u_unit_model': 'Unit model/bedroom configuration',
        'u_views': 'What the unit overlooks',
        'input-internal-area': 'Indoor living area in square feet',
        'input-balcony-area': 'Outdoor area (balcony/terrace) in square feet',
        'u_plot_size': 'Plot size for Villa/Townhouse/Plot types',
        'input-total-area': 'Total area (auto-calculated from internal + balcony or plot size)',
        'u_original_price': 'Developer\'s original list price',
        'u_selling_price': 'Your selling/offer price',
        'u_resale_clause': 'Minimum % that must be paid before resale is allowed',
        'input-amount-paid-percent': 'Percentage of original price paid to developer',
        'input-amount-paid': 'Amount in AED paid to developer',
        'input-refund-amount': 'Refund = Amount paid to developer',
        'input-balance-resale': 'Balance = (Resale Clause % - Amount Paid %) × Original Price',
        'input-premium-amount': 'Premium = Selling Price - Original Price',
        'input-admin-fees': 'Administrative fees (SAAS)',
        'input-adgm-transfer': 'ADGM registration fee (2% of original price)',
        'input-agency-fees': 'Agency commission (2% + VAT)'
    };

    Object.entries(tooltips).forEach(([fieldId, text]) => {
        const input = getById(fieldId);
        if (!input || input.dataset.tooltipAdded) return;

        input.dataset.tooltipAdded = 'true';
        input.title = text;

        // Add tooltip icon
        const label = input.closest('.input-group')?.querySelector('.input-label');
        if (label && !label.querySelector('.tooltip-icon')) {
            const icon = createElement('span', {
                className: 'tooltip-icon beta-feature',
                title: text
            });
            icon.innerHTML = ' ⓘ';
            label.appendChild(icon);
        }
    });
}

// Re-initialize date pickers when payment plan is updated
document.addEventListener('paymentPlanUpdated', () => {
    if (isBetaEnabled && BETA_FEATURES.datePicker) {
        setTimeout(applyDatePickers, 100);
    }
});
