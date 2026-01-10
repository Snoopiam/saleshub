/**
 * Property Category Module
 * Handles switching between Off-Plan Resale and Ready Property modes
 */

import { getById, queryAll, getValue, setValue, setText, formatCurrency, formatDate } from '../utils/helpers.js';

// Current property category state
let currentCategory = 'offplan'; // 'offplan' or 'ready'
let currentOccupancy = 'owner'; // 'owner', 'vacant', 'leased'

// Month names for display
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_OPTIONS = [
    { value: '', label: '--' },
    { value: '1', label: 'Q1' },
    { value: '2', label: 'Q2' },
    { value: '3', label: 'Q3' },
    { value: '4', label: 'Q4' }
];
const MONTH_OPTIONS = [
    { value: '', label: '--' },
    { value: '1', label: 'Jan' },
    { value: '2', label: 'Feb' },
    { value: '3', label: 'Mar' },
    { value: '4', label: 'Apr' },
    { value: '5', label: 'May' },
    { value: '6', label: 'Jun' },
    { value: '7', label: 'Jul' },
    { value: '8', label: 'Aug' },
    { value: '9', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' }
];

/**
 * Initialize category module
 */
export function initCategory() {
    setupCategoryToggle();
    setupOccupancyToggle();
    setupShowOriginalToggle();
    setupShowPropertyStatusToggle();
    setupRowToggles();
    setupRentRefundToggle();
    setupHandoverDateListeners();

    // Load saved category from storage
    const savedCategory = localStorage.getItem('propertyCategory') || 'offplan';
    const savedOccupancy = localStorage.getItem('occupancyStatus') || 'owner';

    setCategory(savedCategory);
    setOccupancy(savedOccupancy);
}

/**
 * Set up category toggle buttons
 */
function setupCategoryToggle() {
    const categoryBtns = queryAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            setCategory(category);

            // Dispatch event for other modules
            document.dispatchEvent(new CustomEvent('categoryChanged', {
                detail: { category }
            }));
        });
    });
}

/**
 * Set up occupancy toggle buttons
 */
function setupOccupancyToggle() {
    const occupancyBtns = queryAll('.occupancy-btn');
    occupancyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const occupancy = btn.dataset.occupancy;
            setOccupancy(occupancy);

            // Dispatch event for other modules
            document.dispatchEvent(new CustomEvent('occupancyChanged', {
                detail: { occupancy }
            }));
        });
    });
}

/**
 * Set up Show Property Status toggle
 */
function setupShowPropertyStatusToggle() {
    const toggle = getById('u_showpropertystatus');
    if (toggle) {
        toggle.addEventListener('change', () => {
            const label = getById('showPropertyStatusLabel');
            if (label) {
                label.textContent = toggle.checked ? 'Show' : 'Hide';
            }
            updatePreviewForCategory();
        });
    }
}

/**
 * Set up individual row toggles
 */
function setupRowToggles() {
    const toggles = queryAll('.row-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            updatePreviewForCategory();
        });
    });
}

/**
 * Set up Show Original Price toggle
 */
function setupShowOriginalToggle() {
    const toggle = getById('u_showoriginal');
    if (toggle) {
        toggle.addEventListener('change', () => {
            const label = getById('showOriginalLabel');
            if (label) {
                label.textContent = toggle.checked ? 'Yes' : 'No';
            }
            updatePreviewForCategory();

            // Show/hide original price input field
            const origGroup = getById('originalPriceGroup');
            if (origGroup) {
                origGroup.style.display = toggle.checked ? '' : 'none';
            }
        });
    }
}

/**
 * Set up Rent Refund toggle
 */
function setupRentRefundToggle() {
    const toggle = getById('u_rentrefund');
    if (toggle) {
        toggle.addEventListener('change', () => {
            const label = getById('rentRefundLabel');
            if (label) {
                label.textContent = toggle.checked ? 'Yes (Pro-rata)' : 'No';
            }
            updatePreviewForCategory();
        });
    }
}

/**
 * Set up handover date listeners
 */
function setupHandoverDateListeners() {
    // Project handover type change (Month/Quarter)
    const projectType = getById('u_projecthandover_type');
    if (projectType) {
        projectType.addEventListener('change', () => {
            updatePeriodOptions('u_projecthandover_period', projectType.value);
            calculateAges();
            updatePreviewForCategory();
        });
    }

    // Unit handover type change (Month/Quarter)
    const unitType = getById('u_unithandover_type');
    if (unitType) {
        unitType.addEventListener('change', () => {
            updatePeriodOptions('u_unithandover_period', unitType.value);
            calculateAges();
            updatePreviewForCategory();
        });
    }

    // Period and year changes
    ['u_projecthandover_period', 'u_projecthandover_year', 'u_unithandover_period', 'u_unithandover_year'].forEach(id => {
        const el = getById(id);
        if (el) {
            el.addEventListener('change', () => {
                calculateAges();
                updatePreviewForCategory();
            });
            el.addEventListener('input', () => {
                calculateAges();
                updatePreviewForCategory();
            });
        }
    });
}

/**
 * Update period dropdown options based on type (month/quarter)
 */
function updatePeriodOptions(selectId, type) {
    const select = getById(selectId);
    if (!select) return;

    const currentValue = select.value;
    const options = type === 'quarter' ? QUARTER_OPTIONS : MONTH_OPTIONS;

    // Clear and rebuild options
    select.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
    });

    // Try to preserve value if possible
    if (type === 'quarter' && currentValue) {
        // Convert month to quarter
        const month = parseInt(currentValue);
        if (month >= 1 && month <= 12) {
            const quarter = Math.ceil(month / 3);
            select.value = quarter.toString();
        }
    } else if (type === 'month' && currentValue) {
        // If switching from quarter to month, set to first month of quarter
        const quarter = parseInt(currentValue);
        if (quarter >= 1 && quarter <= 4) {
            const month = (quarter - 1) * 3 + 1;
            select.value = month.toString();
        }
    }
}

/**
 * Calculate project age and unit ownership duration
 */
function calculateAges() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Project Age
    const projectType = getValue('u_projecthandover_type') || 'month';
    const projectPeriod = getValue('u_projecthandover_period');
    const projectYear = getValue('u_projecthandover_year');

    if (projectPeriod && projectYear) {
        const projectMonth = projectType === 'quarter'
            ? (parseInt(projectPeriod) - 1) * 3 + 2 // Middle month of quarter
            : parseInt(projectPeriod);
        const projectAge = calculateDuration(parseInt(projectYear), projectMonth, currentYear, currentMonth);
        const projectAgeEl = getById('u_projectage');
        if (projectAgeEl) {
            projectAgeEl.value = projectAge;
        }
    } else {
        const projectAgeEl = getById('u_projectage');
        if (projectAgeEl) projectAgeEl.value = '';
    }

    // Unit Ownership
    const unitType = getValue('u_unithandover_type') || 'month';
    const unitPeriod = getValue('u_unithandover_period');
    const unitYear = getValue('u_unithandover_year');

    if (unitPeriod && unitYear) {
        const unitMonth = unitType === 'quarter'
            ? (parseInt(unitPeriod) - 1) * 3 + 2
            : parseInt(unitPeriod);
        const unitOwnership = calculateDuration(parseInt(unitYear), unitMonth, currentYear, currentMonth);
        const unitOwnershipEl = getById('u_unitownership');
        if (unitOwnershipEl) {
            unitOwnershipEl.value = unitOwnership;
        }
    } else {
        const unitOwnershipEl = getById('u_unitownership');
        if (unitOwnershipEl) unitOwnershipEl.value = '';
    }
}

/**
 * Calculate duration between two dates in years and months
 */
function calculateDuration(startYear, startMonth, endYear, endMonth) {
    let years = endYear - startYear;
    let months = endMonth - startMonth;

    if (months < 0) {
        years--;
        months += 12;
    }

    if (years === 0 && months === 0) {
        return 'Less than 1 month';
    } else if (years === 0) {
        return `${months} month${months > 1 ? 's' : ''}`;
    } else if (months === 0) {
        return `${years} year${years > 1 ? 's' : ''}`;
    } else {
        return `${years} year${years > 1 ? 's' : ''}, ${months} month${months > 1 ? 's' : ''}`;
    }
}

/**
 * Format handover date for display
 */
function formatHandoverDate(type, period, year) {
    if (!period || !year) return '-';

    if (type === 'quarter') {
        return `Q${period} ${year}`;
    } else {
        return `${MONTH_NAMES[parseInt(period)] || period} ${year}`;
    }
}

/**
 * Set the current property category
 * @param {string} category - 'offplan' or 'ready'
 */
export function setCategory(category) {
    currentCategory = category;
    localStorage.setItem('propertyCategory', category);

    // Update toggle buttons
    const categoryBtns = queryAll('.category-btn');
    categoryBtns.forEach(btn => {
        const isActive = btn.dataset.category === category;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive.toString());
    });

    // Show/hide sections based on category
    updateUIForCategory(category);
    updatePreviewForCategory();
}

/**
 * Set the current occupancy status
 * @param {string} occupancy - 'owner', 'vacant', 'leased'
 */
export function setOccupancy(occupancy) {
    currentOccupancy = occupancy;
    localStorage.setItem('occupancyStatus', occupancy);

    // Update toggle buttons
    const occupancyBtns = queryAll('.occupancy-btn');
    occupancyBtns.forEach(btn => {
        const isActive = btn.dataset.occupancy === occupancy;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive.toString());
    });

    // Show/hide lease details
    const leaseSection = getById('leaseDetailsSection');
    if (leaseSection) {
        leaseSection.style.display = occupancy === 'leased' ? '' : 'none';
    }

    updatePreviewForCategory();
}

/**
 * Update UI elements based on category
 * @param {string} category - Current category
 */
function updateUIForCategory(category) {
    const isReady = category === 'ready';

    // Off-plan only fields
    const offplanFields = getById('offplanFieldsGroup');
    if (offplanFields) {
        offplanFields.style.display = isReady ? 'none' : '';
    }

    // Ready property section
    const readySection = getById('readyPropertySection');
    if (readySection) {
        readySection.style.display = isReady ? '' : 'none';
    }

    // Show Original Price toggle (only for Ready)
    const showOrigToggle = getById('showOriginalPriceToggle');
    if (showOrigToggle) {
        showOrigToggle.style.display = isReady ? '' : 'none';
    }

    // Original Price field
    const origGroup = getById('originalPriceGroup');
    if (origGroup) {
        if (isReady) {
            const showOrig = getById('u_showoriginal');
            origGroup.style.display = showOrig && showOrig.checked ? '' : 'none';
        } else {
            origGroup.style.display = '';
        }
    }

    // Payment Plan section - hide for Ready Property
    const paymentPlanSection = getById('paymentPlanSection');
    const paymentPlanContainer = getById('paymentPlanContainer');
    if (paymentPlanSection) {
        paymentPlanSection.style.display = isReady ? 'none' : '';
    }
    if (paymentPlanContainer) {
        paymentPlanContainer.style.display = isReady ? 'none' : '';
    }
}

/**
 * Update preview based on current category
 */
export function updatePreviewForCategory() {
    const isReady = currentCategory === 'ready';

    // Off-plan specific rows in preview
    const offplanRows = ['disp_row_refund', 'disp_row_balance_resale', 'disp_row_premium', 'disp_divider_offplan'];
    offplanRows.forEach(id => {
        const row = getById(id);
        if (row) {
            row.style.display = isReady ? 'none' : '';
        }
    });

    // Original price row
    const origRow = getById('disp_row_original_price');
    if (origRow) {
        if (isReady) {
            const showOrig = getById('u_showoriginal');
            origRow.style.display = showOrig && showOrig.checked ? '' : 'none';
        } else {
            origRow.style.display = '';
        }
    }

    // Resale footnote
    const footnote = getById('resaleFootnote');
    if (footnote) {
        footnote.style.display = isReady ? 'none' : '';
    }

    // Property status table (Ready only)
    const statusTable = getById('propertyStatusTable');
    if (statusTable) {
        const showStatus = getById('u_showpropertystatus')?.checked !== false;
        statusTable.style.display = (isReady && showStatus) ? '' : 'none';
    }

    // Payment Plan table in preview (Off-Plan only)
    const previewPaymentTable = getById('previewPaymentPlanTable');
    if (previewPaymentTable) {
        previewPaymentTable.style.display = isReady ? 'none' : '';
    }

    // Update property status values
    if (isReady) {
        updatePropertyStatusPreview();
    }
}

/**
 * Update property status preview values
 */
function updatePropertyStatusPreview() {
    // Project Handover Date
    const projectType = getValue('u_projecthandover_type') || 'month';
    const projectPeriod = getValue('u_projecthandover_period');
    const projectYear = getValue('u_projecthandover_year');
    setText('disp_projecthandover', formatHandoverDate(projectType, projectPeriod, projectYear));

    // Project Age
    const projectAge = getValue('u_projectage');
    setText('disp_projectage', projectAge || '-');

    // Unit Handover Date
    const unitType = getValue('u_unithandover_type') || 'month';
    const unitPeriod = getValue('u_unithandover_period');
    const unitYear = getValue('u_unithandover_year');
    setText('disp_unithandover', formatHandoverDate(unitType, unitPeriod, unitYear));

    // Unit Ownership
    const unitOwnership = getValue('u_unitownership');
    setText('disp_unitownership', unitOwnership || '-');

    // Occupancy status
    const occupancyText = {
        'owner': 'Owner Occupied',
        'vacant': 'Vacant',
        'leased': 'Leased'
    };
    setText('disp_occupancy', occupancyText[currentOccupancy] || '-');

    // Lease details (only if leased)
    const isLeased = currentOccupancy === 'leased';

    // Standard rows - ensure they are visible first (if not hidden by parent logic)
    const standardRows = [
        'disp_row_projecthandover',
        'disp_row_projectage',
        'disp_row_unithandover',
        'disp_row_unitownership',
        'disp_row_occupancy',
        'disp_row_servicecharge'
    ];

    standardRows.forEach(id => {
        const row = getById(id);
        if (row) row.style.display = '';
    });

    const rentRow = getById('disp_row_currentrent');
    const leaseRow = getById('disp_row_leaseuntil');
    const refundRow = getById('disp_row_rentrefund');

    if (rentRow) rentRow.style.display = isLeased ? '' : 'none';
    if (leaseRow) leaseRow.style.display = isLeased ? '' : 'none';
    if (refundRow) refundRow.style.display = isLeased ? '' : 'none';

    if (isLeased) {
        const rent = getValue('u_currentrent');
        const leaseUntil = getValue('u_leaseuntil');
        const rentRefund = getById('u_rentrefund')?.checked;

        setText('disp_currentrent', rent ? formatCurrency(rent) + '/year' : '-');
        setText('disp_leaseuntil', leaseUntil ? formatDate(new Date(leaseUntil)) : '-');
        setText('disp_rentrefund', rentRefund ? 'Yes (Pro-rata)' : 'No');
    }

    // Service charge
    const serviceCharge = getValue('u_servicecharge');
    setText('disp_servicecharge', serviceCharge ? formatCurrency(serviceCharge) + '/year' : '-');

    // Apply individual row toggles
    const toggles = queryAll('.row-toggle');
    toggles.forEach(toggle => {
        if (!toggle.checked) {
            const targetId = toggle.dataset.target;
            const targetRow = getById(targetId);
            if (targetRow) {
                targetRow.style.display = 'none';
            }
        }
    });
}

/**
 * Get the current category
 * @returns {string} Current category ('offplan' or 'ready')
 */
export function getCategory() {
    return currentCategory;
}

/**
 * Get the current occupancy status
 * @returns {string} Current occupancy ('owner', 'vacant', 'leased')
 */
export function getOccupancy() {
    return currentOccupancy;
}

/**
 * Get all Ready Property data
 * @returns {Object} Ready property specific data
 */
export function getReadyPropertyData() {
    const rowToggles = {};
    queryAll('.row-toggle').forEach(toggle => {
        rowToggles[toggle.dataset.target] = toggle.checked;
    });

    return {
        category: currentCategory,
        occupancy: currentOccupancy,
        showOriginalPrice: getById('u_showoriginal')?.checked || false,
        showPropertyStatus: getById('u_showpropertystatus')?.checked || false,
        rowToggles: rowToggles,
        // Handover dates
        projectHandoverType: getValue('u_projecthandover_type'),
        projectHandoverPeriod: getValue('u_projecthandover_period'),
        projectHandoverYear: getValue('u_projecthandover_year'),
        unitHandoverType: getValue('u_unithandover_type'),
        unitHandoverPeriod: getValue('u_unithandover_period'),
        unitHandoverYear: getValue('u_unithandover_year'),
        // Lease details
        currentRent: getValue('u_currentrent'),
        leaseUntil: getValue('u_leaseuntil'),
        rentRefund: getById('u_rentrefund')?.checked || false,
        serviceCharge: getValue('u_servicecharge')
    };
}

/**
 * Set Ready Property data
 * @param {Object} data - Ready property data
 */
export function setReadyPropertyData(data) {
    if (!data) return;

    if (data.category) {
        setCategory(data.category);
    }

    if (data.occupancy) {
        setOccupancy(data.occupancy);
    }

    const showOrigToggle = getById('u_showoriginal');
    if (showOrigToggle && data.showOriginalPrice !== undefined) {
        showOrigToggle.checked = data.showOriginalPrice;
        const label = getById('showOriginalLabel');
        if (label) label.textContent = data.showOriginalPrice ? 'Yes' : 'No';
    }

    const showStatusToggle = getById('u_showpropertystatus');
    if (showStatusToggle && data.showPropertyStatus !== undefined) {
        showStatusToggle.checked = data.showPropertyStatus;
        const label = getById('showPropertyStatusLabel');
        if (label) label.textContent = data.showPropertyStatus ? 'Show' : 'Hide';
    }

    if (data.rowToggles) {
        Object.entries(data.rowToggles).forEach(([targetId, isChecked]) => {
            const toggle = document.querySelector(`.row-toggle[data-target="${targetId}"]`);
            if (toggle) {
                toggle.checked = isChecked;
            }
        });
    }

    // Handover dates
    if (data.projectHandoverType) setValue('u_projecthandover_type', data.projectHandoverType);
    if (data.projectHandoverPeriod) setValue('u_projecthandover_period', data.projectHandoverPeriod);
    if (data.projectHandoverYear) setValue('u_projecthandover_year', data.projectHandoverYear);
    if (data.unitHandoverType) setValue('u_unithandover_type', data.unitHandoverType);
    if (data.unitHandoverPeriod) setValue('u_unithandover_period', data.unitHandoverPeriod);
    if (data.unitHandoverYear) setValue('u_unithandover_year', data.unitHandoverYear);

    // Recalculate ages after loading
    calculateAges();

    if (data.currentRent) setValue('u_currentrent', data.currentRent);
    if (data.leaseUntil) setValue('u_leaseuntil', data.leaseUntil);

    const rentRefundToggle = getById('u_rentrefund');
    if (rentRefundToggle && data.rentRefund !== undefined) {
        rentRefundToggle.checked = data.rentRefund;
        const label = getById('rentRefundLabel');
        if (label) label.textContent = data.rentRefund ? 'Yes (Pro-rata)' : 'No';
    }

    if (data.serviceCharge) setValue('u_servicecharge', data.serviceCharge);

    updatePreviewForCategory();
}
