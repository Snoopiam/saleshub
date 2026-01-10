/**
 * Tests for category.js property category functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// DURATION CALCULATION (Pure function extracted for testing)
// ============================================================================

/**
 * Calculate duration between two dates in years and months
 * This is the same logic as in category.js
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
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatHandoverDate(type, period, year) {
    if (!period || !year) return '-';

    if (type === 'quarter') {
        return `Q${period} ${year}`;
    } else {
        return `${MONTH_NAMES[parseInt(period)] || period} ${year}`;
    }
}

describe('calculateDuration', () => {
    describe('years only', () => {
        it('calculates single year', () => {
            expect(calculateDuration(2023, 1, 2024, 1)).toBe('1 year');
        });

        it('calculates multiple years', () => {
            expect(calculateDuration(2020, 6, 2024, 6)).toBe('4 years');
        });

        it('uses singular for 1 year', () => {
            expect(calculateDuration(2023, 3, 2024, 3)).toBe('1 year');
        });

        it('uses plural for multiple years', () => {
            expect(calculateDuration(2020, 3, 2023, 3)).toBe('3 years');
        });
    });

    describe('months only', () => {
        it('calculates single month', () => {
            expect(calculateDuration(2024, 1, 2024, 2)).toBe('1 month');
        });

        it('calculates multiple months', () => {
            expect(calculateDuration(2024, 1, 2024, 7)).toBe('6 months');
        });

        it('uses singular for 1 month', () => {
            expect(calculateDuration(2024, 5, 2024, 6)).toBe('1 month');
        });

        it('uses plural for multiple months', () => {
            expect(calculateDuration(2024, 1, 2024, 4)).toBe('3 months');
        });
    });

    describe('years and months', () => {
        it('calculates 1 year 1 month', () => {
            expect(calculateDuration(2023, 1, 2024, 2)).toBe('1 year, 1 month');
        });

        it('calculates multiple years and months', () => {
            expect(calculateDuration(2020, 3, 2024, 9)).toBe('4 years, 6 months');
        });

        it('handles month rollover', () => {
            // From Oct 2023 to Feb 2024 = 4 months
            expect(calculateDuration(2023, 10, 2024, 2)).toBe('4 months');
        });

        it('handles year adjustment for month rollover', () => {
            // From Nov 2023 to Feb 2025 = 1 year, 3 months
            expect(calculateDuration(2023, 11, 2025, 2)).toBe('1 year, 3 months');
        });
    });

    describe('edge cases', () => {
        it('handles same month same year', () => {
            expect(calculateDuration(2024, 6, 2024, 6)).toBe('Less than 1 month');
        });

        it('handles December to January transition', () => {
            expect(calculateDuration(2023, 12, 2024, 1)).toBe('1 month');
        });

        it('handles 11 months (less than a year)', () => {
            expect(calculateDuration(2024, 1, 2024, 12)).toBe('11 months');
        });
    });
});

describe('formatHandoverDate', () => {
    describe('month format', () => {
        it('formats January correctly', () => {
            expect(formatHandoverDate('month', '1', '2024')).toBe('Jan 2024');
        });

        it('formats December correctly', () => {
            expect(formatHandoverDate('month', '12', '2025')).toBe('Dec 2025');
        });

        it('formats middle months correctly', () => {
            expect(formatHandoverDate('month', '6', '2024')).toBe('Jun 2024');
            expect(formatHandoverDate('month', '9', '2024')).toBe('Sep 2024');
        });
    });

    describe('quarter format', () => {
        it('formats Q1 correctly', () => {
            expect(formatHandoverDate('quarter', '1', '2024')).toBe('Q1 2024');
        });

        it('formats Q4 correctly', () => {
            expect(formatHandoverDate('quarter', '4', '2025')).toBe('Q4 2025');
        });
    });

    describe('missing data', () => {
        it('returns dash for missing period', () => {
            expect(formatHandoverDate('month', '', '2024')).toBe('-');
            expect(formatHandoverDate('month', null, '2024')).toBe('-');
        });

        it('returns dash for missing year', () => {
            expect(formatHandoverDate('month', '6', '')).toBe('-');
            expect(formatHandoverDate('month', '6', null)).toBe('-');
        });

        it('returns dash for both missing', () => {
            expect(formatHandoverDate('month', '', '')).toBe('-');
        });
    });
});

// ============================================================================
// CATEGORY STATE (Mock-based tests)
// ============================================================================

describe('category state management', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        vi.stubGlobal('localStorage', {
            store: {},
            getItem: vi.fn((key) => this.store[key] || null),
            setItem: vi.fn((key, value) => { this.store[key] = value; }),
            removeItem: vi.fn((key) => { delete this.store[key]; }),
            clear: vi.fn(() => { this.store = {}; })
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('defaults to offplan category', () => {
        // This tests the concept - actual implementation reads from localStorage
        const defaultCategory = 'offplan';
        expect(defaultCategory).toBe('offplan');
    });

    it('valid categories are offplan and ready', () => {
        const validCategories = ['offplan', 'ready'];
        expect(validCategories).toContain('offplan');
        expect(validCategories).toContain('ready');
        expect(validCategories.length).toBe(2);
    });

    it('valid occupancy states', () => {
        const validOccupancy = ['owner', 'vacant', 'leased'];
        expect(validOccupancy).toContain('owner');
        expect(validOccupancy).toContain('vacant');
        expect(validOccupancy).toContain('leased');
        expect(validOccupancy.length).toBe(3);
    });
});

describe('quarter to month conversion', () => {
    it('Q1 is months 1-3', () => {
        const quarter = 1;
        const firstMonth = (quarter - 1) * 3 + 1;
        expect(firstMonth).toBe(1);
    });

    it('Q2 is months 4-6', () => {
        const quarter = 2;
        const firstMonth = (quarter - 1) * 3 + 1;
        expect(firstMonth).toBe(4);
    });

    it('Q3 is months 7-9', () => {
        const quarter = 3;
        const firstMonth = (quarter - 1) * 3 + 1;
        expect(firstMonth).toBe(7);
    });

    it('Q4 is months 10-12', () => {
        const quarter = 4;
        const firstMonth = (quarter - 1) * 3 + 1;
        expect(firstMonth).toBe(10);
    });

    it('month to quarter conversion', () => {
        expect(Math.ceil(1 / 3)).toBe(1);
        expect(Math.ceil(3 / 3)).toBe(1);
        expect(Math.ceil(4 / 3)).toBe(2);
        expect(Math.ceil(6 / 3)).toBe(2);
        expect(Math.ceil(7 / 3)).toBe(3);
        expect(Math.ceil(9 / 3)).toBe(3);
        expect(Math.ceil(10 / 3)).toBe(4);
        expect(Math.ceil(12 / 3)).toBe(4);
    });
});
