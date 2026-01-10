/**
 * Tests for helpers.js utility functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatCurrency,
    formatNumber,
    parseCurrency,
    generateId,
    debounce,
    formatDate,
    excelDateToJS,
    escapeHtml,
    sanitizeInput,
    checkFileSize
} from '../js/utils/helpers.js';

// ============================================================================
// CURRENCY & NUMBER FORMATTING
// ============================================================================

describe('formatCurrency', () => {
    it('formats positive numbers correctly', () => {
        expect(formatCurrency(2500000)).toBe('AED 2,500,000');
        expect(formatCurrency(1234567)).toBe('AED 1,234,567');
        expect(formatCurrency(100)).toBe('AED 100');
    });

    it('formats string numbers correctly', () => {
        expect(formatCurrency('2500000')).toBe('AED 2,500,000');
        expect(formatCurrency('1234567.89')).toBe('AED 1,234,568');
    });

    it('handles zero correctly', () => {
        expect(formatCurrency(0)).toBe('AED 0');
    });

    it('handles null/undefined/empty', () => {
        expect(formatCurrency(null)).toBe('AED 0');
        expect(formatCurrency(undefined)).toBe('AED 0');
        expect(formatCurrency('')).toBe('AED 0');
    });

    it('handles non-numeric strings', () => {
        expect(formatCurrency('abc')).toBe('AED 0');
        expect(formatCurrency('not a number')).toBe('AED 0');
    });

    it('handles negative numbers', () => {
        expect(formatCurrency(-500000)).toBe('AED -500,000');
    });

    it('rounds decimal values', () => {
        expect(formatCurrency(1234.56)).toBe('AED 1,235');
        expect(formatCurrency(1234.49)).toBe('AED 1,234');
    });
});

describe('formatNumber', () => {
    it('formats with default 2 decimal places', () => {
        expect(formatNumber(1092.3)).toBe('1,092.30');
        expect(formatNumber(1000)).toBe('1,000.00');
    });

    it('formats with custom decimal places', () => {
        expect(formatNumber(123.456, 1)).toBe('123.5');
        expect(formatNumber(1000, 0)).toBe('1,000');
        expect(formatNumber(123.456789, 4)).toBe('123.4568');
    });

    it('handles zero correctly', () => {
        expect(formatNumber(0)).toBe('0.00');
        expect(formatNumber(0, 0)).toBe('0');
    });

    it('handles null/undefined/empty', () => {
        expect(formatNumber(null)).toBe('0');
        expect(formatNumber(undefined)).toBe('0');
        expect(formatNumber('')).toBe('0');
    });

    it('handles string numbers', () => {
        expect(formatNumber('1234.5')).toBe('1,234.50');
    });

    it('handles non-numeric strings', () => {
        expect(formatNumber('abc')).toBe('0');
    });
});

describe('parseCurrency', () => {
    it('parses AED formatted strings', () => {
        expect(parseCurrency('AED 2,500,000')).toBe(2500000);
        expect(parseCurrency('AED 1,234,567')).toBe(1234567);
    });

    it('parses plain formatted numbers', () => {
        expect(parseCurrency('2,500,000')).toBe(2500000);
        expect(parseCurrency('1,234.56')).toBe(1234.56);
    });

    it('parses numbers without formatting', () => {
        expect(parseCurrency('2500000')).toBe(2500000);
        expect(parseCurrency('AED2500000')).toBe(2500000);
    });

    it('handles empty/null', () => {
        expect(parseCurrency('')).toBe(0);
        expect(parseCurrency(null)).toBe(0);
        expect(parseCurrency(undefined)).toBe(0);
    });

    it('handles negative numbers', () => {
        expect(parseCurrency('-500,000')).toBe(-500000);
        expect(parseCurrency('AED -100')).toBe(-100);
    });

    it('handles numbers passed directly', () => {
        expect(parseCurrency(12345)).toBe(12345);
    });
});

// ============================================================================
// GENERAL UTILITIES
// ============================================================================

describe('generateId', () => {
    it('generates unique IDs', () => {
        const id1 = generateId();
        const id2 = generateId();
        const id3 = generateId();

        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
        expect(id1).not.toBe(id3);
    });

    it('generates string IDs', () => {
        const id = generateId();
        expect(typeof id).toBe('string');
    });

    it('generates non-empty IDs', () => {
        const id = generateId();
        expect(id.length).toBeGreaterThan(0);
    });

    it('generates IDs with alphanumeric characters', () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+$/);
    });
});

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('delays function execution', () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn();
        expect(mockFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('cancels previous call when called again', () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn();
        vi.advanceTimersByTime(100);
        debouncedFn();
        vi.advanceTimersByTime(100);
        debouncedFn();
        vi.advanceTimersByTime(300);

        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn('arg1', 'arg2');
        vi.advanceTimersByTime(300);

        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('uses default wait time of 300ms', () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn);

        debouncedFn();
        vi.advanceTimersByTime(299);
        expect(mockFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});

// ============================================================================
// DATE UTILITIES
// ============================================================================

describe('formatDate', () => {
    it('formats Date objects correctly', () => {
        const date = new Date(2024, 0, 15); // Jan 15, 2024
        expect(formatDate(date)).toBe('15 Jan 2024');
    });

    it('formats date strings correctly', () => {
        expect(formatDate('2024-06-15')).toBe('15 Jun 2024');
        expect(formatDate('2024-12-31')).toBe('31 Dec 2024');
    });

    it('handles empty/null', () => {
        expect(formatDate(null)).toBe('');
        expect(formatDate(undefined)).toBe('');
        expect(formatDate('')).toBe('');
    });

    it('handles invalid dates', () => {
        expect(formatDate('invalid')).toBe('invalid');
    });

    it('pads single digit days', () => {
        const date = new Date(2024, 0, 5);
        expect(formatDate(date)).toBe('05 Jan 2024');
    });
});

describe('excelDateToJS', () => {
    it('converts Excel serial dates correctly', () => {
        // Jan 1, 2024 is Excel serial 45292
        const date = excelDateToJS(45292);
        expect(date.getFullYear()).toBe(2024);
        expect(date.getMonth()).toBe(0); // January
        expect(date.getDate()).toBe(1);
    });

    it('handles Unix epoch correctly', () => {
        // Jan 1, 1970 is Excel serial 25569
        const date = excelDateToJS(25569);
        expect(date.getFullYear()).toBe(1970);
        expect(date.getMonth()).toBe(0);
        expect(date.getDate()).toBe(1);
    });
});

// ============================================================================
// SECURITY - INPUT SANITIZATION
// ============================================================================

describe('escapeHtml', () => {
    it('escapes angle brackets', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes ampersands', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('preserves quotes (not needed in HTML content)', () => {
        // Note: The DOM-based escapeHtml doesn't escape quotes because
        // quotes only need escaping in HTML attributes, not content
        expect(escapeHtml('"quoted"')).toBe('"quoted"');
    });

    it('handles empty/null', () => {
        expect(escapeHtml('')).toBe('');
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('leaves safe strings unchanged', () => {
        expect(escapeHtml('Hello World')).toBe('Hello World');
        expect(escapeHtml('123 ABC')).toBe('123 ABC');
    });

    it('escapes XSS attempts', () => {
        const xss = '<script>alert("XSS")</script>';
        const escaped = escapeHtml(xss);
        expect(escaped).not.toContain('<script>');
        expect(escaped).toContain('&lt;script&gt;');
    });
});

describe('sanitizeInput', () => {
    it('removes angle brackets', () => {
        expect(sanitizeInput('<script>alert()</script>')).toBe('scriptalert()/script');
    });

    it('removes javascript: protocol', () => {
        expect(sanitizeInput('javascript:alert()')).toBe('alert()');
    });

    it('removes event handlers', () => {
        expect(sanitizeInput('onclick=evil()')).toBe('evil()');
        expect(sanitizeInput('onerror=hack()')).toBe('hack()');
        expect(sanitizeInput('onload=bad()')).toBe('bad()');
    });

    it('handles empty/null', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
    });

    it('trims whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('leaves safe input unchanged', () => {
        expect(sanitizeInput('Hello World')).toBe('Hello World');
        expect(sanitizeInput('Unit 101')).toBe('Unit 101');
    });
});

// ============================================================================
// FILE VALIDATION
// ============================================================================

describe('checkFileSize', () => {
    it('returns true for files under limit', () => {
        const file = { size: 1024 * 1024 }; // 1MB
        expect(checkFileSize(file, 5)).toBe(true);
    });

    it('returns true for files exactly at limit', () => {
        const file = { size: 5 * 1024 * 1024 }; // 5MB
        expect(checkFileSize(file, 5)).toBe(true);
    });

    it('returns false for files over limit', () => {
        const file = { size: 6 * 1024 * 1024 }; // 6MB
        expect(checkFileSize(file, 5)).toBe(false);
    });

    it('uses default 50MB limit', () => {
        const file = { size: 49 * 1024 * 1024 };
        expect(checkFileSize(file)).toBe(true);

        const largeFile = { size: 51 * 1024 * 1024 };
        expect(checkFileSize(largeFile)).toBe(false);
    });
});
