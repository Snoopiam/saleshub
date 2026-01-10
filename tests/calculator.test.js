/**
 * Tests for calculator.js calculation functions
 */
import { describe, it, expect } from 'vitest';
import {
    calculateTotalArea,
    calculateBUA,
    calculateRefund,
    calculateBalance,
    calculatePremium,
    calculateADGM,
    calculateAgencyFees,
    calculateTotalOffPlan,
    calculateTotalReady
} from '../js/modules/calculator.js';

// ============================================================================
// AREA CALCULATIONS
// ============================================================================

describe('calculateTotalArea', () => {
    it('adds internal and balcony areas', () => {
        expect(calculateTotalArea(918.38, 173.94)).toBe(1092.32);
        expect(calculateTotalArea(1000, 200)).toBe(1200);
    });

    it('handles zero values', () => {
        expect(calculateTotalArea(0, 0)).toBe(0);
        expect(calculateTotalArea(500, 0)).toBe(500);
        expect(calculateTotalArea(0, 200)).toBe(200);
    });

    it('returns 0 for negative totals', () => {
        expect(calculateTotalArea(-100, 50)).toBe(0);
    });

    it('handles decimal precision', () => {
        expect(calculateTotalArea(100.5, 50.25)).toBe(150.75);
    });
});

describe('calculateBUA', () => {
    it('adds internal and terrace areas', () => {
        expect(calculateBUA(2000, 500)).toBe(2500);
        expect(calculateBUA(1500, 300)).toBe(1800);
    });

    it('handles zero values', () => {
        expect(calculateBUA(0, 0)).toBe(0);
        expect(calculateBUA(1000, 0)).toBe(1000);
        expect(calculateBUA(0, 500)).toBe(500);
    });

    it('returns 0 for negative totals', () => {
        expect(calculateBUA(-500, 200)).toBe(0);
    });
});

// ============================================================================
// FINANCIAL CALCULATIONS - REFUND
// ============================================================================

describe('calculateRefund', () => {
    it('returns direct amount paid when provided', () => {
        expect(calculateRefund(2000000, 20, 400000)).toBe(400000);
        expect(calculateRefund(2000000, 30, 500000)).toBe(500000);
    });

    it('calculates from percentage when no direct amount', () => {
        // 20% of 2,000,000 = 400,000
        expect(calculateRefund(2000000, 20, 0)).toBe(400000);
        // 40% of 1,960,000 = 784,000
        expect(calculateRefund(1960000, 40, 0)).toBe(784000);
    });

    it('prioritizes direct amount over percentage', () => {
        // Even though percentage says 20% = 400,000, direct amount wins
        expect(calculateRefund(2000000, 20, 300000)).toBe(300000);
    });

    it('returns 0 when no data provided', () => {
        expect(calculateRefund(0, 0, 0)).toBe(0);
        expect(calculateRefund(2000000, 0, 0)).toBe(0);
    });

    it('rounds to whole numbers', () => {
        expect(calculateRefund(1000000, 33, 0)).toBe(330000);
        expect(calculateRefund(1000000, 33.33, 0)).toBe(333300);
    });
});

// ============================================================================
// FINANCIAL CALCULATIONS - BALANCE RESALE
// ============================================================================

describe('calculateBalance', () => {
    it('calculates balance when paid less than resale clause', () => {
        // Resale clause 40%, paid 20%, balance = 20% of 2,000,000 = 400,000
        expect(calculateBalance(2000000, 40, 20, 0)).toBe(400000);
        // Resale clause 50%, paid 30%, balance = 20% of 1,000,000 = 200,000
        expect(calculateBalance(1000000, 50, 30, 0)).toBe(200000);
    });

    it('returns 0 when paid equals resale clause', () => {
        expect(calculateBalance(2000000, 40, 40, 0)).toBe(0);
    });

    it('returns 0 when paid exceeds resale clause', () => {
        expect(calculateBalance(2000000, 40, 50, 0)).toBe(0);
        expect(calculateBalance(2000000, 40, 100, 0)).toBe(0);
    });

    it('calculates effective percentage from direct amount', () => {
        // Direct amount 400,000 on 2,000,000 = 20%
        // Resale clause 40%, balance = 20% of 2,000,000 = 400,000
        expect(calculateBalance(2000000, 40, 0, 400000)).toBe(400000);
    });

    it('returns 0 when missing required data', () => {
        expect(calculateBalance(0, 40, 20, 0)).toBe(0);
        expect(calculateBalance(2000000, 0, 20, 0)).toBe(0);
    });

    it('rounds to whole numbers', () => {
        expect(calculateBalance(1000000, 40, 25, 0)).toBe(150000);
    });
});

// ============================================================================
// FINANCIAL CALCULATIONS - PREMIUM
// ============================================================================

describe('calculatePremium', () => {
    it('calculates difference between selling and original', () => {
        expect(calculatePremium(2500000, 2000000)).toBe(500000);
        expect(calculatePremium(3000000, 2000000)).toBe(1000000);
    });

    it('returns 0 when prices are equal', () => {
        expect(calculatePremium(2000000, 2000000)).toBe(0);
    });

    it('returns negative for distressed sales', () => {
        expect(calculatePremium(1800000, 2000000)).toBe(-200000);
    });

    it('handles zero values', () => {
        expect(calculatePremium(0, 0)).toBe(0);
        expect(calculatePremium(1000000, 0)).toBe(1000000);
        expect(calculatePremium(0, 1000000)).toBe(-1000000);
    });
});

// ============================================================================
// FINANCIAL CALCULATIONS - FEES
// ============================================================================

describe('calculateADGM', () => {
    it('calculates 2% of original price', () => {
        expect(calculateADGM(1960000)).toBe(39200);
        expect(calculateADGM(2000000)).toBe(40000);
        expect(calculateADGM(1000000)).toBe(20000);
    });

    it('handles zero', () => {
        expect(calculateADGM(0)).toBe(0);
    });

    it('rounds to whole numbers', () => {
        expect(calculateADGM(1234567)).toBe(24691);
    });
});

describe('calculateAgencyFees', () => {
    it('calculates 2% plus 5% VAT', () => {
        // 2% of 2,500,000 = 50,000
        // 5% VAT on 50,000 = 2,500
        // Total = 52,500
        expect(calculateAgencyFees(2500000)).toBe(52500);
    });

    it('equals 2.1% of selling price', () => {
        // 2% × 1.05 = 2.1%
        expect(calculateAgencyFees(1000000)).toBe(21000);
        expect(calculateAgencyFees(2000000)).toBe(42000);
    });

    it('handles zero', () => {
        expect(calculateAgencyFees(0)).toBe(0);
    });

    it('rounds to whole numbers', () => {
        expect(calculateAgencyFees(1234567)).toBe(25926);
    });
});

// ============================================================================
// TOTAL CALCULATIONS
// ============================================================================

describe('calculateTotalOffPlan', () => {
    it('sums all off-plan components', () => {
        // Refund + Balance + Premium + Admin + ADGM + Agency
        expect(calculateTotalOffPlan(400000, 200000, 500000, 10000, 40000, 52500)).toBe(1202500);
    });

    it('handles zeros', () => {
        expect(calculateTotalOffPlan(0, 0, 0, 0, 0, 0)).toBe(0);
    });

    it('handles negative premium', () => {
        expect(calculateTotalOffPlan(400000, 200000, -100000, 10000, 40000, 52500)).toBe(602500);
    });

    it('calculates real-world example', () => {
        // Realistic scenario:
        // - Original: 1,960,000
        // - Selling: 2,500,000
        // - 40% resale clause, 20% paid
        // - Refund: 392,000 (20%)
        // - Balance: 392,000 (additional 20%)
        // - Premium: 540,000
        // - Admin: 10,000
        // - ADGM: 39,200
        // - Agency: 52,500
        const total = calculateTotalOffPlan(392000, 392000, 540000, 10000, 39200, 52500);
        expect(total).toBe(1425700);
    });
});

describe('calculateTotalReady', () => {
    it('sums selling price plus fees', () => {
        // Selling + Admin + ADGM + Agency
        expect(calculateTotalReady(2500000, 10000, 40000, 52500)).toBe(2602500);
    });

    it('handles zeros', () => {
        expect(calculateTotalReady(0, 0, 0, 0)).toBe(0);
    });

    it('calculates real-world example', () => {
        // Ready property:
        // - Selling: 2,000,000
        // - Admin: 5,000
        // - ADGM: 40,000
        // - Agency: 42,000
        const total = calculateTotalReady(2000000, 5000, 40000, 42000);
        expect(total).toBe(2087000);
    });
});

// ============================================================================
// EDGE CASES & INTEGRATION
// ============================================================================

describe('calculation integration', () => {
    it('calculates complete off-plan scenario', () => {
        const original = 1960000;
        const selling = 2500000;
        const paidPercent = 20;
        const resaleClause = 40;

        const refund = calculateRefund(original, paidPercent, 0);
        const balance = calculateBalance(original, resaleClause, paidPercent, 0);
        const premium = calculatePremium(selling, original);
        const adgm = calculateADGM(original);
        const agency = calculateAgencyFees(selling);
        const admin = 10000;

        expect(refund).toBe(392000);
        expect(balance).toBe(392000);
        expect(premium).toBe(540000);
        expect(adgm).toBe(39200);
        expect(agency).toBe(52500);

        const total = calculateTotalOffPlan(refund, balance, premium, admin, adgm, agency);
        expect(total).toBe(1425700);
    });

    it('calculates complete ready property scenario', () => {
        const selling = 2000000;
        const admin = 5000;
        const adgm = calculateADGM(selling);
        const agency = calculateAgencyFees(selling);

        expect(adgm).toBe(40000);
        expect(agency).toBe(42000);

        const total = calculateTotalReady(selling, admin, adgm, agency);
        expect(total).toBe(2087000);
    });
});

describe('boundary conditions', () => {
    it('handles very large numbers', () => {
        expect(calculatePremium(100000000, 50000000)).toBe(50000000);
        expect(calculateADGM(100000000)).toBe(2000000);
    });

    it('handles small numbers', () => {
        expect(calculatePremium(100, 50)).toBe(50);
        expect(calculateADGM(100)).toBe(2);
    });

    it('handles fractional percentages', () => {
        expect(calculateRefund(1000000, 33.33, 0)).toBe(333300);
        expect(calculateBalance(1000000, 40.5, 20.25, 0)).toBe(202500);
    });
});
