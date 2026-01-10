/**
 * Excel Import Module
 * Handle Excel file parsing and data extraction
 *
 * FORMAT: Label-Value pairs in Columns A-B
 * - Rows 1-25: Property details and financial data
 * - Row 25: Payment Plan name (e.g., "30:70")
 * - Rows 26+: Payment Plan installments (columns A-D)
 *
 * Supports Off-Plan Resale and Ready Property categories
 */

import { getById, setValue, toast, formatDate, excelDateToJS } from '../utils/helpers.js';
import { setPaymentPlan, setPaymentPlanName } from './paymentPlan.js';
import { runAllCalculations } from './calculator.js';

/**
 * Label mappings - maps Excel labels (Column A) to form field IDs
 * Keys are normalized (lowercase, trimmed)
 */
const LABEL_TO_FIELD = {
    'project name': 'input-project-name',
    'unit no': 'input-unit-number',
    'unit type': 'input-unit-type',
    'unit model': 'select-unit-model',
    'views': 'select-views',
    'internal area (sq.ft)': 'input-internal-area',
    'balcony area (sq.ft)': 'input-balcony-area',
    'total area (sq.ft)': 'input-total-area',
    'original price': 'input-original-price',
    'selling price': 'input-selling-price',
    'paid percentage': 'input-amount-paid-percent',
    'resale clause': 'input-resale-clause',
    'balance resale clause (aed)': 'input-balance-resale',
    'admin fees (saas)': 'input-admin-fees',
    'adgm (2% of original price)': 'input-adgm-transfer',
    'adgm termination fee': 'input-adgm-termination-fee',
    'adgm electronic service fee': 'input-adgm-electronic-fee',
    'agency fees (2% of selling price + vat)': 'input-agency-fees'
};

/**
 * Fields that store percentages as decimals (0.3 = 30%)
 */
const DECIMAL_PERCENT_FIELDS = ['input-amount-paid-percent', 'input-resale-clause'];

/**
 * Numeric fields that should be parsed as numbers
 */
const NUMERIC_FIELDS = [
    'input-internal-area', 'input-balcony-area', 'input-total-area', 'input-original-price', 'input-selling-price',
    'input-amount-paid-percent', 'input-resale-clause', 'input-balance-resale', 'input-admin-fees',
    'input-adgm-transfer', 'input-adgm-termination-fee', 'input-adgm-electronic-fee', 'input-agency-fees'
];

/**
 * Initialize Excel import
 */
export function initExcel() {
    const uploadInput = getById('excelUpload');
    if (uploadInput) {
        uploadInput.addEventListener('change', handleExcelUpload);
    }
}

/**
 * Handle Excel file upload
 * @param {Event} e - Change event
 */
async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        toast('Excel library not loaded. Please refresh the page and try again.', 'error');
        return;
    }

    // Validate file type
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        toast('Please upload an Excel file (.xlsx or .xls)', 'error');
        return;
    }

    toast('Processing Excel file...', 'info');

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get current category from localStorage (what user has selected)
            const currentCategory = localStorage.getItem('propertyCategory') || 'offplan';
            const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
            let sheetToUse = workbook.SheetNames[0];
            let sheetFound = false;

            // Import based on currently selected category
            if (currentCategory === 'ready') {
                if (sheetNames.includes('ready')) {
                    sheetToUse = workbook.SheetNames[sheetNames.indexOf('ready')];
                    sheetFound = true;
                }
            } else {
                if (sheetNames.includes('offplan')) {
                    sheetToUse = workbook.SheetNames[sheetNames.indexOf('offplan')];
                    sheetFound = true;
                }
            }

            const selectedSheet = workbook.Sheets[sheetToUse];
            const jsonData = XLSX.utils.sheet_to_json(selectedSheet, { header: 1 });

            // Show which sheet was imported
            const sheetUsedName = sheetFound ? sheetToUse : `${sheetToUse} (default)`;

            // Parse using new Label-Value format
            const parseResult = parseExcelLabelValue(jsonData);

            if (parseResult.success) {
                // [FIX] Run calculations FIRST to populate derived fields (Premium, Agency, etc.)
                runAllCalculations();

                // [FIX] THEN notify app.js to update preview and sync Handover row
                document.dispatchEvent(new CustomEvent('dataImported'));

                toast(`Imported from "${sheetUsedName}" sheet (${parseResult.fieldsFound} fields)`, 'success');
            } else {
                toast('Could not parse Excel file. Check format.', 'error');
            }
        } catch {
            toast('Error reading Excel file. Please check the format.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);

    // Reset input so same file can be uploaded again
    e.target.value = '';
}

/**
 * Parse Excel data in Label-Value format (Columns A-B)
 * @param {Array} jsonData - Array of rows from Excel
 * @returns {Object} { success: boolean, fieldsFound: number }
 */
function parseExcelLabelValue(jsonData) {
    if (!jsonData || jsonData.length === 0) {
        return { success: false, fieldsFound: 0 };
    }

    let fieldsFound = 0;
    let paymentPlanStartRow = -1;
    let paymentPlanName = '';

    // Track special fields for Unit Model combination
    let unitModel = '';
    let hasMaidsRoom = false;
    let hasLaundryRoom = false;
    let hasStoreRoom = false;

    // Parse Label-Value rows
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[0]) continue;

        const label = String(row[0]).toLowerCase().trim();
        const value = row[1];

        // Check for Payment Plan row (marks start of payment plan section)
        if (label === 'payment plan') {
            paymentPlanStartRow = i + 1;
            paymentPlanName = value ? String(value).trim() : '';
            continue;
        }

        // Skip if we've reached payment plan section
        if (paymentPlanStartRow > 0 && i >= paymentPlanStartRow) {
            continue;
        }

        // Handle special fields for Unit Model combination
        if (label === 'unit model') {
            unitModel = value ? String(value).trim() : '';
            continue;
        }
        if (label.includes('maid')) {
            hasMaidsRoom = String(value).toLowerCase().trim() === 'yes';
            continue;
        }
        if (label.includes('laundry')) {
            hasLaundryRoom = String(value).toLowerCase().trim() === 'yes';
            continue;
        }
        if (label.includes('store')) {
            hasStoreRoom = String(value).toLowerCase().trim() === 'yes';
            continue;
        }

        // Skip calculated/display-only fields (we'll calculate these)
        if (label.includes('refund') || label.includes('premium') || label.includes('total initial')) {
            continue;
        }

        // Look up field ID from label
        const fieldId = LABEL_TO_FIELD[label];
        if (!fieldId) continue;

        // Skip if no value
        if (value === undefined || value === null || value === '') continue;

        // Process value
        let processedValue = value;

        // Handle numeric fields
        if (NUMERIC_FIELDS.includes(fieldId)) {
            let numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));

            if (isNaN(numValue)) continue;

            // Convert decimal percentages to whole numbers (0.3 → 30)
            if (DECIMAL_PERCENT_FIELDS.includes(fieldId) && numValue < 1) {
                numValue = numValue * 100;
            }

            processedValue = numValue;
        }

        // Normalize Views values
        if (fieldId === 'select-views' && typeof processedValue === 'string') {
            processedValue = processedValue.replace(/\s+Views$/i, ' View');
        }

        // Set value in form
        setValue(fieldId, processedValue);
        fieldsFound++;
    }

    // Combine Unit Model with Maid's Room, Laundry Room, Store Room
    if (unitModel) {
        let combinedModel = unitModel;
        const extras = [];
        if (hasMaidsRoom) extras.push("Maid");
        if (hasLaundryRoom) extras.push("Laundry");
        if (hasStoreRoom) extras.push("Store");

        if (extras.length > 0) {
            combinedModel = `${unitModel} + ${extras.join(' + ')}`;
        }

        setValue('select-unit-model', combinedModel);
        fieldsFound++;
    }

    // Parse Payment Plan section
    if (paymentPlanStartRow > 0) {
        const paymentPlan = parsePaymentPlanSection(jsonData, paymentPlanStartRow);
        if (paymentPlan.length > 0) {
            setPaymentPlan(paymentPlan);

            // Set payment plan name if available
            if (paymentPlanName && typeof setPaymentPlanName === 'function') {
                setPaymentPlanName(paymentPlanName);
            }
        }
    }

    // [FIX] Removed dispatchEvent from here to prevent premature updates.
    // It is now called in handleExcelUpload after calculations are complete.

    return { success: fieldsFound >= 3, fieldsFound };
}

/**
 * Parse Payment Plan section from Excel
 * Supports table format with header row: No. | % | Date | Amount (AED)
 */
function parsePaymentPlanSection(jsonData, startRow) {
    const paymentPlan = [];
    let dataStartRow = startRow;

    // Check if first row is a header row (table format)
    const firstRow = jsonData[startRow];
    if (firstRow && firstRow[0]) {
        const firstCell = String(firstRow[0]).toLowerCase().trim();
        // Detect header row: "no.", "no", "#", "installment", etc.
        if (firstCell === 'no.' || firstCell === 'no' || firstCell === '#' ||
            firstCell === 'installment' || firstCell.includes('no')) {
            dataStartRow = startRow + 1; // Skip header row
        }
    }

    for (let i = dataStartRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;

        // Check if row has data (at least installment number or percentage)
        const installmentNum = row[0];
        const percentValue = row[1];
        const dateValue = row[2];
        const amountValue = row[3];

        // Stop if we hit an empty row or non-numeric first column
        if (installmentNum === undefined || installmentNum === null || installmentNum === '') {
            break;
        }

        // Skip if first column is not a number (might be another section)
        if (typeof installmentNum !== 'number' && !/^\d+$/.test(String(installmentNum).trim())) {
            break;
        }

        // Format percentage (convert decimal to whole number)
        let percentStr = '';
        if (percentValue !== undefined && percentValue !== null) {
            if (typeof percentValue === 'number') {
                percentStr = percentValue < 1 ? (percentValue * 100).toString() : percentValue.toString();
            } else {
                percentStr = String(percentValue).replace('%', '').trim();
            }
        }

        // Format date
        let dateStr = '';
        if (dateValue !== undefined && dateValue !== null) {
            if (typeof dateValue === 'number') {
                // Excel serial date
                dateStr = formatDate(excelDateToJS(dateValue));
            } else {
                dateStr = String(dateValue).trim();
            }
        }

        // Format amount
        let amountVal = '';
        if (amountValue !== undefined && amountValue !== null) {
            if (typeof amountValue === 'number') {
                amountVal = amountValue;
            } else {
                const parsed = parseFloat(String(amountValue).replace(/[^0-9.-]/g, ''));
                amountVal = isNaN(parsed) ? '' : parsed;
            }
        }

        // Add to payment plan if we have meaningful data
        if (percentStr || dateStr || amountVal) {
            paymentPlan.push({
                date: dateStr,
                percentage: percentStr,
                amount: amountVal
            });
        }
    }

    return paymentPlan;
}
