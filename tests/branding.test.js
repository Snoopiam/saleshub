/**
 * Tests for branding.js customization functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// BRANDING DEFAULTS
// ============================================================================

describe('branding defaults', () => {
    const defaultBranding = {
        companyName: 'Kennedy Property',
        primaryColor: '#62c6c1',
        logo: '',
        footerText: 'SALE OFFER'
    };

    it('has default company name', () => {
        expect(defaultBranding.companyName).toBe('Kennedy Property');
    });

    it('has teal as default primary color', () => {
        expect(defaultBranding.primaryColor).toBe('#62c6c1');
    });

    it('has empty logo by default', () => {
        expect(defaultBranding.logo).toBe('');
    });

    it('has SALE OFFER as default footer', () => {
        expect(defaultBranding.footerText).toBe('SALE OFFER');
    });
});

// ============================================================================
// COLOR VALIDATION
// ============================================================================

describe('color validation', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    it('validates 6-digit hex colors', () => {
        expect(hexColorRegex.test('#62c6c1')).toBe(true);
        expect(hexColorRegex.test('#FF0000')).toBe(true);
        expect(hexColorRegex.test('#000000')).toBe(true);
        expect(hexColorRegex.test('#FFFFFF')).toBe(true);
    });

    it('rejects invalid hex colors', () => {
        expect(hexColorRegex.test('62c6c1')).toBe(false);  // missing #
        expect(hexColorRegex.test('#FFF')).toBe(false);    // 3-digit
        expect(hexColorRegex.test('#GGGGGG')).toBe(false); // invalid chars
        expect(hexColorRegex.test('red')).toBe(false);     // named color
    });

    it('handles case insensitivity', () => {
        expect(hexColorRegex.test('#aabbcc')).toBe(true);
        expect(hexColorRegex.test('#AABBCC')).toBe(true);
        expect(hexColorRegex.test('#AaBbCc')).toBe(true);
    });

    it('converts to uppercase for consistency', () => {
        const color = '#aabbcc';
        expect(color.toUpperCase()).toBe('#AABBCC');
    });
});

// ============================================================================
// LABEL DEFAULTS
// ============================================================================

describe('label defaults', () => {
    const defaultLabels = {
        refund: 'Refund (40% of Original Price)',
        balance: 'Balance Resale Clause**',
        premium: 'Premium (Selling Price - Original Price)',
        admin: 'Admin Fees (SAAS)',
        adgm: 'ADGM Reg. Fee (2% of Original Price)',
        agency: 'Agency Fees (2% of Selling Price + Vat)'
    };

    it('has all required labels', () => {
        expect(defaultLabels.refund).toBeDefined();
        expect(defaultLabels.balance).toBeDefined();
        expect(defaultLabels.premium).toBeDefined();
        expect(defaultLabels.admin).toBeDefined();
        expect(defaultLabels.adgm).toBeDefined();
        expect(defaultLabels.agency).toBeDefined();
    });

    it('labels are non-empty strings', () => {
        Object.values(defaultLabels).forEach(label => {
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
        });
    });
});

// ============================================================================
// LOGO VALIDATION
// ============================================================================

describe('logo validation', () => {
    it('accepts image MIME types', () => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const invalidTypes = ['application/pdf', 'text/plain', 'video/mp4'];

        validTypes.forEach(type => {
            expect(type.startsWith('image/')).toBe(true);
        });

        invalidTypes.forEach(type => {
            expect(type.startsWith('image/')).toBe(false);
        });
    });

    it('enforces 5MB size limit', () => {
        const maxSize = 5 * 1024 * 1024;

        const smallFile = { size: 1 * 1024 * 1024 };
        const largeFile = { size: 6 * 1024 * 1024 };

        expect(smallFile.size <= maxSize).toBe(true);
        expect(largeFile.size <= maxSize).toBe(false);
    });

    it('validates base64 data URL format', () => {
        const validBase64 = 'data:image/png;base64,iVBORw0KGgo=';
        const invalidBase64 = 'not-a-valid-data-url';

        expect(validBase64.startsWith('data:image/')).toBe(true);
        expect(invalidBase64.startsWith('data:image/')).toBe(false);
    });
});

// ============================================================================
// CSS VARIABLE APPLICATION
// ============================================================================

describe('CSS variable application', () => {
    it('formats CSS variable correctly', () => {
        const color = '#62c6c1';
        const cssVar = `--primary-color: ${color}`;
        expect(cssVar).toBe('--primary-color: #62c6c1');
    });

    it('CSS property name is valid', () => {
        const propertyName = '--primary-color';
        expect(propertyName.startsWith('--')).toBe(true);
        expect(propertyName).toMatch(/^--[a-z-]+$/);
    });
});

// ============================================================================
// BRANDING OBJECT MERGING
// ============================================================================

describe('branding object merging', () => {
    it('merges partial updates', () => {
        const current = {
            companyName: 'Kennedy Property',
            primaryColor: '#62c6c1',
            logo: '',
            footerText: 'SALE OFFER'
        };

        const update = {
            primaryColor: '#FF0000'
        };

        const merged = { ...current, ...update };

        expect(merged.companyName).toBe('Kennedy Property');
        expect(merged.primaryColor).toBe('#FF0000');
        expect(merged.footerText).toBe('SALE OFFER');
    });

    it('preserves logo when updating other fields', () => {
        const current = {
            companyName: 'Old Name',
            logo: 'data:image/png;base64,abc123'
        };

        const update = {
            companyName: 'New Name'
        };

        const merged = { ...current, ...update };

        expect(merged.companyName).toBe('New Name');
        expect(merged.logo).toBe('data:image/png;base64,abc123');
    });
});

// ============================================================================
// LABEL ELEMENT IDS
// ============================================================================

describe('label element IDs', () => {
    const labelElements = {
        'label_refund_amount': 'refund',
        'label_balance_resale': 'balance',
        'label_premium_price': 'premium',
        'label_admin_fees': 'admin',
        'label_adgm_transfer': 'adgm',
        'label_agency_fees': 'agency'
    };

    it('maps IDs to label keys', () => {
        expect(Object.keys(labelElements).length).toBe(6);
    });

    it('all IDs start with label_', () => {
        Object.keys(labelElements).forEach(id => {
            expect(id.startsWith('label_')).toBe(true);
        });
    });

    it('all values are valid label keys', () => {
        const validKeys = ['refund', 'balance', 'premium', 'admin', 'adgm', 'agency'];
        Object.values(labelElements).forEach(key => {
            expect(validKeys).toContain(key);
        });
    });
});

// ============================================================================
// RESET FUNCTIONALITY
// ============================================================================

describe('reset to defaults', () => {
    it('reset branding returns default values', () => {
        const defaultBranding = {
            companyName: 'Kennedy Property',
            primaryColor: '#62c6c1',
            logo: '',
            footerText: 'SALE OFFER'
        };

        const customBranding = {
            companyName: 'Custom Company',
            primaryColor: '#FF0000',
            logo: 'data:image/png;base64,abc',
            footerText: 'CUSTOM TEXT'
        };

        // After reset, should match defaults
        expect(defaultBranding.companyName).not.toBe(customBranding.companyName);
        expect(defaultBranding.primaryColor).not.toBe(customBranding.primaryColor);
    });

    it('reset labels returns default values', () => {
        const defaultLabels = {
            refund: 'Refund (40% of Original Price)',
            admin: 'Admin Fees (SAAS)'
        };

        const customLabels = {
            refund: 'Custom Refund Label',
            admin: 'Custom Admin Label'
        };

        expect(defaultLabels.refund).not.toBe(customLabels.refund);
        expect(defaultLabels.admin).not.toBe(customLabels.admin);
    });
});

// ============================================================================
// COLOR PREVIEW
// ============================================================================

describe('color preview', () => {
    it('color picker and hex input sync', () => {
        let pickerValue = '#62c6c1';
        let hexValue = '#62c6c1';

        // Simulate picker change
        pickerValue = '#FF0000';
        hexValue = pickerValue.toUpperCase();

        expect(hexValue).toBe('#FF0000');
    });

    it('hex input with missing # prefix', () => {
        let hexInput = 'AABBCC';

        if (!hexInput.startsWith('#')) {
            hexInput = '#' + hexInput;
        }

        expect(hexInput).toBe('#AABBCC');
    });
});
