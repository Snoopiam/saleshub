/**
 * Tests for validator.js validation functions
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePaymentPlan } from '../js/modules/validator.js';

// ============================================================================
// PAYMENT PLAN VALIDATION
// ============================================================================

describe('validatePaymentPlan', () => {
    describe('valid payment plans', () => {
        it('validates 100% total as valid', () => {
            const plan = [
                { milestone: 'Booking', percentage: 20 },
                { milestone: 'SPA', percentage: 30 },
                { milestone: 'Handover', percentage: 50 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
            expect(result.message).toBe('');
        });

        it('handles floating point precision (33.33 + 33.33 + 33.34)', () => {
            const plan = [
                { milestone: 'Phase 1', percentage: 33.33 },
                { milestone: 'Phase 2', percentage: 33.33 },
                { milestone: 'Phase 3', percentage: 33.34 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
        });

        it('accepts values within epsilon of 100%', () => {
            const plan = [
                { milestone: 'A', percentage: 50 },
                { milestone: 'B', percentage: 49.995 }
            ];
            const result = validatePaymentPlan(plan);
            // 99.995 is within 0.01 of 100, so should be valid
            expect(result.valid).toBe(true);
        });
    });

    describe('empty and null plans', () => {
        it('treats empty array as valid', () => {
            const result = validatePaymentPlan([]);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(0);
        });

        it('handles null gracefully', () => {
            const result = validatePaymentPlan(null);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(0);
        });

        it('handles undefined gracefully', () => {
            const result = validatePaymentPlan(undefined);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(0);
        });
    });

    describe('under 100% plans', () => {
        it('marks under 100% as invalid', () => {
            const plan = [
                { milestone: 'Booking', percentage: 20 },
                { milestone: 'SPA', percentage: 30 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(false);
            expect(result.totalPercent).toBe(50);
            expect(result.message).toContain('50%');
            expect(result.message).toContain('remaining');
        });

        it('calculates remaining percentage correctly', () => {
            const plan = [{ milestone: 'Only', percentage: 75 }];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(false);
            expect(result.message).toContain('25%');
        });
    });

    describe('over 100% plans', () => {
        it('marks over 100% as invalid', () => {
            const plan = [
                { milestone: 'Booking', percentage: 50 },
                { milestone: 'SPA', percentage: 60 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(false);
            expect(result.totalPercent).toBe(110);
            expect(result.message).toContain('exceeds');
        });

        it('detects slight overage', () => {
            const plan = [
                { milestone: 'A', percentage: 50 },
                { milestone: 'B', percentage: 50.02 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(false);
            expect(result.message).toContain('exceeds');
        });
    });

    describe('edge cases', () => {
        it('handles string percentages', () => {
            const plan = [
                { milestone: 'A', percentage: '50' },
                { milestone: 'B', percentage: '50' }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
        });

        it('handles missing percentage as 0', () => {
            const plan = [
                { milestone: 'A', percentage: 100 },
                { milestone: 'B' } // missing percentage
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
        });

        it('handles single 100% milestone', () => {
            const plan = [{ milestone: 'Full Payment', percentage: 100 }];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
        });

        it('handles many small milestones', () => {
            const plan = Array.from({ length: 10 }, (_, i) => ({
                milestone: `Phase ${i + 1}`,
                percentage: 10
            }));
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
        });

        it('rounds display total to 2 decimal places', () => {
            const plan = [
                { milestone: 'A', percentage: 33.333 },
                { milestone: 'B', percentage: 33.333 },
                { milestone: 'C', percentage: 33.334 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.totalPercent).toBe(100);
        });
    });

    describe('real-world scenarios', () => {
        it('validates typical off-plan payment plan', () => {
            const plan = [
                { milestone: 'Booking', percentage: 10 },
                { milestone: 'Within 30 days', percentage: 10 },
                { milestone: 'On construction 30%', percentage: 10 },
                { milestone: 'On construction 50%', percentage: 10 },
                { milestone: 'On construction 70%', percentage: 10 },
                { milestone: 'On handover', percentage: 50 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
            expect(result.totalPercent).toBe(100);
        });

        it('validates post-handover payment plan', () => {
            const plan = [
                { milestone: 'Booking', percentage: 5 },
                { milestone: 'SPA', percentage: 15 },
                { milestone: 'Handover', percentage: 40 },
                { milestone: 'Post-handover 1 year', percentage: 20 },
                { milestone: 'Post-handover 2 years', percentage: 20 }
            ];
            const result = validatePaymentPlan(plan);
            expect(result.valid).toBe(true);
        });
    });
});

// ============================================================================
// FIELD VALIDATION (requires DOM mocking)
// ============================================================================

describe('field validation integration', () => {
    // These tests would require DOM mocking which is more complex
    // For now, we test the pure validation logic above

    it('payment plan validation is pure function', () => {
        // Verify validatePaymentPlan doesn't require DOM
        const result = validatePaymentPlan([{ percentage: 100 }]);
        expect(result.valid).toBe(true);
    });
});
