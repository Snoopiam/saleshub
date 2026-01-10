/**
 * Validator Module
 * Form validation and error display
 */

import { getById, queryAll } from '../utils/helpers.js';

// Validation rules
const validationRules = {
    'input-project-name': {
        required: true,
        message: 'Project name is required'
    },
    u_original_price: {
        required: true,
        min: 0,
        message: 'Original price must be a positive number'
    },
    u_selling_price: {
        required: true,
        min: 0,
        message: 'Selling price must be a positive number'
    }
};

/**
 * Validate a single field
 * @param {string} fieldId - Field ID
 * @returns {Object} { valid: boolean, message: string }
 */
export function validateField(fieldId) {
    const rules = validationRules[fieldId];
    if (!rules) return { valid: true };

    const el = getById(fieldId);
    if (!el) return { valid: true };

    const value = el.value.trim();

    // Required check
    if (rules.required && !value) {
        return { valid: false, message: rules.message || 'This field is required' };
    }

    // Numeric checks
    if (rules.min !== undefined) {
        const num = parseFloat(value);
        if (isNaN(num) || num < rules.min) {
            return { valid: false, message: rules.message };
        }
    }

    if (rules.max !== undefined) {
        const num = parseFloat(value);
        if (isNaN(num) || num > rules.max) {
            return { valid: false, message: rules.message };
        }
    }

    return { valid: true };
}

/**
 * Validate all fields
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateAll() {
    const errors = [];

    Object.keys(validationRules).forEach(fieldId => {
        const result = validateField(fieldId);
        if (!result.valid) {
            errors.push({ fieldId, message: result.message });
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Show validation error on a field
 * @param {string} fieldId - Field ID
 * @param {string} message - Error message
 */
export function showFieldError(fieldId, message) {
    const el = getById(fieldId);
    if (!el) return;

    el.classList.add('error');

    // Remove existing error message
    const existingError = el.parentElement.querySelector('.field-error');
    if (existingError) existingError.remove();

    // Add error message
    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    errorEl.style.cssText = 'color: #ef4444; font-size: 10px; display: block; margin-top: 2px;';
    el.parentElement.appendChild(errorEl);
}

/**
 * Clear validation error from a field
 * @param {string} fieldId - Field ID
 */
export function clearFieldError(fieldId) {
    const el = getById(fieldId);
    if (!el) return;

    el.classList.remove('error');

    const existingError = el.parentElement.querySelector('.field-error');
    if (existingError) existingError.remove();
}

/**
 * Clear all validation errors
 */
export function clearAllErrors() {
    queryAll('.input-field.error').forEach(el => {
        el.classList.remove('error');
    });
    queryAll('.field-error').forEach(el => {
        el.remove();
    });
}

/**
 * Validate payment plan
 * Uses epsilon comparison to handle floating point precision issues
 * e.g., 33.33 + 33.33 + 33.34 should equal 100
 * @param {Array} paymentPlan - Payment plan rows
 * @returns {Object} { valid: boolean, totalPercent: number, message: string }
 */
export function validatePaymentPlan(paymentPlan) {
    if (!paymentPlan || paymentPlan.length === 0) {
        return { valid: true, totalPercent: 0, message: '' };
    }

    let totalPercent = 0;

    paymentPlan.forEach(row => {
        const percent = parseFloat(row.percentage) || 0;
        totalPercent += percent;
    });

    // Round to 2 decimal places for display
    const displayTotal = Math.round(totalPercent * 100) / 100;

    // Use epsilon comparison to handle floating point issues
    // Tolerance of 0.01% to account for values like 33.33 + 33.33 + 33.34
    const EPSILON = 0.01;
    const isValid = Math.abs(totalPercent - 100) < EPSILON;
    const isOver = totalPercent > 100 + EPSILON;

    if (isValid) {
        return { valid: true, totalPercent: displayTotal, message: '' };
    } else if (isOver) {
        return {
            valid: false,
            totalPercent: displayTotal,
            message: `Total exceeds 100% (${displayTotal}%)`
        };
    } else {
        const remaining = Math.round((100 - displayTotal) * 100) / 100;
        return {
            valid: false,
            totalPercent: displayTotal,
            message: `Total is ${displayTotal}% (${remaining}% remaining)`
        };
    }
}

/**
 * Update payment validation display
 * @param {Object} validation - Validation result
 */
export function updatePaymentValidation(validation) {
    const percentTotal = getById('paymentPercentTotal');
    const validationMsg = getById('paymentValidation');

    if (percentTotal) {
        percentTotal.textContent = `${validation.totalPercent}%`;
    }

    if (validationMsg) {
        if (validation.valid) {
            validationMsg.textContent = '';
            validationMsg.classList.remove('error');
            validationMsg.classList.add('success');
        } else {
            validationMsg.textContent = validation.message;
            validationMsg.classList.add('error');
            validationMsg.classList.remove('success');
        }
    }
}

/**
 * Initialize validator - set up real-time validation
 */
export function initValidator() {
    // Add blur validation to required fields
    Object.keys(validationRules).forEach(fieldId => {
        const el = getById(fieldId);
        if (el) {
            el.addEventListener('blur', () => {
                const result = validateField(fieldId);
                if (!result.valid) {
                    showFieldError(fieldId, result.message);
                } else {
                    clearFieldError(fieldId);
                }
            });

            // Clear error on input
            el.addEventListener('input', () => {
                clearFieldError(fieldId);
            });
        }
    });
}
