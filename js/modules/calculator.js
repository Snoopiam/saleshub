/**
 * ============================================================================
 * CALCULATOR.JS - Auto-Calculation Module
 * ============================================================================
 *
 * PURPOSE: Handles automatic calculation of derived fields based on user inputs.
 *          Fields can be "locked" to override auto-calculation with manual values.
 *
 * CALCULATED FIELDS:
 * - input-total-area: Total Area = Internal + Balcony (apartments)
 * - u_bua: Built-Up Area = Internal + Terrace (villas)
 * - input-refund-amount: Refund = Amount Paid to Developer (from % or direct amount)
 * - u_balance_resale: Balance = Resale Clause % - Amount Paid % (if paid < clause)
 * - input-premium-amount: Premium = Selling Price - Original Price
 * - u_adgm_transfer: ADGM Fee = 2% of Original Price
 * - input-agency-fees: Agency Fees = 2% of Selling Price + 5% VAT
 *
 * TRIGGER FIELDS (changes to these trigger recalculation):
 * - u_original_price (Original Price)
 * - u_selling_price (Selling Price)
 * - input-internal-area, input-balcony-area (Standard area fields)
 * - u_villa_internal, u_villa_terrace (Villa area fields)
 * - u_resale_clause, u_amount_paid_percent, u_amount_paid
 *
 * TOTAL CALCULATION:
 * - Off-Plan: Refund + Balance + Premium + Admin + ADGM + ADGM Fees + Agency
 * - Ready: Selling Price + Admin + ADGM + ADGM Fees + Agency
 *
 * LOCK FEATURE:
 * Users can "lock" a calculated field to enter a manual value.
 * Locked fields skip auto-calculation until unlocked.
 *
 * ============================================================================
 */

import { getNumericValue, formatCurrency, getById } from '../utils/helpers.js';
import { isFieldLocked, toggleFieldLock } from './storage.js';

/**
 * Get current property category from localStorage.
 *
 * WHY SEPARATE FUNCTION: We can't import from category.js directly because
 * that would create a circular dependency (category.js imports calculator.js).
 * Using localStorage as a simple shared state avoids this issue.
 *
 * @returns {string} 'offplan' or 'ready'
 */
function getCurrentCategory() {
    return localStorage.getItem('propertyCategory') || 'offplan';
}

/**
 * ============================================================================
 * CALCULATION FORMULAS OBJECT
 * ============================================================================
 *
 * Each key is a field ID (matches the input element ID in HTML).
 * Each value is a function that computes the field's value.
 *
 * HOW IT WORKS:
 * 1. User changes a "trigger field" (e.g., u_original_price)
 * 2. runAllCalculations() is called
 * 3. For each field in this object, we check if it's locked
 * 4. If not locked, we run the calculation and update the field
 *
 * FIELD ID NAMING CONVENTION:
 * - u_* = user input field
 * - input-total-area = Total Area (calculated)
 * - input-refund-amount = Refund amount (calculated)
 * - u_balance_resale = Balance (calculated)
 * - input-premium-amount = Premium (calculated)
 * - u_adgm_transfer = ADGM fee (calculated)
 * - input-agency-fees = Agency fees (calculated)
 * ============================================================================
 */
const calculations = {

    /**
     * TOTAL AREA (input-total-area)
     * For standard apartments only (not villas/plots).
     *
     * FORMULA: Internal Area + Balcony Area
     *
     * EXAMPLE:
     * - Internal: 918.38 Sq.Ft
     * - Balcony: 173.94 Sq.Ft
     * - Total: 1092.32 Sq.Ft
     *
     * RETURNS: Number string (Sq.Ft suffix added in display layer)
     */
    'input-total-area': () => {
        const internal = getNumericValue('input-internal-area');  // Get Internal Area input value
        const balcony = getNumericValue('input-balcony-area');    // Get Balcony Area input value
        const total = internal + balcony;
        // Return formatted number with 2 decimal places (Sq.Ft added in display)
        return total > 0 ? total.toFixed(2) : '';
    },

    /**
     * BUA - Built-Up Area (u_built_up_area)
     * For villas/townhouses only.
     *
     * FORMULA: Villa Internal Area + Terrace Area
     *
     * NOTE: BUA is different from GFA (Gross Floor Area).
     * BUA typically includes internal + terrace.
     * GFA includes all enclosed areas.
     */
    'input-built-up-area': () => {
        const internal = getNumericValue('input-villa-internal');  // Villa internal area
        const terrace = getNumericValue('input-villa-terrace');    // Terrace area
        const total = internal + terrace;
        return total > 0 ? `${total.toFixed(2)} Sq.Ft` : '';
    },

    /**
     * REFUND (u_paid)
     * Amount to be refunded to the original buyer (off-plan resale).
     *
     * BUSINESS LOGIC:
     * In an off-plan resale, the new buyer must reimburse the original
     * buyer for the amount they've already paid to the developer.
     *
     * INPUT PRIORITY:
     * 1. If direct Amount Paid (AED) is entered → use it directly
     * 2. If only Amount Paid % is entered → calculate from Original Price
     *
     * EXAMPLE:
     * - Original Price: AED 2,000,000
     * - Amount Paid %: 20%
     * - Refund = 2,000,000 × 0.20 = AED 400,000
     */
    'input-refund-amount': () => {
        const original = getNumericValue('input-original-price');              // Original purchase price
        const amountPaidPercent = getNumericValue('input-amount-paid-percent');  // % paid to developer
        const amountPaid = getNumericValue('input-amount-paid');      // Direct AED amount paid

        // PRIORITY 1: If direct amount is provided, use it (user knows exact amount)
        if (amountPaid > 0) {
            return Math.round(amountPaid);  // Round to whole number (no cents)
        }

        // PRIORITY 2: Calculate from percentage
        if (amountPaidPercent > 0 && original > 0) {
            return Math.round(original * (amountPaidPercent / 100));
        }

        return 0;  // No data to calculate from
    },

    /**
     * BALANCE RESALE CLAUSE (u_bal)
     * Additional amount buyer must pay to meet developer's resale requirements.
     *
     * BUSINESS LOGIC:
     * Developers often require a minimum payment before allowing resale.
     * Example: "Cannot resale until 40% is paid"
     *
     * If buyer has only paid 20%, but resale clause requires 40%,
     * the new buyer must pay the 20% difference to the developer.
     *
     * FORMULA:
     * - If (Amount Paid % < Resale Clause %) → Balance = (Resale Clause - Paid) × Original
     * - If (Amount Paid % >= Resale Clause %) → Balance = 0 (already met requirement)
     *
     * EXAMPLE:
     * - Original Price: AED 2,000,000
     * - Resale Clause: 40%
     * - Amount Paid: 20%
     * - Balance = (40% - 20%) × 2,000,000 = AED 400,000
     */
    'input-balance-resale': () => {
        const original = getNumericValue('input-original-price');
        const resaleClausePercent = getNumericValue('input-resale-clause');
        const amountPaidPercent = getNumericValue('input-amount-paid-percent');
        const amountPaid = getNumericValue('input-amount-paid');

        // Need both values to calculate
        if (!original || !resaleClausePercent) return 0;

        // Calculate what percentage has actually been paid
        // If direct amount provided, convert to percentage
        let effectivePaidPercent = amountPaidPercent;
        if (amountPaid > 0 && original > 0) {
            effectivePaidPercent = (amountPaid / original) * 100;
        }

        // Only pay balance if we haven't met the resale clause yet
        if (effectivePaidPercent < resaleClausePercent) {
            const balancePercent = resaleClausePercent - effectivePaidPercent;
            return Math.round(original * (balancePercent / 100));
        }

        return 0;  // Already paid enough, no balance needed
    },

    /**
     * PREMIUM (u_prem)
     * Profit/markup being added to the original price.
     *
     * FORMULA: Selling Price - Original Price
     *
     * CAN BE NEGATIVE: If selling below original price (distressed sale).
     *
     * EXAMPLE:
     * - Original: AED 2,000,000
     * - Selling: AED 2,500,000
     * - Premium: AED 500,000
     */
    'input-premium-amount': () => {
        const selling = getNumericValue('input-selling-price');
        const original = getNumericValue('input-original-price');
        return selling - original;  // Can be negative
    },

    /**
     * ADGM FEE (u_trans)
     * Abu Dhabi Global Market registration fee.
     *
     * FORMULA: 2% of Original Price
     *
     * WHY ORIGINAL (not Selling):
     * ADGM fee is based on the registered contract value,
     * which is the original developer price, not the resale premium.
     *
     * EXAMPLE:
     * - Original: AED 1,960,000
     * - ADGM: 1,960,000 × 0.02 = AED 39,200
     */
    'input-adgm-transfer': () => {
        const original = getNumericValue('input-original-price');
        return Math.round(original * 0.02);  // 2% of original price
    },

    /**
     * AGENCY FEES (u_broker)
     * Real estate agency commission.
     *
     * FORMULA: (2% of Selling Price) + 5% VAT on that 2%
     * SIMPLIFIED: Selling Price × 0.02 × 1.05 = Selling Price × 0.021
     *
     * WHY SELLING (not Original):
     * Agency earns commission on the transaction value,
     * which is the actual selling price.
     *
     * EXAMPLE:
     * - Selling: AED 2,500,000
     * - Base (2%): 2,500,000 × 0.02 = AED 50,000
     * - VAT (5%): 50,000 × 0.05 = AED 2,500
     * - Total: AED 52,500
     */
    'input-agency-fees': () => {
        const selling = getNumericValue('input-selling-price');
        const base = selling * 0.02;           // 2% agency commission
        return Math.round(base * 1.05);        // Add 5% VAT to the commission
    }
};

/**
 * TRIGGER FIELDS
 *
 * These are the input fields that, when changed, should cause
 * all calculated fields to recalculate.
 *
 * WHY THESE FIELDS:
 * - u_original_price, u_selling_price: Price changes affect Premium, ADGM, Agency Fees
 * - input-internal-area, input-balcony-area: Affect Total Area
 * - u_villa_internal, u_villa_terrace: Affect BUA
 * - u_resale_clause, u_amount_paid_percent, u_amount_paid: Affect Refund and Balance
 */
const triggerFields = [
    'input-original-price',              // Original Price → ADGM, Premium, Refund, Balance
    'input-selling-price',              // Selling Price → Premium, Agency Fees
    'input-internal-area',          // Internal Area → Total Area
    'input-balcony-area',           // Balcony Area → Total Area
    'input-villa-internal',    // Villa Internal → BUA
    'input-villa-terrace',     // Villa Terrace → BUA
    'input-resale-clause',      // Resale Clause % → Balance
    'input-amount-paid-percent', // Amount Paid % → Refund, Balance
    'input-amount-paid'         // Amount Paid AED → Refund, Balance
];

/**
 * ============================================================================
 * calculateField(fieldId)
 * ============================================================================
 *
 * Calculates a single field's value and updates the input element.
 *
 * FLOW:
 * 1. Check if field is locked (user wants manual control) → skip if locked
 * 2. Get the calculation function for this field
 * 3. Run the calculation
 * 4. Update the input element with the result
 *
 * LOCK FEATURE:
 * Users can "lock" a field by clicking the lock icon next to it.
 * When locked, auto-calculation is disabled and user can enter manual value.
 * This is useful when the calculated value doesn't match actual paperwork.
 *
 * @param {string} fieldId - The input element ID (e.g., 'input-total-area', 'input-refund-amount')
 */
export function calculateField(fieldId) {
    // STEP 1: Check if field is locked by user
    // If locked, skip calculation - user wants to enter value manually
    if (isFieldLocked(fieldId)) return;

    // STEP 2: Get calculation function from our calculations object
    const calculator = calculations[fieldId];

    if (calculator) {
        // STEP 3: Run the calculation to get new value
        const value = calculator();

        // STEP 4: Update the input element
        const el = getById(fieldId);  // getById(id) is shorthand for getElementById
        if (el) {
            el.value = value || '';  // Empty string if 0/null/undefined
        }
    }
}

/**
 * ============================================================================
 * runAllCalculations()
 * ============================================================================
 *
 * Recalculates ALL calculated fields, then updates the total.
 *
 * WHEN CALLED:
 * - When any trigger field changes (via input event listener)
 * - When category changes (Off-Plan ↔ Ready)
 * - When page loads (to restore calculated values)
 *
 * ORDER MATTERS:
 * Calculations run in the order defined in the calculations object.
 * Since Premium depends on Selling Price (not other calculated fields),
 * and Refund/Balance are independent, order doesn't matter here.
 * But if we had chained calculations, we'd need to order them correctly.
 */
export function runAllCalculations() {
    // Calculate each field in the calculations object
    Object.keys(calculations).forEach(fieldId => {
        calculateField(fieldId);
    });

    // After all individual calculations, update the total
    calculateTotal();
}

/**
 * ============================================================================
 * calculateTotal()
 * ============================================================================
 *
 * Calculates the Total Initial Payment and updates the display.
 *
 * TWO DIFFERENT FORMULAS based on property category:
 *
 * OFF-PLAN RESALE:
 * Total = Refund + Balance + Premium + Admin + ADGM + ADGM Term + ADGM Elec + Agency
 *
 * WHY: Buyer pays original owner (Refund), developer (Balance),
 *      markup (Premium), and all fees.
 *
 * READY PROPERTY:
 * Total = Selling Price + Admin + ADGM + ADGM Term + ADGM Elec + Agency
 *
 * WHY: Buyer pays full selling price plus fees.
 *      No Refund/Balance/Premium because there's no developer payment split.
 *
 * @returns {number} The calculated total
 */
export function calculateTotal() {
    // Determine which formula to use based on property category
    const category = getCurrentCategory();  // 'offplan' or 'ready'

    // Get fee values (same for both categories)
    const admin = getNumericValue('input-admin-fees');              // Admin Fees (SAAS)
    const adgm = getNumericValue('input-adgm-transfer');             // ADGM 2% fee
    const adgmTermination = getNumericValue('input-adgm-termination-fee');   // ADGM Termination Fee
    const adgmElectronic = getNumericValue('input-adgm-electronic-fee');    // ADGM Electronic Fee
    const agency = getNumericValue('input-agency-fees');          // Agency commission + VAT

    let total;

    if (category === 'ready') {
        // ========================================
        // READY PROPERTY FORMULA
        // ========================================
        // Buyer pays: Full selling price + All fees
        const selling = getNumericValue('input-selling-price');
        total = selling + admin + adgm + adgmTermination + adgmElectronic + agency;
    } else {
        // ========================================
        // OFF-PLAN RESALE FORMULA
        // ========================================
        // Buyer pays: Amount to seller + Amount to developer + Premium + Fees
        const refund = getNumericValue('input-refund-amount');    // Goes to original buyer
        const balance = getNumericValue('input-balance-resale');    // Goes to developer
        const premium = getNumericValue('input-premium-amount');   // Profit for seller
        total = refund + balance + premium + admin + adgm + adgmTermination + adgmElectronic + agency;
    }

    // Update the total display in the input panel
    const totalDisplayEl = getById('display-total-payment');
    if (totalDisplayEl) {
        totalDisplayEl.textContent = formatCurrency(total);  // e.g., "AED 2,500,000"
    }

    return total;
}

/**
 * ============================================================================
 * initCalculator()
 * ============================================================================
 *
 * Initializes the calculator module on page load.
 *
 * SETS UP:
 * 1. Event listeners on trigger fields → recalculate when user types
 * 2. Event listeners on fee fields → update total when fees change
 * 3. Lock button handlers → toggle between auto/manual calculation
 * 4. Initial calculation → populate calculated fields on page load
 */
export function initCalculator() {

    // ========================================
    // 1. TRIGGER FIELD LISTENERS
    // ========================================
    // When user changes these fields, recalculate everything
    triggerFields.forEach(fieldId => {
        const el = getById(fieldId);
        if (el) {
            el.addEventListener('input', () => {
                runAllCalculations();
            });
        }
    });

    // ========================================
    // 2. FEE FIELD LISTENERS
    // ========================================
    // These fields affect total but aren't auto-calculated
    // (user enters them manually)
    ['input-admin-fees', 'input-adgm-termination-fee', 'input-adgm-electronic-fee'].forEach(fieldId => {
        const el = getById(fieldId);
        if (el) {
            el.addEventListener('input', calculateTotal);  // Only update total, not other fields
        }
    });

    // ========================================
    // 3. LOCK BUTTON HANDLERS
    // ========================================
    // Each calculated field has a lock button next to it
    // Clicking toggles between auto-calculation and manual entry
    document.querySelectorAll('.lock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();  // Prevent form submission
            const targetId = btn.dataset.target;  // e.g., data-target="u_paid"
            toggleLock(btn, targetId);
        });
    });

    // Initial calculation
    runAllCalculations();
}

/**
 * Toggle lock state of a field
 * @param {HTMLElement} btn - Lock button element
 * @param {string} fieldId - Field ID
 */
function toggleLock(btn, fieldId) {
    const input = getById(fieldId);
    if (!input) return;

    const isCurrentlyLocked = btn.classList.contains('locked');

    if (isCurrentlyLocked) {
        // Unlock - enable auto-calculation
        btn.classList.remove('locked');
        input.readOnly = true;
        input.classList.add('calculated');

        // Update lock icon to unlocked
        btn.innerHTML = `
            <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
        `;

        // Recalculate
        calculateField(fieldId);
    } else {
        // Lock - allow manual input
        btn.classList.add('locked');
        input.readOnly = false;
        input.classList.remove('calculated');

        // Update lock icon to locked
        btn.innerHTML = `
            <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 019.9-1"/>
            </svg>
        `;

        input.focus();
    }

    // Save lock state
    toggleFieldLock(fieldId);
}

/**
 * Restore lock states from storage
 */
export function restoreLockStates() {
    document.querySelectorAll('.lock-btn').forEach(btn => {
        const targetId = btn.dataset.target;
        if (isFieldLocked(targetId)) {
            const input = getById(targetId);
            btn.classList.add('locked');
            if (input) {
                input.readOnly = false;
                input.classList.remove('calculated');
            }
            btn.innerHTML = `
                <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 019.9-1"/>
                </svg>
            `;
        }
    });
}

// ============================================================================
// PURE CALCULATION FUNCTIONS (for testing)
// ============================================================================
// These are pure functions with no DOM dependencies, exported for unit testing.

/**
 * Calculate total area from internal + balcony
 * @param {number} internal - Internal area in sq ft
 * @param {number} balcony - Balcony area in sq ft
 * @returns {number} Total area
 */
export function calculateTotalArea(internal, balcony) {
    const total = internal + balcony;
    return total > 0 ? total : 0;
}

/**
 * Calculate BUA (Built-Up Area) for villas
 * @param {number} internal - Internal area
 * @param {number} terrace - Terrace area
 * @returns {number} BUA
 */
export function calculateBUA(internal, terrace) {
    const total = internal + terrace;
    return total > 0 ? total : 0;
}

/**
 * Calculate refund amount based on amount paid or percentage
 * @param {number} original - Original price
 * @param {number} amountPaidPercent - Percentage paid
 * @param {number} amountPaid - Direct amount paid (takes priority)
 * @returns {number} Refund amount
 */
export function calculateRefund(original, amountPaidPercent, amountPaid) {
    if (amountPaid > 0) {
        return Math.round(amountPaid);
    }
    if (amountPaidPercent > 0 && original > 0) {
        return Math.round(original * (amountPaidPercent / 100));
    }
    return 0;
}

/**
 * Calculate balance resale clause
 * @param {number} original - Original price
 * @param {number} resaleClausePercent - Required percentage for resale
 * @param {number} amountPaidPercent - Percentage already paid
 * @param {number} amountPaid - Direct amount paid
 * @returns {number} Balance amount
 */
export function calculateBalance(original, resaleClausePercent, amountPaidPercent, amountPaid) {
    if (!original || !resaleClausePercent) return 0;

    let effectivePaidPercent = amountPaidPercent;
    if (amountPaid > 0 && original > 0) {
        effectivePaidPercent = (amountPaid / original) * 100;
    }

    if (effectivePaidPercent < resaleClausePercent) {
        const balancePercent = resaleClausePercent - effectivePaidPercent;
        return Math.round(original * (balancePercent / 100));
    }

    return 0;
}

/**
 * Calculate premium (selling - original)
 * @param {number} selling - Selling price
 * @param {number} original - Original price
 * @returns {number} Premium (can be negative)
 */
export function calculatePremium(selling, original) {
    return selling - original;
}

/**
 * Calculate ADGM fee (2% of original price)
 * @param {number} original - Original price
 * @returns {number} ADGM fee
 */
export function calculateADGM(original) {
    return Math.round(original * 0.02);
}

/**
 * Calculate agency fees (2% + 5% VAT)
 * @param {number} selling - Selling price
 * @returns {number} Agency fees
 */
export function calculateAgencyFees(selling) {
    const base = selling * 0.02;
    return Math.round(base * 1.05);
}

/**
 * Calculate total initial payment for off-plan
 * @param {number} refund - Refund amount
 * @param {number} balance - Balance amount
 * @param {number} premium - Premium amount
 * @param {number} admin - Admin fees
 * @param {number} adgm - ADGM fee
 * @param {number} agency - Agency fees
 * @returns {number} Total
 */
export function calculateTotalOffPlan(refund, balance, premium, admin, adgm, agency) {
    return refund + balance + premium + admin + adgm + agency;
}

/**
 * Calculate total initial payment for ready property
 * @param {number} selling - Selling price
 * @param {number} admin - Admin fees
 * @param {number} adgm - ADGM fee
 * @param {number} agency - Agency fees
 * @returns {number} Total
 */
export function calculateTotalReady(selling, admin, adgm, agency) {
    return selling + admin + adgm + agency;
}
