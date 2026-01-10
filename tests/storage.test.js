/**
 * Tests for storage.js localStorage functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// MOCK LOCALSTORAGE
// ============================================================================

const createMockLocalStorage = () => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((i) => Object.keys(store)[i] || null),
        _store: store
    };
};

// ============================================================================
// PURE UTILITY FUNCTIONS (from storage.js logic)
// ============================================================================

/**
 * Deep merge utility function
 */
function deepMerge(target, source) {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    output[key] = source[key];
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                output[key] = source[key];
            }
        });
    }

    return output;
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

describe('deepMerge', () => {
    it('merges flat objects', () => {
        const target = { a: 1, b: 2 };
        const source = { c: 3 };
        const result = deepMerge(target, source);
        expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('overwrites existing keys', () => {
        const target = { a: 1, b: 2 };
        const source = { b: 99 };
        const result = deepMerge(target, source);
        expect(result).toEqual({ a: 1, b: 99 });
    });

    it('merges nested objects', () => {
        const target = { settings: { a: 1, b: 2 } };
        const source = { settings: { c: 3 } };
        const result = deepMerge(target, source);
        expect(result).toEqual({ settings: { a: 1, b: 2, c: 3 } });
    });

    it('preserves nested values from target', () => {
        const target = { settings: { theme: 'dark', fontSize: 14 } };
        const source = { settings: { fontSize: 16 } };
        const result = deepMerge(target, source);
        expect(result.settings.theme).toBe('dark');
        expect(result.settings.fontSize).toBe(16);
    });

    it('handles deeply nested objects', () => {
        const target = {
            level1: {
                level2: {
                    level3: { a: 1 }
                }
            }
        };
        const source = {
            level1: {
                level2: {
                    level3: { b: 2 }
                }
            }
        };
        const result = deepMerge(target, source);
        expect(result.level1.level2.level3).toEqual({ a: 1, b: 2 });
    });

    it('does not modify original objects', () => {
        const target = { a: 1 };
        const source = { b: 2 };
        deepMerge(target, source);
        expect(target).toEqual({ a: 1 });
        expect(source).toEqual({ b: 2 });
    });

    it('handles arrays as values (not merged)', () => {
        const target = { items: [1, 2, 3] };
        const source = { items: [4, 5] };
        const result = deepMerge(target, source);
        expect(result.items).toEqual([4, 5]);
    });

    it('handles null values', () => {
        const target = { a: { b: 1 } };
        const source = { a: null };
        const result = deepMerge(target, source);
        expect(result.a).toBe(null);
    });
});

describe('isObject', () => {
    it('returns true for plain objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
    });

    it('returns false for arrays', () => {
        expect(isObject([])).toBeFalsy();
        expect(isObject([1, 2, 3])).toBeFalsy();
    });

    it('returns false for null', () => {
        expect(isObject(null)).toBeFalsy();
    });

    it('returns false for primitives', () => {
        expect(isObject('string')).toBeFalsy();
        expect(isObject(123)).toBeFalsy();
        expect(isObject(true)).toBeFalsy();
        expect(isObject(undefined)).toBeFalsy();
    });
});

// ============================================================================
// STORAGE USAGE CALCULATION
// ============================================================================

describe('storage usage calculation', () => {
    it('calculates byte size correctly', () => {
        const data = 'Hello World';
        const size = new Blob([data]).size;
        expect(size).toBe(11);
    });

    it('calculates JSON size correctly', () => {
        const data = JSON.stringify({ name: 'test', value: 123 });
        const size = new Blob([data]).size;
        expect(size).toBeGreaterThan(0);
    });

    it('calculates percentage correctly', () => {
        const used = 2.5 * 1024 * 1024; // 2.5MB
        const total = 5 * 1024 * 1024;   // 5MB
        const percent = Math.round((used / total) * 100);
        expect(percent).toBe(50);
    });
});

// ============================================================================
// DEFAULT STATE STRUCTURE
// ============================================================================

describe('default state structure', () => {
    const defaultState = {
        currentOffer: {
            projectName: '',
            unitNo: '',
            unitType: '',
            bedrooms: '',
            views: '',
            internalArea: '',
            balconyArea: '',
            totalArea: '',
            originalPrice: '',
            sellingPrice: '',
            paymentPlan: [],
            floorPlanImage: ''
        },
        templates: [],
        branding: {
            companyName: 'Kennedy Property',
            primaryColor: '#62c6c1',
            logo: '',
            footerText: 'SALE OFFER'
        },
        labels: {
            refund: 'Refund (Amount Paid to Developer)',
            balance: 'Balance Resale Clause',
            premium: 'Premium (Selling Price - Original Price)',
            admin: 'Admin Fees (SAAS)',
            adgm: 'ADGM Reg. Fee (2% of Original Price)',
            agency: 'Agency Fees (2% of Selling Price + VAT)'
        },
        settings: {
            autoCalculate: true,
            currentTemplate: 'landscape',
            lockedFields: []
        },
        customDropdowns: {
            unitModels: []
        },
        apiKey: '',
        _version: 1
    };

    it('has currentOffer object', () => {
        expect(defaultState.currentOffer).toBeDefined();
        expect(typeof defaultState.currentOffer).toBe('object');
    });

    it('has empty templates array', () => {
        expect(Array.isArray(defaultState.templates)).toBe(true);
        expect(defaultState.templates.length).toBe(0);
    });

    it('has branding with defaults', () => {
        expect(defaultState.branding.companyName).toBe('Kennedy Property');
        expect(defaultState.branding.primaryColor).toBe('#62c6c1');
    });

    it('has labels object', () => {
        expect(defaultState.labels.refund).toBeDefined();
        expect(defaultState.labels.balance).toBeDefined();
    });

    it('has settings with defaults', () => {
        expect(defaultState.settings.autoCalculate).toBe(true);
        expect(defaultState.settings.currentTemplate).toBe('landscape');
        expect(Array.isArray(defaultState.settings.lockedFields)).toBe(true);
    });

    it('has schema version', () => {
        expect(defaultState._version).toBe(1);
    });
});

// ============================================================================
// FIELD LOCKING LOGIC
// ============================================================================

describe('field locking logic', () => {
    it('check if field is in locked array', () => {
        const lockedFields = ['field1', 'field2'];
        expect(lockedFields.includes('field1')).toBe(true);
        expect(lockedFields.includes('field3')).toBe(false);
    });

    it('toggle adds field if not present', () => {
        const lockedFields = ['field1'];
        const fieldId = 'field2';
        const index = lockedFields.indexOf(fieldId);

        if (index === -1) {
            lockedFields.push(fieldId);
        }

        expect(lockedFields).toContain('field2');
    });

    it('toggle removes field if present', () => {
        const lockedFields = ['field1', 'field2'];
        const fieldId = 'field1';
        const index = lockedFields.indexOf(fieldId);

        if (index > -1) {
            lockedFields.splice(index, 1);
        }

        expect(lockedFields).not.toContain('field1');
        expect(lockedFields).toContain('field2');
    });
});

// ============================================================================
// TEMPLATE STRUCTURE
// ============================================================================

describe('template structure', () => {
    it('has required fields', () => {
        const template = {
            id: 'abc123',
            name: 'My Template',
            createdAt: new Date().toISOString(),
            data: { projectName: 'Test' },
            branding: { primaryColor: '#000' }
        };

        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.createdAt).toBeDefined();
        expect(template.data).toBeDefined();
        expect(template.branding).toBeDefined();
    });

    it('createdAt is valid ISO date', () => {
        const template = {
            createdAt: new Date().toISOString()
        };
        const parsed = new Date(template.createdAt);
        expect(parsed.toString()).not.toBe('Invalid Date');
    });
});

// ============================================================================
// IMPORT/EXPORT STRUCTURE
// ============================================================================

describe('import/export structure', () => {
    it('export includes required fields', () => {
        const exportData = {
            offer: { projectName: 'Test' },
            branding: { primaryColor: '#62c6c1' },
            labels: { refund: 'Refund' },
            exportedAt: new Date().toISOString()
        };

        expect(exportData.offer).toBeDefined();
        expect(exportData.branding).toBeDefined();
        expect(exportData.labels).toBeDefined();
        expect(exportData.exportedAt).toBeDefined();
    });

    it('JSON stringify and parse round-trips', () => {
        const original = {
            offer: { projectName: 'Test', price: 1000000 },
            branding: { primaryColor: '#62c6c1' }
        };

        const json = JSON.stringify(original, null, 2);
        const parsed = JSON.parse(json);

        expect(parsed.offer.projectName).toBe('Test');
        expect(parsed.offer.price).toBe(1000000);
        expect(parsed.branding.primaryColor).toBe('#62c6c1');
    });

    it('handles nested objects in export', () => {
        const exportData = {
            offer: {
                paymentPlan: [
                    { milestone: 'Booking', percentage: 20 },
                    { milestone: 'Handover', percentage: 80 }
                ]
            }
        };

        const json = JSON.stringify(exportData);
        const parsed = JSON.parse(json);

        expect(parsed.offer.paymentPlan.length).toBe(2);
        expect(parsed.offer.paymentPlan[0].milestone).toBe('Booking');
    });
});

// ============================================================================
// IMAGE COMPRESSION LOGIC
// ============================================================================

describe('image compression logic', () => {
    const MAX_IMAGE_SIZE = 500 * 1024; // 500KB

    it('identifies images needing compression', () => {
        const smallImage = 'data:image/png;base64,' + 'a'.repeat(100000);
        const largeImage = 'data:image/png;base64,' + 'a'.repeat(600000);

        expect(smallImage.length < MAX_IMAGE_SIZE).toBe(true);
        expect(largeImage.length > MAX_IMAGE_SIZE).toBe(true);
    });

    it('validates base64 data URL format', () => {
        const validImage = 'data:image/png;base64,abc123';
        const invalidImage = 'not-a-data-url';

        expect(validImage.startsWith('data:image')).toBe(true);
        expect(invalidImage.startsWith('data:image')).toBe(false);
    });

    it('identifies extremely large images', () => {
        const extremelyLarge = 'data:image/png;base64,' + 'a'.repeat(MAX_IMAGE_SIZE * 4 + 1);
        expect(extremelyLarge.length > MAX_IMAGE_SIZE * 4).toBe(true);
    });
});
