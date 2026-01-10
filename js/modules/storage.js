/**
 * ============================================================================
 * STORAGE.JS - LocalStorage Persistence Module
 * ============================================================================
 *
 * PURPOSE: Manages all localStorage operations for persisting app state.
 *          Handles auto-save, templates, and branding storage.
 *
 * STORAGE KEY: 'salesOfferApp' (single key containing all app data)
 *
 * DATA STRUCTURE:
 * {
 *   schemaVersion: 1,           // For future migrations
 *   currentOffer: {...},        // Current form data
 *   branding: {...},            // Company branding settings
 *   templates: [...],           // Saved offer templates
 *   settings: {...}             // App settings
 * }
 *
 * EXPORTED FUNCTIONS:
 * - loadState(): Load entire app state from localStorage
 * - saveCurrentOffer(data): Save current offer form data
 * - getCurrentOffer(): Get current offer data
 * - getBranding(): Get branding settings
 * - saveBranding(data): Save branding settings
 * - getTemplates(): Get saved templates list
 * - saveTemplate(name, data): Save a new template
 * - loadTemplate(id): Load a template by ID
 * - deleteTemplate(id): Delete a template
 * - isFieldLocked(fieldId): Check if field is locked
 * - toggleFieldLock(fieldId): Toggle field lock state
 * - clearAllData(): Reset to defaults
 *
 * ============================================================================
 */

import { generateId, toast } from '../utils/helpers.js';

/* ============================================================================
   CONSTANTS
   ============================================================================ */

/**
 * STORAGE_KEY
 * The single localStorage key used to store ALL app data.
 *
 * WHY ONE KEY:
 * - Atomic reads/writes (get entire state at once)
 * - Easy to export/backup (just one JSON blob)
 * - Simpler version migration
 *
 * ALTERNATIVE: Multiple keys (e.g., 'salesOffer_branding', 'salesOffer_templates')
 * We chose single key for simplicity.
 */
const STORAGE_KEY = 'salesOfferApp';

/**
 * SCHEMA_VERSION
 * Version number for data structure.
 *
 * WHY VERSION:
 * If we change the data structure in the future, we can detect old data
 * and migrate it to the new format.
 *
 * EXAMPLE:
 * - Version 1: { currentOffer: {...} }
 * - Version 2: { offers: [{...}] }  // Changed to array
 * - Migration: if (state._version === 1) { ... convert ... }
 */
const SCHEMA_VERSION = 1;

/**
 * MAX_IMAGE_SIZE
 * Maximum size for base64 encoded images (in characters).
 *
 * WHY LIMIT:
 * - localStorage has ~5MB total limit
 * - Base64 encoding increases size by ~33%
 * - Large images can make the app slow
 *
 * 500KB * 1024 = 512,000 characters
 * A 4000×3000 JPEG might be 2-5MB, which would consume entire localStorage!
 */
const MAX_IMAGE_SIZE = 500 * 1024;

/* ============================================================================
   DEFAULT STATE
   ============================================================================
   This is the initial state used when:
   - First time user (no localStorage data)
   - After clearing all data
   - As fallback for missing fields (deepMerge fills gaps)
   ============================================================================ */

const defaultState = {

    /* --------------------------------
       CURRENT OFFER
       --------------------------------
       The form data for the offer currently being created/edited.
       This is what gets displayed in the preview document.
       -------------------------------- */
    currentOffer: {
        // === PROPERTY IDENTIFICATION ===
        projectName: '',       // e.g., "The Palms", "Dubai Marina Towers"
        unitNo: '',            // e.g., "1-2-301" (Building-Floor-Unit)
        unitType: '',          // e.g., "off-plan" or "ready"
        bedrooms: '',          // e.g., "2 Bedroom", "Studio"
        views: '',             // e.g., "Sea View", "Garden View"

        // === STANDARD UNIT AREAS (Apartments) ===
        internalArea: '',      // Built-up area inside walls (Sq.Ft)
        balconyArea: '',       // Balcony/terrace area (Sq.Ft)
        totalArea: '',         // internalArea + balconyArea (Sq.Ft)

        // === VILLA/TOWNHOUSE AREAS ===
        villaInternal: '',     // Indoor living space (Sq.Ft)
        villaTerrace: '',      // Outdoor covered areas (Sq.Ft)
        bua: '',               // Built-Up Area (Sq.Ft)
        gfa: '',               // Gross Floor Area (Sq.Ft)
        villaTotal: '',        // Total built area (Sq.Ft)
        plotSize: '',          // Land plot size (Sq.Ft)

        // === PLOT-ONLY AREAS (Land sales) ===
        plotSizeOnly: '',      // Raw land size (Sq.Ft)
        allowedBuild: '',      // Maximum buildable area (Sq.Ft)

        // === FINANCIAL DATA ===
        originalPrice: '',     // Developer's original price (AED)
        sellingPrice: '',      // Resale price / asking price (AED)
        resaleClausePercent: '',   // Min % that must be paid before resale (e.g., 40)
        amountPaidPercent: '',     // How much buyer has paid (e.g., 20)
        amountPaid: '',            // Amount paid in AED (calculated or manual)
        refund: '',                // Refund to original buyer (AED)
        balanceResale: '',         // Additional payment to meet resale clause (AED)
        premium: '',               // sellingPrice - originalPrice (AED)
        adminFees: '',             // SAAS admin fees (AED)
        adgm: '',                  // Abu Dhabi Global Market fee (AED)
        agencyFees: '',            // Real estate agent commission (AED)

        // === PAYMENT PLAN ===
        paymentPlan: [],       // Array of {milestone, date, amount} objects

        // === IMAGES ===
        floorPlanImage: ''     // Base64 encoded floor plan image
    },

    /* --------------------------------
       TEMPLATES
       --------------------------------
       Saved offer configurations that can be loaded later.
       Useful for: recurring projects, standard unit types, etc.
       -------------------------------- */
    templates: [],  // Array of {id, name, createdAt, data, branding}

    /* --------------------------------
       BRANDING
       --------------------------------
       Company-specific appearance settings.
       Applied to all generated documents.
       -------------------------------- */
    branding: {
        companyName: 'Kennedy Property',  // Shown in footer
        primaryColor: '#62c6c1',          // Teal - header bar, accents
        logo: '',                         // Base64 encoded company logo
        footerText: 'SALE OFFER'          // Text below project name in footer
    },

    /* --------------------------------
       LABELS
       --------------------------------
       Customizable field labels for the preview document.
       Allows users to rename fields without code changes.
       -------------------------------- */
    labels: {
        refund: 'Refund (Amount Paid to Developer)',
        balance: 'Balance Resale Clause',
        premium: 'Premium (Selling Price - Original Price)',
        admin: 'Admin Fees (SAAS)',
        adgm: 'ADGM Reg. Fee (2% of Original Price)',
        agency: 'Agency Fees (2% of Selling Price + VAT)'
    },

    /* --------------------------------
       SETTINGS
       --------------------------------
       Application behavior preferences.
       -------------------------------- */
    settings: {
        autoCalculate: true,       // Auto-compute derived fields
        currentTemplate: 'landscape',  // Document layout (landscape/portrait)
        lockedFields: []           // Array of field IDs with manual override
    },

    /* --------------------------------
       CUSTOM DROPDOWNS
       --------------------------------
       User-added options for dropdown menus.
       -------------------------------- */
    customDropdowns: {
        unitModels: []  // Custom bedroom types
    },

    /* --------------------------------
       VERSION
       --------------------------------
       Schema version for future data migrations.
       -------------------------------- */
    _version: SCHEMA_VERSION
};

/* ============================================================================
   CORE STORAGE FUNCTIONS
   ============================================================================
   loadState() and saveState() are the foundation of all storage operations.
   All other functions (getCurrentOffer, saveBranding, etc.) use these.
   ============================================================================ */

/**
 * loadState()
 * ===========
 * Retrieves the entire app state from localStorage.
 *
 * WHAT IT RETURNS:
 * The complete state object containing:
 * - currentOffer: Form data
 * - templates: Saved configurations
 * - branding: Company settings
 * - settings: App preferences
 * - etc.
 *
 * WHY DEEP MERGE:
 * When we add new fields to defaultState (e.g., new feature),
 * existing users won't have those fields in their saved data.
 * deepMerge ensures all expected fields exist:
 *
 *   defaultState: { a: 1, b: 2, c: 3 }  // New field 'c' added
 *   savedData:    { a: 5, b: 6 }        // Old data without 'c'
 *   result:       { a: 5, b: 6, c: 3 }  // User values + new defaults
 *
 * GRACEFUL DEGRADATION:
 * If localStorage read fails (corrupted data, browser restrictions),
 * returns defaultState so the app still works.
 *
 * @returns {Object} The complete app state
 */
export function loadState() {
    try {
        // Attempt to read from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored) {
            // Parse JSON string back to object
            const parsed = JSON.parse(stored);

            // Merge saved data with defaults (fills any missing fields)
            return deepMerge(defaultState, parsed);
        }
    } catch (e) {
        // JSON parse error, localStorage access denied, etc.
        console.error('Failed to load state:', e);
    }

    // No saved data or error: return fresh defaults
    // Using spread {...} creates a new object (doesn't modify defaultState)
    return { ...defaultState };
}

/**
 * saveState(state)
 * ================
 * Saves the entire app state to localStorage with graceful degradation.
 *
 * QUOTA HANDLING:
 * localStorage has a ~5MB limit (varies by browser).
 * When quota is exceeded, this function tries progressively more
 * aggressive strategies to save the data:
 *
 * 1. COMPRESS IMAGES (first attempt)
 *    - Reduce quality of large base64 images
 *    - Floor plan, logo, template images
 *    - User sees: "Storage space low. Images compressed."
 *
 * 2. REMOVE IMAGES (second attempt)
 *    - Strip all image data entirely
 *    - Preserves all other data (offers, settings, etc.)
 *    - User sees: "Storage full. Images removed."
 *
 * 3. CRITICAL FAILURE (last resort)
 *    - Even minimal data won't fit
 *    - User sees: "CRITICAL: Cannot save. Export immediately!"
 *    - Returns false so caller knows save failed
 *
 * WHY THIS APPROACH:
 * Data loss is the worst outcome. By progressively degrading,
 * we preserve the most important data (form values, settings)
 * even when images can't be saved.
 *
 * @param {Object} state - The complete state to save
 * @returns {boolean} True if save succeeded, false if critical failure
 */
export function saveState(state) {
    try {
        // Stamp with current schema version (for future migrations)
        state._version = SCHEMA_VERSION;

        // Convert to JSON and save
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;

    } catch (e) {
        // Check if error is quota exceeded
        // Different browsers use different error codes/names
        if (e.name === 'QuotaExceededError' || e.code === 22) {

            console.warn('localStorage quota exceeded, attempting to compress images...');

            // ============================================
            // STRATEGY 1: Compress images
            // ============================================
            const compressedState = compressStateImages(state);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(compressedState));
                toast('Storage space low. Images have been compressed.', 'info');
                return true;
            } catch {

                // ============================================
                // STRATEGY 2: Remove images entirely
                // ============================================
                console.warn('Still over quota, removing images...');
                const minimalState = removeStateImages(state);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalState));
                    toast('Storage full. Images removed to save data. Please export your data.', 'error');
                    return true;
                } catch (e3) {

                    // ============================================
                    // STRATEGY 3: Critical failure
                    // ============================================
                    console.error('Critical: Cannot save even minimal state:', e3);
                    toast('CRITICAL: Cannot save data. Export immediately!', 'error');
                    return false;
                }
            }
        }

        // Non-quota error (permissions, etc.)
        console.error('Failed to save state:', e);
        toast('Failed to save data', 'error');
        return false;
    }
}

/* ============================================================================
   IMAGE COMPRESSION HELPERS (PRIVATE)
   ============================================================================
   These functions handle localStorage quota issues by reducing image sizes.
   They're used internally by saveState() when quota is exceeded.
   ============================================================================ */

/**
 * compressStateImages(state)
 * ==========================
 * Creates a copy of state with compressed images.
 *
 * WHAT GETS COMPRESSED:
 * 1. currentOffer.floorPlanImage - The uploaded floor plan
 * 2. branding.logo - Company logo
 * 3. templates[].data.floorPlanImage - Floor plans in saved templates
 *
 * WHY DEEP COPY FIRST:
 * We use JSON.parse(JSON.stringify()) to create a deep copy.
 * This ensures we don't modify the original state object.
 *
 * QUALITY SETTINGS:
 * - Floor plans: 50% quality (photos can handle more compression)
 * - Logos: 60% quality (graphics need slightly better quality)
 *
 * @param {Object} state - Original state
 * @returns {Object} New state with compressed images (doesn't modify original)
 */
function compressStateImages(state) {
    // Deep copy: JSON stringify then parse creates a completely new object
    const compressed = JSON.parse(JSON.stringify(state));

    // Compress floor plan if too large
    // ?. = optional chaining (don't error if currentOffer is undefined)
    if (compressed.currentOffer?.floorPlanImage) {
        const imgSize = compressed.currentOffer.floorPlanImage.length;
        if (imgSize > MAX_IMAGE_SIZE) {
            compressed.currentOffer.floorPlanImage = compressBase64Image(
                compressed.currentOffer.floorPlanImage,
                0.5  // 50% quality
            );
        }
    }

    // Compress logo if too large
    if (compressed.branding?.logo) {
        const logoSize = compressed.branding.logo.length;
        if (logoSize > MAX_IMAGE_SIZE) {
            compressed.branding.logo = compressBase64Image(
                compressed.branding.logo,
                0.6  // 60% quality (logos need more detail)
            );
        }
    }

    // Compress images in saved templates
    if (compressed.templates) {
        compressed.templates.forEach(template => {
            if (template.data?.floorPlanImage?.length > MAX_IMAGE_SIZE) {
                template.data.floorPlanImage = compressBase64Image(
                    template.data.floorPlanImage,
                    0.5
                );
            }
        });
    }

    return compressed;
}

/**
 * removeStateImages(state)
 * ========================
 * Creates a copy of state with ALL images removed.
 *
 * LAST RESORT:
 * This is called when compression isn't enough to fit under quota.
 * We remove all images to preserve the more important data
 * (form values, settings, branding colors, etc.)
 *
 * USER IMPACT:
 * - Floor plan preview will be empty (placeholder shown)
 * - Company logo will be missing
 * - Templates will lose their floor plan images
 * - All other data (text, numbers) is preserved
 *
 * @param {Object} state - Original state
 * @returns {Object} New state with all images removed
 */
function removeStateImages(state) {
    // Deep copy to avoid modifying original
    const stripped = JSON.parse(JSON.stringify(state));

    // Remove current offer floor plan
    if (stripped.currentOffer) {
        stripped.currentOffer.floorPlanImage = '';
    }

    // Remove company logo
    if (stripped.branding) {
        stripped.branding.logo = '';
    }

    // Remove images from all templates
    if (stripped.templates) {
        stripped.templates.forEach(template => {
            if (template.data) {
                template.data.floorPlanImage = '';
            }
            if (template.branding) {
                template.branding.logo = '';
            }
        });
    }

    return stripped;
}

/**
 * compressBase64Image(base64, quality)
 * =====================================
 * Attempts to reduce the size of a base64 image string.
 *
 * LIMITATION:
 * True image compression requires async Canvas operations
 * (loading image, drawing to canvas, exporting with quality).
 * This function is synchronous, so it can only do basic checks.
 *
 * CURRENT BEHAVIOR:
 * - If image is WAY too large (4x max), removes it entirely
 * - Otherwise returns as-is (compression happens at upload time in app.js)
 *
 * @param {string} base64 - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param {number} quality - Target quality 0-1 (currently unused)
 * @returns {string} Possibly reduced image string
 */
function compressBase64Image(base64, _quality = 0.5) {
    // Validate input is a proper data URL
    if (!base64 || !base64.startsWith('data:image')) {
        return base64;
    }

    // If image is EXTREMELY large (4× our limit), remove it
    // This prevents a single massive image from blocking all saves
    if (base64.length > MAX_IMAGE_SIZE * 4) {
        console.warn('Image too large, returning placeholder');
        return '';  // Empty = show placeholder instead
    }

    // For moderately large images, return as-is
    // Real compression should happen at upload time (async)
    return base64;
}

/* ============================================================================
   STORAGE MONITORING
   ============================================================================ */

/**
 * getStorageUsage()
 * =================
 * Returns information about localStorage usage.
 *
 * USED FOR:
 * - Displaying storage indicator to user
 * - Warning when storage is getting full
 * - Debugging storage issues
 *
 * HOW SIZE IS CALCULATED:
 * - Create a Blob from the data (Blob.size gives byte count)
 * - Compare against estimated 5MB limit
 *
 * NOTE ON LIMIT:
 * localStorage limit varies by browser:
 * - Chrome, Firefox, Edge: ~5MB per origin
 * - Safari: ~5MB (may ask user for more)
 * - Mobile: Often less (~2.5MB)
 * We use 5MB as a reasonable estimate.
 *
 * @returns {Object} { used, total, percent, formatted }
 */
export function getStorageUsage() {
    try {
        // Get current data (empty string if nothing saved)
        const data = localStorage.getItem(STORAGE_KEY) || '';

        // Blob gives accurate byte size
        const used = new Blob([data]).size;

        // Estimated total (5MB is common limit)
        const total = 5 * 1024 * 1024;  // 5MB in bytes

        return {
            used,        // Bytes used
            total,       // Total bytes available (estimate)
            percent: Math.round((used / total) * 100),  // e.g., 45
            formatted: `${(used / 1024 / 1024).toFixed(2)}MB / ~5MB`  // e.g., "2.34MB / ~5MB"
        };
    } catch {
        // Return safe defaults if calculation fails
        return { used: 0, total: 5 * 1024 * 1024, percent: 0, formatted: 'Unknown' };
    }
}

/* ============================================================================
   DATA ACCESSORS - CURRENT OFFER
   ============================================================================
   These functions provide access to the current offer data.
   They abstract away the full state structure for cleaner code.
   ============================================================================ */

/**
 * getCurrentOffer()
 * =================
 * Returns the current offer form data.
 *
 * USAGE: Get current values to display, calculate, or export.
 *
 * @returns {Object} Current offer data (projectName, prices, areas, etc.)
 */
export function getCurrentOffer() {
    const state = loadState();
    return state.currentOffer;
}

/**
 * saveCurrentOffer(offer)
 * =======================
 * Saves current offer data, merging with existing values.
 *
 * MERGE BEHAVIOR:
 * Only overwrites the fields you pass. Other fields are preserved.
 *
 * EXAMPLE:
 *   Current: { projectName: 'Palm', unitNo: '101', views: 'Sea' }
 *   Called:  saveCurrentOffer({ unitNo: '202' })
 *   Result:  { projectName: 'Palm', unitNo: '202', views: 'Sea' }
 *
 * @param {Object} offer - Partial offer data to merge
 */
export function saveCurrentOffer(offer) {
    const state = loadState();
    // Spread operator merges: existing values + new values (new wins on conflict)
    state.currentOffer = { ...state.currentOffer, ...offer };
    saveState(state);
}

/* ============================================================================
   DATA ACCESSORS - BRANDING
   ============================================================================ */

/**
 * getBranding()
 * =============
 * Returns company branding settings.
 *
 * @returns {Object} { companyName, primaryColor, logo, footerText }
 */
export function getBranding() {
    const state = loadState();
    return state.branding;
}

/**
 * saveBranding(branding)
 * ======================
 * Saves branding settings, merging with existing values.
 *
 * EXAMPLE:
 *   saveBranding({ primaryColor: '#ff0000' })  // Just changes color
 *
 * @param {Object} branding - Partial branding data to merge
 */
export function saveBranding(branding) {
    const state = loadState();
    state.branding = { ...state.branding, ...branding };
    saveState(state);
}

/* ============================================================================
   DATA ACCESSORS - LABELS
   ============================================================================ */

/**
 * getLabels()
 * ===========
 * Returns custom field labels.
 *
 * Labels allow users to rename fields in the preview without code changes.
 *
 * @returns {Object} Field labels { refund, balance, premium, admin, adgm, agency }
 */
export function getLabels() {
    const state = loadState();
    return state.labels;
}

/**
 * saveLabels(labels)
 * ==================
 * Saves custom field labels.
 *
 * @param {Object} labels - Partial labels to merge
 */
export function saveLabels(labels) {
    const state = loadState();
    state.labels = { ...state.labels, ...labels };
    saveState(state);
}

/* ============================================================================
   DATA ACCESSORS - SETTINGS
   ============================================================================ */

/**
 * getSettings()
 * =============
 * Returns app settings.
 *
 * @returns {Object} { autoCalculate, currentTemplate, lockedFields }
 */
export function getSettings() {
    const state = loadState();
    return state.settings;
}

/**
 * saveSettings(settings)
 * ======================
 * Saves app settings.
 *
 * @param {Object} settings - Partial settings to merge
 */
export function saveSettings(settings) {
    const state = loadState();
    state.settings = { ...state.settings, ...settings };
    saveState(state);
}

/* ============================================================================
   FIELD LOCKING
   ============================================================================
   Field locking allows users to override auto-calculated values.

   EXAMPLE USE CASE:
   - User enters Selling Price: AED 2,500,000
   - System auto-calculates Premium = Selling - Original
   - User wants to manually set Premium = AED 100,000 (ignoring calculation)
   - User "locks" the premium field
   - Now calculation won't overwrite their manual value
   ============================================================================ */

/**
 * isFieldLocked(fieldId)
 * ======================
 * Checks if a field has been locked (manual override).
 *
 * USAGE:
 *   if (isFieldLocked('u_premium')) {
 *       // Don't auto-calculate, use user's value
 *   } else {
 *       // Safe to auto-calculate
 *   }
 *
 * @param {string} fieldId - The input field ID (e.g., 'u_premium', 'u_adgm')
 * @returns {boolean} True if field is locked
 */
export function isFieldLocked(fieldId) {
    const state = loadState();
    return state.settings.lockedFields.includes(fieldId);
}

/**
 * toggleFieldLock(fieldId)
 * ========================
 * Toggles the lock state of a field.
 *
 * - If locked → unlocks
 * - If unlocked → locks
 *
 * HOW IT WORKS:
 * lockedFields is an array of field IDs that are locked.
 * - To lock: add fieldId to array
 * - To unlock: remove fieldId from array
 *
 * @param {string} fieldId - The input field ID
 * @returns {boolean} New lock state (true = now locked, false = now unlocked)
 */
export function toggleFieldLock(fieldId) {
    const state = loadState();

    // Find if fieldId is in the locked list
    const index = state.settings.lockedFields.indexOf(fieldId);

    if (index > -1) {
        // Found = currently locked → unlock by removing
        state.settings.lockedFields.splice(index, 1);
    } else {
        // Not found = currently unlocked → lock by adding
        state.settings.lockedFields.push(fieldId);
    }

    saveState(state);

    // Return new state: if index was -1 (not found), it's now locked (true)
    return index === -1;
}

/* ============================================================================
   TEMPLATE MANAGEMENT
   ============================================================================
   Templates allow users to save and reuse offer configurations.

   USE CASES:
   - Agent works on multiple units in same project (save project defaults)
   - Standard pricing templates for common unit types
   - Quick switching between different property configurations
   ============================================================================ */

/**
 * getTemplates()
 * ==============
 * Returns all saved templates.
 *
 * @returns {Array} Array of template objects { id, name, createdAt, data, branding }
 */
export function getTemplates() {
    const state = loadState();
    return state.templates;
}

/**
 * saveTemplate(name, offer, branding)
 * ====================================
 * Creates a new template from current offer data.
 *
 * WHAT'S SAVED:
 * - name: User-provided template name
 * - id: Auto-generated unique ID (for loading/deleting)
 * - createdAt: Timestamp for sorting/display
 * - data: Copy of offer data (prices, areas, etc.)
 * - branding: Copy of branding settings (or current if not provided)
 *
 * @param {string} name - User-friendly template name (e.g., "Palm Jumeirah 2BR")
 * @param {Object} offer - Offer data to save
 * @param {Object} branding - Branding data (optional, uses current if null)
 * @returns {Object} The created template object
 */
export function saveTemplate(name, offer, branding = null) {
    const state = loadState();

    // Create template object with unique ID and timestamp
    const template = {
        id: generateId(),                     // Unique identifier
        name,                                  // User-provided name
        createdAt: new Date().toISOString(),  // ISO format: "2024-12-31T12:00:00.000Z"
        data: { ...offer },                    // Copy of offer data
        branding: branding || state.branding  // Copy of branding (or current)
    };

    // Add to templates array
    state.templates.push(template);

    // Save and notify user
    saveState(state);
    toast(`Template "${name}" saved`, 'success');

    return template;
}

/**
 * loadTemplate(templateId)
 * ========================
 * Retrieves a template by its ID.
 *
 * USAGE:
 *   const template = loadTemplate('abc123');
 *   if (template) {
 *       // Populate form with template.data
 *       // Apply template.branding
 *   }
 *
 * @param {string} templateId - The template's unique ID
 * @returns {Object|null} Template object or null if not found
 */
export function loadTemplate(templateId) {
    const state = loadState();
    // find() returns undefined if not found, || null makes it explicit
    return state.templates.find(t => t.id === templateId) || null;
}

/**
 * deleteTemplate(templateId)
 * ==========================
 * Removes a template by its ID.
 *
 * @param {string} templateId - The template's unique ID
 */
export function deleteTemplate(templateId) {
    const state = loadState();

    // Find template index
    const index = state.templates.findIndex(t => t.id === templateId);

    if (index > -1) {
        // Save name before deleting (for toast message)
        const name = state.templates[index].name;

        // Remove from array
        // splice(index, 1) removes 1 element at index position
        state.templates.splice(index, 1);

        // Save and notify
        saveState(state);
        toast(`Template "${name}" deleted`, 'success');
    }
}

/* ============================================================================
   DATA MANAGEMENT - CLEAR & RESET
   ============================================================================ */

/**
 * clearAllData()
 * ==============
 * Removes ALL app data from localStorage and reloads the page.
 *
 * ⚠️ DESTRUCTIVE: Cannot be undone!
 *
 * WHAT'S DELETED:
 * - Current offer
 * - All saved templates
 * - Branding settings
 * - Custom labels
 * - Everything
 *
 * Requires user confirmation before proceeding.
 */
export function clearAllData() {
    // Show browser confirmation dialog
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        // Remove our storage key entirely
        localStorage.removeItem(STORAGE_KEY);

        toast('All data cleared', 'success');

        // Reload page to reset app to initial state
        window.location.reload();
    }
}

/* ============================================================================
   EXPORT
   ============================================================================
   Functions for backing up offer data.
   Useful for: sharing between devices, backup before clearing, etc.
   ============================================================================ */

/**
 * exportOfferAsJSON()
 * ===================
 * Creates a JSON string of the current offer for backup/export.
 *
 * WHAT'S EXPORTED:
 * - offer: All form data (project, prices, areas, payment plan, etc.)
 * - branding: Company settings (logo, colors, etc.)
 * - labels: Custom field labels
 * - exportedAt: Timestamp for reference
 *
 * NOT EXPORTED:
 * - Templates (export individual templates separately if needed)
 * - Settings (non-essential)
 *
 * @returns {string} Formatted JSON string (with 2-space indentation)
 */
export function exportOfferAsJSON() {
    const state = loadState();

    const exportData = {
        offer: state.currentOffer,
        branding: state.branding,
        labels: state.labels,
        exportedAt: new Date().toISOString()  // When export was created
    };

    // JSON.stringify with null, 2 = pretty-print with 2-space indent
    return JSON.stringify(exportData, null, 2);
}

/* ============================================================================
   UTILITY FUNCTIONS (PRIVATE)
   ============================================================================ */

/**
 * deepMerge(target, source)
 * =========================
 * Recursively merges two objects.
 *
 * WHY NEEDED:
 * Standard spread ({...a, ...b}) only does shallow merge.
 * If a and b both have nested objects, the nested objects from b
 * completely replace those from a.
 *
 * SHALLOW MERGE PROBLEM:
 *   target: { settings: { a: 1, b: 2 } }
 *   source: { settings: { c: 3 } }
 *   {...target, ...source} = { settings: { c: 3 } }  // a and b are LOST!
 *
 * DEEP MERGE SOLUTION:
 *   deepMerge(target, source) = { settings: { a: 1, b: 2, c: 3 } }  // All preserved!
 *
 * ALGORITHM:
 * 1. Start with copy of target
 * 2. For each key in source:
 *    - If both target[key] and source[key] are objects: recurse
 *    - Otherwise: source[key] wins
 *
 * @param {Object} target - Base object (usually defaults)
 * @param {Object} source - Object to merge in (usually saved data)
 * @returns {Object} New merged object (doesn't modify originals)
 */
function deepMerge(target, source) {
    // Start with shallow copy of target
    const output = { ...target };

    // Only merge if both are objects
    if (isObject(target) && isObject(source)) {
        // Process each key in source
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                // Both are objects: recurse
                if (!(key in target)) {
                    // Key doesn't exist in target: just copy
                    output[key] = source[key];
                } else {
                    // Key exists in both: deep merge
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                // Source value is not object: just overwrite
                output[key] = source[key];
            }
        });
    }

    return output;
}

/**
 * isObject(item)
 * ==============
 * Helper to check if a value is a plain object (not null, not array).
 *
 * WHY NEEDED:
 * In JavaScript:
 * - typeof null === 'object'  (historical bug)
 * - typeof [] === 'object'    (arrays are objects)
 *
 * We need to distinguish plain objects {} from arrays [] and null.
 *
 * @param {any} item - Value to check
 * @returns {boolean} True if plain object
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}
