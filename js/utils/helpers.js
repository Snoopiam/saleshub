/**
 * ============================================================================
 * HELPERS.JS - Utility Functions Library
 * ============================================================================
 *
 * PURPOSE: Collection of reusable utility functions used across all modules.
 *          Includes DOM helpers, formatting, validation, and general utilities.
 *
 * CATEGORIES:
 *
 * 1. CURRENCY & NUMBER FORMATTING:
 *    - formatCurrency(num): Format as "AED 1,234,567"
 *    - formatNumber(num, decimals): Format with commas "1,234.56"
 *    - parseCurrency(str): Parse "AED 1,234" to number
 *
 * 2. DOM UTILITIES:
 *    - getById(id): Get element by ID (document.getElementById)
 *    - queryOne(selector): Get first matching element (querySelector)
 *    - queryAll(selector): Get all matching elements (querySelectorAll)
 *    - setValue(id, value): Set input value by ID
 *    - getValue(id): Get input value by ID
 *    - getNumericValue(id): Get input value as number
 *    - setText(id, text): Set textContent by ID
 *    - on(el, event, handler): Add event listener
 *
 * 3. VALIDATION:
 *    - validateFileType(file, types): Check file extension
 *    - checkFileSize(file, maxMB): Check file size limit
 *    - escapeHtml(str): Prevent XSS in user input
 *
 * 4. IMAGE PROCESSING:
 *    - compressImageFile(file, maxWidth, quality): Resize/compress images
 *    - fileToBase64(file): Convert file to base64 string
 *
 * 5. GENERAL UTILITIES:
 *    - debounce(fn, delay): Limit function call frequency
 *    - generateId(): Generate unique ID
 *    - toast(message, type): Show notification message
 *
 * ============================================================================
 */

/* ============================================================================
   GLOBAL IMAGE STORE FOR DUAL STORAGE STRATEGY
   ============================================================================
   Stores ORIGINAL quality images in memory for PDF generation.
   localStorage gets compressed versions to fit within 5MB quota.

   WHY THIS EXISTS:
   - localStorage has ~5MB limit, fills up with large images
   - PDF export needs original quality images
   - Solution: Keep originals in memory, compressed in localStorage

   BEHAVIOR:
   - Cleared on page refresh (acceptable - user can re-upload)
   - Used by pdfExport.js when generating PDFs
   - Falls back to localStorage version if not available
   ============================================================================ */
window.originalImages = {
    floorPlan: null,  // File or Blob object for floor plan
    logo: null        // File or Blob object for company logo
};

/* ============================================================================
   SECTION 1: CURRENCY & NUMBER FORMATTING
   ============================================================================
   Functions for displaying numbers in user-friendly formats.
   All monetary values in this app are in AED (UAE Dirham).
   ============================================================================ */

/**
 * formatCurrency(num)
 * ====================
 * Converts a number to AED currency format for display.
 *
 * INPUT: Number or string (e.g., 2500000, "2500000", 2500000.50)
 * OUTPUT: "AED 2,500,000" (no decimals, with comma separators)
 *
 * WHY NO DECIMALS:
 * Real estate prices in UAE are typically whole dirhams.
 * Showing "AED 2,500,000" is cleaner than "AED 2,500,000.00"
 *
 * EDGE CASES HANDLED:
 * - null/undefined → "AED 0"
 * - Empty string → "AED 0"
 * - "abc" (non-numeric) → "AED 0"
 * - 0 → "AED 0" (zero is valid, don't return early)
 *
 * EXAMPLE:
 * formatCurrency(2500000)    → "AED 2,500,000"
 * formatCurrency("1234567")  → "AED 1,234,567"
 * formatCurrency(null)       → "AED 0"
 */
export function formatCurrency(num) {
    // Handle null, undefined, empty string (but NOT zero - zero is valid)
    if (!num && num !== 0) return "AED 0";

    // Convert string to number if needed
    const number = typeof num === 'string' ? parseFloat(num) : num;

    // Handle NaN (e.g., parseFloat("abc") returns NaN)
    if (isNaN(number)) return "AED 0";

    // Format with commas, no decimal places
    // toLocaleString('en-US') gives us comma separators: 1,234,567
    return "AED " + number.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * formatNumber(num, decimals)
 * ===========================
 * Formats a number with comma separators and specified decimal places.
 *
 * USED FOR: Area measurements (e.g., "1,092.32 Sq.Ft")
 *
 * PARAMETERS:
 * - num: The number to format
 * - decimals: Number of decimal places (default: 2)
 *
 * EXAMPLE:
 * formatNumber(1092.3, 2)  → "1,092.30"
 * formatNumber(1000, 0)    → "1,000"
 * formatNumber(123.456, 1) → "123.5"
 */
export function formatNumber(num, decimals = 2) {
    if (!num && num !== 0) return "0";
    const number = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(number)) return "0";

    return number.toLocaleString('en-US', {
        minimumFractionDigits: decimals,  // Always show this many decimals
        maximumFractionDigits: decimals   // Never show more than this
    });
}

/**
 * parseCurrency(str)
 * ==================
 * Extracts a number from a currency string.
 * The REVERSE of formatCurrency().
 *
 * INPUT: "AED 2,500,000" or "2,500,000" or "AED2500000"
 * OUTPUT: 2500000 (as a number)
 *
 * HOW IT WORKS:
 * 1. Remove everything except digits, dots, and minus signs
 * 2. Parse the cleaned string as a float
 *
 * REGEX EXPLAINED: /[^0-9.-]/g
 * - [^...] = NOT these characters
 * - 0-9 = digits
 * - . = decimal point
 * - - = negative sign
 * - /g = global (replace all occurrences)
 *
 * EXAMPLE:
 * parseCurrency("AED 2,500,000") → 2500000
 * parseCurrency("1,234.56")      → 1234.56
 * parseCurrency("")              → 0
 */
export function parseCurrency(str) {
    if (!str) return 0;

    // Remove everything that's not a digit, dot, or minus
    const cleaned = str.toString().replace(/[^0-9.-]/g, '');

    // Parse and return (|| 0 handles NaN case)
    return parseFloat(cleaned) || 0;
}

/* ============================================================================
   SECTION 2: GENERAL UTILITIES
   ============================================================================ */

/**
 * generateId()
 * ============
 * Creates a unique identifier string.
 *
 * USED FOR: Template IDs, payment plan row IDs, etc.
 *
 * HOW IT WORKS:
 * Combines timestamp (for uniqueness across time) with random string
 * (for uniqueness within same millisecond).
 *
 * - Date.now() = milliseconds since 1970 (e.g., 1703980800000)
 * - .toString(36) = convert to base-36 (0-9 + a-z) for shorter string
 * - Math.random().toString(36).substr(2) = random alphanumeric string
 *
 * EXAMPLE OUTPUT: "lq5x7k2m" + "f8d3kx" = "lq5x7k2mf8d3kx"
 *
 * WHY NOT UUID: This is simpler and sufficient for client-side IDs.
 * We don't need cryptographic uniqueness.
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * debounce(func, wait)
 * ====================
 * Limits how often a function can be called.
 *
 * PROBLEM IT SOLVES:
 * When user types in an input field, the 'input' event fires on EVERY keystroke.
 * If we save to localStorage on every keystroke, that's wasteful.
 * If we update preview on every keystroke, it may feel laggy.
 *
 * SOLUTION:
 * Debounce waits until user STOPS typing for X milliseconds, then calls function.
 *
 * HOW IT WORKS:
 * 1. User types 'a' → start 300ms timer
 * 2. User types 'b' (50ms later) → CANCEL previous timer, start new 300ms timer
 * 3. User types 'c' (50ms later) → CANCEL previous timer, start new 300ms timer
 * 4. User stops typing → timer completes → function is called ONCE
 *
 * USAGE IN THIS APP:
 * - debouncedSave = debounce(saveFormData, 500)  → Save 500ms after last keystroke
 * - debouncedPreview = debounce(updatePreview, 150) → Update 150ms after last keystroke
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to wait (default: 300)
 * @returns {Function} A debounced version of the function
 */
export function debounce(func, wait = 300) {
    let timeout;  // Stores the timer ID

    return function executedFunction(...args) {
        // This function is called every time the event fires

        const later = () => {
            clearTimeout(timeout);  // Clean up
            func(...args);          // Finally call the original function
        };

        // Cancel any existing timer (this is the "debounce" part)
        clearTimeout(timeout);

        // Start a new timer
        timeout = setTimeout(later, wait);
    };
}

/* ============================================================================
   SECTION 3: DOM UTILITIES
   ============================================================================
   Shorthand functions for common DOM operations.
   These reduce boilerplate and make code more readable.
   ============================================================================ */

/**
 * getById(id)
 * ===========
 * Gets an element by its ID. Shorthand for document.getElementById().
 *
 * WHY: "getById(id)" is clearer than "document.getElementById(id)"
 *
 * EXAMPLE:
 * const input = getById('u_orig');  // Get the Original Price input
 * input.value = '2500000';
 */
export function getById(id) {
    return document.getElementById(id);
}

/**
 * queryOne(selector, parent)
 * ==========================
 * Queries for a single element. Shorthand for querySelector().
 * Returns the FIRST element matching the CSS selector.
 *
 * EXAMPLE:
 * const btn = queryOne('.btn-primary');           // First primary button
 * const input = queryOne('input', formElement);   // First input inside form
 */
export function queryOne(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * queryAll(selector, parent)
 * ==========================
 * Queries for all matching elements. Shorthand for querySelectorAll().
 * Returns ALL elements matching the CSS selector (as NodeList).
 *
 * EXAMPLE:
 * const allButtons = queryAll('.btn');           // All buttons
 * const formInputs = queryAll('input', form);    // All inputs in form
 *
 * NOTE: Returns NodeList, not Array. Use forEach() or convert with [...queryAll()]
 */
export function queryAll(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * on(el, event, handler)
 * ======================
 * Shorthand for addEventListener().
 * Can accept either an element or an ID string.
 *
 * EXAMPLE:
 * on('printBtn', 'click', handlePrint);     // Using ID
 * on(buttonElement, 'click', handleClick);  // Using element
 *
 * WHY ACCEPT BOTH:
 * Sometimes we have the element, sometimes just the ID.
 * This flexibility reduces code duplication.
 */
export function on(el, event, handler) {
    // If el is a string, treat it as an ID and get the element
    const element = typeof el === 'string' ? getById(el) : el;

    // Only add listener if element exists (prevents errors)
    if (element) {
        element.addEventListener(event, handler);
    }
}

/**
 * setText(id, text)
 * =================
 * Sets the text content of an element.
 *
 * USED FOR: Updating preview display values.
 *
 * SPECIAL BEHAVIOR:
 * If text is empty/null/undefined, displays '-' instead.
 * This is a design choice - empty fields show dash in preview.
 *
 * EXAMPLE:
 * setText('disp_project_name', 'The Palms');  // Shows "The Palms"
 * setText('disp_views', '');                   // Shows "-"
 */
export function setText(id, text) {
    const el = getById(id);
    if (el) {
        el.textContent = text || '-';  // Fallback to dash if empty
    }
}

/**
 * setValue(id, value)
 * ===================
 * Sets the value of an input or select element.
 *
 * USED FOR: Populating form fields when loading saved data.
 *
 * SPECIAL HANDLING FOR SELECT ELEMENTS:
 * - First tries exact match
 * - If no match, tries case-insensitive partial match
 * - If still no match, adds value as a new option (for flexibility)
 *
 * NULLISH COALESCING (??):
 * - value ?? '' means: use value, but if it's null/undefined, use ''
 * - This is different from (value || ''): that would also replace 0 and false
 *
 * EXAMPLE:
 * setValue('u_orig', 2500000);  // Sets Original Price to 2500000
 * setValue('u_views', null);     // Sets Views to '' (empty)
 */
export function setValue(id, value) {
    const el = getById(id);
    if (!el) return;

    const val = value ?? '';

    // Special handling for select elements
    if (el.tagName === 'SELECT') {
        // Try exact match first
        const options = Array.from(el.options);
        const exactMatch = options.find(opt => opt.value === val);

        if (exactMatch) {
            el.value = val;
            return;
        }

        // Try case-insensitive partial match
        const lowerVal = String(val).toLowerCase().trim();
        const partialMatch = options.find(opt => {
            const optVal = opt.value.toLowerCase().trim();
            return optVal === lowerVal ||
                   optVal.includes(lowerVal) ||
                   lowerVal.includes(optVal);
        });

        if (partialMatch) {
            el.value = partialMatch.value;
            return;
        }

        // No match found - add as new option if value is not empty
        if (val && String(val).trim()) {
            const newOption = document.createElement('option');
            newOption.value = val;
            newOption.textContent = val;
            el.appendChild(newOption);
            el.value = val;
        }
        return;
    }

    // Regular input element
    el.value = val;
}

/**
 * getValue(id)
 * ============
 * Gets the current value of an input element.
 *
 * RETURNS: The value as a string (input values are always strings)
 *
 * EXAMPLE:
 * const projectName = getValue('u_project');  // "The Palms"
 * const price = getValue('u_orig');           // "2500000" (string, not number!)
 */
export function getValue(id) {
    const el = getById(id);
    return el ? el.value : '';  // Return empty string if element doesn't exist
}

/**
 * getNumericValue(id)
 * ===================
 * Gets the value of an input element as a NUMBER.
 *
 * WHY NEEDED:
 * Input values are always strings. For calculations, we need numbers.
 * This handles the conversion and defaults to 0 for invalid input.
 *
 * EXAMPLE:
 * getNumericValue('u_orig')  // User typed "2500000" → returns 2500000 (number)
 * getNumericValue('u_orig')  // User typed "abc" → returns 0
 * getNumericValue('u_orig')  // Field is empty → returns 0
 *
 * USED IN: calculator.js for all price calculations
 */
export function getNumericValue(id) {
    const val = getValue(id);       // Get string value
    return parseFloat(val) || 0;    // Convert to number, default to 0
}

/* ============================================================================
   SECTION 4: VISIBILITY HELPERS
   ============================================================================
   Show/hide elements using the 'hidden' CSS class.
   The 'hidden' class is defined in main.css as: display: none !important;
   ============================================================================ */

/**
 * show(el)
 * ========
 * Makes an element visible by removing the 'hidden' class.
 *
 * EXAMPLE:
 * show('paymentPlanSection');        // Using ID
 * show(paymentPlanElement);          // Using element reference
 */
export function show(el) {
    const element = typeof el === 'string' ? getById(el) : el;
    if (element) {
        element.classList.remove('hidden');
    }
}

/**
 * hide(el)
 * ========
 * Hides an element by adding the 'hidden' class.
 *
 * EXAMPLE:
 * hide('readyPropertySection');  // Hide Ready Property fields when in Off-Plan mode
 */
export function hide(el) {
    const element = typeof el === 'string' ? getById(el) : el;
    if (element) {
        element.classList.add('hidden');
    }
}

/**
 * toggle(el, visible)
 * ===================
 * Toggle element visibility, or force a specific state.
 *
 * TWO MODES:
 * 1. toggle(el) - Flip between visible/hidden
 * 2. toggle(el, true/false) - Force to visible/hidden
 *
 * EXAMPLE:
 * toggle('modal');                 // Toggle modal visibility
 * toggle('modal', true);           // Force show
 * toggle('modal', false);          // Force hide
 * toggle('disp_row_original_price', showOriginal);  // Show/hide based on condition
 *
 * WHY SECOND PARAMETER:
 * Often we want to show/hide based on a condition, not just toggle.
 * This avoids needing separate if/else with show() and hide().
 */
export function toggle(el, visible) {
    const element = typeof el === 'string' ? getById(el) : el;
    if (element) {
        if (visible === undefined) {
            // No second param: toggle current state
            element.classList.toggle('hidden');
        } else {
            // Second param provided: force state
            // toggle('hidden', !visible) → if visible=true, remove 'hidden'; if false, add it
            element.classList.toggle('hidden', !visible);
        }
    }
}

/* ============================================================================
   SECTION 5: DATE UTILITIES
   ============================================================================ */

/**
 * formatDate(date)
 * ================
 * Formats a date in a readable format: "01 Jan 2024"
 *
 * WHY THIS FORMAT:
 * - Day-Month-Year is common in UAE/UK
 * - Month as text (Jan) is unambiguous (no 01/02 confusion)
 * - Year in full (2024) for clarity
 *
 * ACCEPTS:
 * - Date object: new Date()
 * - String: "2024-01-15"
 * - Number: timestamp in milliseconds
 *
 * EXAMPLE:
 * formatDate(new Date())           → "31 Dec 2024"
 * formatDate("2024-06-15")         → "15 Jun 2024"
 * formatDate(null)                 → ""
 */
export function formatDate(date) {
    if (!date) return '';

    const d = new Date(date);

    // Check if date is valid
    if (isNaN(d.getTime())) return date.toString();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const day = String(d.getDate()).padStart(2, '0');  // "01", "15", etc.
    const month = months[d.getMonth()];                 // "Jan", "Jun", etc.
    const year = d.getFullYear();                       // 2024

    return `${day} ${month} ${year}`;
}

/**
 * excelDateToJS(serial)
 * =====================
 * Converts an Excel date serial number to a JavaScript Date.
 *
 * WHY NEEDED:
 * Excel stores dates as numbers (days since Jan 1, 1900).
 * When importing Excel files, we get these serial numbers, not Date objects.
 *
 * EXCEL DATE SYSTEM:
 * - Serial 1 = January 1, 1900
 * - Serial 25569 = January 1, 1970 (Unix epoch)
 * - Serial 45658 = December 31, 2024
 *
 * FORMULA EXPLAINED:
 * - (serial - 25569): Days since Unix epoch (Jan 1, 1970)
 * - × 86400: Convert days to seconds (24 × 60 × 60)
 * - × 1000: Convert seconds to milliseconds (JS Date uses ms)
 *
 * EXAMPLE:
 * excelDateToJS(45658)  → Date object for Dec 31, 2024
 */
export function excelDateToJS(serial) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/* ============================================================================
   SECTION 6: DOM CREATION
   ============================================================================
   Functions for programmatically creating HTML elements.
   Used for dynamic UI components (modals, toasts, payment plan rows, etc.)
   ============================================================================ */

/**
 * createElement(tag, attrs, children)
 * ====================================
 * Creates an HTML element with attributes and children in a single call.
 *
 * WHY NEEDED:
 * Standard DOM creation is verbose:
 *   const div = document.createElement('div');
 *   div.className = 'modal';
 *   div.id = 'myModal';
 *   div.textContent = 'Hello';
 *   parent.appendChild(div);
 *
 * This helper condenses it to one line:
 *   const div = createElement('div', {className: 'modal', id: 'myModal'}, 'Hello');
 *
 * PARAMETERS:
 * @param {string} tag - HTML tag name (e.g., 'div', 'button', 'input')
 * @param {Object} attrs - Attributes object with special handling:
 *   - className: Sets el.className (can't use 'class' as it's reserved in JS)
 *   - style: Object of CSS properties → merged into el.style
 *   - onClick, onInput, etc.: Event handlers → converted to addEventListener
 *   - dataset: Object for data-* attributes → merged into el.dataset
 *   - Any other key: Set as HTML attribute via setAttribute()
 * @param {string|HTMLElement|Array} children - Content to add:
 *   - String: Set as textContent
 *   - HTMLElement: Append as child
 *   - Array: Process each item (strings become text nodes, elements appended)
 *
 * EXAMPLES:
 *
 * Simple element:
 *   createElement('div', {className: 'container'}, 'Hello World')
 *   → <div class="container">Hello World</div>
 *
 * With event handler:
 *   createElement('button', {onClick: handleClick}, 'Click Me')
 *   → <button>Click Me</button> with click listener attached
 *
 * With inline styles:
 *   createElement('div', {style: {backgroundColor: 'red', padding: '10px'}})
 *   → <div style="background-color: red; padding: 10px;"></div>
 *
 * With data attributes:
 *   createElement('div', {dataset: {id: '123', status: 'active'}})
 *   → <div data-id="123" data-status="active"></div>
 *
 * Nested elements:
 *   createElement('ul', {className: 'list'}, [
 *       createElement('li', {}, 'Item 1'),
 *       createElement('li', {}, 'Item 2')
 *   ])
 *   → <ul class="list"><li>Item 1</li><li>Item 2</li></ul>
 *
 * @returns {HTMLElement} The created element
 */
export function createElement(tag, attrs = {}, children = null) {
    // Create the base element
    const el = document.createElement(tag);

    // Process each attribute in the attrs object
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            // SPECIAL CASE: className → el.className
            // We use 'className' because 'class' is a reserved word in JS
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            // SPECIAL CASE: style object → merge into el.style
            // Example: {backgroundColor: 'red'} → el.style.backgroundColor = 'red'
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            // SPECIAL CASE: Event handlers (onClick, onInput, etc.)
            // 'onClick' → addEventListener('click', fn)
            // slice(2) removes 'on', toLowerCase() makes 'Click' → 'click'
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset' && typeof value === 'object') {
            // SPECIAL CASE: data-* attributes via dataset object
            // {dataset: {id: '123'}} → el.dataset.id = '123' → data-id="123"
            Object.assign(el.dataset, value);
        } else {
            // DEFAULT: Regular HTML attribute
            // 'id' → el.setAttribute('id', value)
            // 'type' → el.setAttribute('type', value)
            el.setAttribute(key, value);
        }
    }

    // Process children (content inside the element)
    if (children) {
        if (Array.isArray(children)) {
            // ARRAY: Multiple children - process each
            children.forEach(child => {
                if (typeof child === 'string') {
                    // String → create text node (safe, no HTML parsing)
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    // HTMLElement → append directly
                    el.appendChild(child);
                }
            });
        } else if (typeof children === 'string') {
            // SINGLE STRING: Set as text content (safe, escapes HTML)
            el.textContent = children;
        } else if (children instanceof HTMLElement) {
            // SINGLE ELEMENT: Append as child
            el.appendChild(children);
        }
    }

    return el;
}

/* ============================================================================
   SECTION 7: NOTIFICATIONS (TOAST)
   ============================================================================
   Toast notifications are small, temporary messages that appear in the corner
   of the screen to give feedback to the user (success, error, info).
   They auto-dismiss after a few seconds.
   ============================================================================ */

/**
 * toast(message, type, duration)
 * ==============================
 * Shows a temporary notification message in the bottom-right corner.
 *
 * WHAT IS A TOAST:
 * A small, non-blocking notification that appears briefly and disappears.
 * Named after toast popping up from a toaster.
 * Common in mobile apps and modern web UIs.
 *
 * PARAMETERS:
 * @param {string} message - Text to display (e.g., "Template saved successfully")
 * @param {string} type - Determines color:
 *   - 'success' → Green (#10b981) - Used for confirmations
 *   - 'error' → Red (#ef4444) - Used for failures
 *   - 'info' → Blue (#3b82f6) - Used for neutral info (default)
 * @param {number} duration - How long to show in milliseconds (default: 3000 = 3 seconds)
 *
 * BEHAVIOR:
 * 1. Any existing toast is removed (only one at a time)
 * 2. New toast slides in from right edge
 * 3. After duration, slides out and is removed from DOM
 *
 * ACCESSIBILITY:
 * - role="alert": Screen readers announce immediately
 * - aria-live="assertive": Interrupts current speech
 * - aria-atomic="true": Read entire element, not just changes
 *
 * EXAMPLES:
 * toast('Saved successfully', 'success');        // Green, 3s
 * toast('Failed to save', 'error');              // Red, 3s
 * toast('Processing...', 'info', 5000);          // Blue, 5s
 */
export function toast(message, type = 'info', duration = 3000) {
    // STEP 1: Remove any existing toast (only show one at a time)
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    // STEP 2: Create the toast element using our createElement helper
    const toastEl = createElement('div', {
        className: `toast-notification toast-${type}`,
        // Accessibility attributes for screen readers
        role: 'alert',                    // This is an alert message
        'aria-live': 'assertive',         // Announce immediately
        'aria-atomic': 'true',            // Read whole element
        // Inline styles for positioning and appearance
        style: {
            position: 'fixed',            // Fixed to viewport, not page
            bottom: '20px',               // 20px from bottom
            right: '20px',                // 20px from right
            padding: '12px 20px',         // Internal spacing
            borderRadius: '8px',          // Rounded corners
            color: 'white',               // White text
            fontWeight: '500',            // Medium weight
            fontSize: '14px',             // Readable size
            zIndex: '9999',               // Above everything else
            animation: 'slideIn 0.3s ease',  // Slide in from right
            // Color based on type
            backgroundColor: { success: '#10b981', error: '#ef4444', info: '#3b82f6' }[type] || '#3b82f6'
        }
    }, message);  // The message text goes inside the div

    // STEP 3: Add toast to page
    document.body.appendChild(toastEl);

    // STEP 4: Set up auto-dismiss after duration
    setTimeout(() => {
        // Start slide-out animation
        toastEl.style.animation = 'slideOut 0.3s ease';
        // After animation completes (300ms), remove from DOM
        setTimeout(() => toastEl.remove(), 300);
    }, duration);
}

/* ============================================================================
   SECTION 8: SECURITY - INPUT SANITIZATION
   ============================================================================
   Functions to prevent Cross-Site Scripting (XSS) attacks.

   WHAT IS XSS:
   An attack where malicious scripts are injected into trusted websites.
   Example: User enters "<script>stealCookies()</script>" in a text field.
   If displayed without escaping, the script executes and steals data.

   DEFENSE: Always sanitize/escape user input before displaying.
   ============================================================================ */

/**
 * escapeHtml(str)
 * ===============
 * Converts HTML special characters to their safe entity equivalents.
 *
 * WHAT IT DOES:
 * Replaces characters that have special meaning in HTML:
 * - < becomes &lt;
 * - > becomes &gt;
 * - & becomes &amp;
 * - " becomes &quot;
 * - ' becomes &#39;
 *
 * WHY THE DOM TRICK:
 * We use the browser's built-in escaping by setting textContent (which escapes)
 * and reading innerHTML (which gives us the escaped version).
 * This is safer than manual regex replacement.
 *
 * EXAMPLE:
 * escapeHtml('<script>alert("XSS")</script>')
 * → '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 *
 * This renders as visible text, not as executable script.
 *
 * @param {string} str - String that may contain HTML
 * @returns {string} String with HTML entities escaped
 */
export function escapeHtml(str) {
    if (!str) return '';

    // Create a temporary div element
    const div = document.createElement('div');

    // textContent automatically escapes HTML
    // The browser interprets this as plain text, not HTML
    div.textContent = str;

    // innerHTML gives us the escaped version
    // '<script>' → '&lt;script&gt;'
    return div.innerHTML;
}

/**
 * sanitizeInput(str)
 * ==================
 * Removes potentially dangerous patterns from user input.
 *
 * DIFFERENCE FROM escapeHtml:
 * - escapeHtml: Converts dangerous chars to safe entities (still visible)
 * - sanitizeInput: REMOVES dangerous content entirely
 *
 * WHAT IT REMOVES:
 *
 * 1. Angle brackets < > (HTML tags)
 *    Attack: "<img src=x onerror=alert('XSS')>"
 *    Result: "img src=x onerror=alert('XSS')"
 *
 * 2. javascript: protocol
 *    Attack: "<a href='javascript:stealCookies()'>"
 *    Result: "<a href='stealCookies()'>"
 *
 * 3. Event handlers (onclick, onerror, onload, etc.)
 *    Attack: "<img src=x onerror=malicious()>"
 *    Result: "<img src=x malicious()>"
 *
 * REGEX EXPLAINED:
 * - /[<>]/g = any < or > character, globally
 * - /javascript:/gi = "javascript:" case-insensitive
 * - /on\w+=/gi = "on" + word chars + "=" (matches onclick=, onerror=, etc.)
 *
 * @param {string} str - User input to sanitize
 * @returns {string} Sanitized string with dangerous patterns removed
 */
export function sanitizeInput(str) {
    if (!str) return '';

    return String(str)
        // Remove < and > (prevents HTML tags)
        .replace(/[<>]/g, '')
        // Remove javascript: protocol (prevents script execution in links)
        .replace(/javascript:/gi, '')
        // Remove event handlers like onclick=, onerror=, onload=
        // \w+ matches one or more word characters (a-z, A-Z, 0-9, _)
        .replace(/on\w+=/gi, '')
        // Remove leading/trailing whitespace
        .trim();
}

/* ============================================================================
   SECTION 9: FILE VALIDATION & IMAGE PROCESSING
   ============================================================================
   Security-focused file validation and image compression utilities.

   WHY FILE VALIDATION MATTERS:
   Users can rename malicious files (e.g., malware.exe → photo.jpg).
   We can't trust file extensions alone - we must verify the actual content.
   ============================================================================ */

/**
 * validateFileType(file, allowedTypes)
 * =====================================
 * Validates a file using multiple security checks.
 *
 * THREE LAYERS OF VALIDATION:
 *
 * 1. FILE EXTENSION CHECK
 *    - Checks the filename ends with expected extension
 *    - "photo.jpg" ✓, "virus.exe" ✗
 *    - Easy to bypass (just rename file), but catches accidents
 *
 * 2. MIME TYPE CHECK
 *    - Checks the browser-reported file type
 *    - file.type === 'image/jpeg' ✓
 *    - Can be spoofed, but another layer of defense
 *
 * 3. MAGIC BYTES CHECK (most reliable)
 *    - Reads the actual first bytes of the file
 *    - Every file format has a unique "signature" at the start
 *    - JPEG files start with: FF D8 FF
 *    - PNG files start with: 89 50 4E 47 (‰PNG)
 *    - Can't be faked without breaking the file
 *
 * WHAT ARE MAGIC BYTES:
 * The first few bytes of a file that identify its format.
 * Also called "file signatures" or "magic numbers".
 * Example: Open any JPEG in a hex editor - first bytes are always FF D8 FF.
 *
 * @param {File} file - The file to validate
 * @param {string[]} allowedTypes - MIME type prefixes (e.g., ['image/'])
 * @returns {Promise<boolean>} True if file passes all checks
 *
 * EXAMPLE:
 * const isValid = await validateFileType(uploadedFile, ['image/']);
 * if (!isValid) {
 *     toast('Invalid file type', 'error');
 *     return;
 * }
 */
export async function validateFileType(file, allowedTypes = ['image/']) {
    // ===========================================
    // LAYER 1: FILE EXTENSION CHECK
    // ===========================================

    // Map of MIME type prefixes to allowed file extensions
    const allowedExtensions = {
        'image/': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
        'application/pdf': ['.pdf'],
        'application/': ['.xlsx', '.xls', '.json']
    };

    const fileName = file.name.toLowerCase();
    let extensionValid = false;

    // Check if file extension matches any allowed extension
    for (const [type, extensions] of Object.entries(allowedExtensions)) {
        // Check if this type category is in our allowed list
        if (allowedTypes.some(t => t.startsWith(type.split('/')[0]))) {
            // Check if filename ends with any allowed extension
            if (extensions.some(ext => fileName.endsWith(ext))) {
                extensionValid = true;
                break;
            }
        }
    }

    if (!extensionValid) {
        return false;  // Extension not in whitelist
    }

    // ===========================================
    // LAYER 2: MIME TYPE CHECK
    // ===========================================

    // Check browser-reported MIME type
    if (!allowedTypes.some(type => file.type.startsWith(type))) {
        return false;  // MIME type doesn't match
    }

    // ===========================================
    // LAYER 3: MAGIC BYTES CHECK (images only)
    // ===========================================

    // For images, verify the actual file content
    if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                // Read file bytes into array
                const arr = new Uint8Array(e.target.result);

                // Known file signatures (magic bytes)
                // Hexadecimal values of first bytes for each format
                const signatures = {
                    jpeg: [0xFF, 0xD8, 0xFF],              // JPEG: FF D8 FF
                    png: [0x89, 0x50, 0x4E, 0x47],         // PNG: ‰PNG (89 50 4E 47)
                    gif: [0x47, 0x49, 0x46],              // GIF: GIF (47 49 46)
                    webp: [0x52, 0x49, 0x46, 0x46],       // WebP: RIFF (52 49 46 46)
                    bmp: [0x42, 0x4D]                      // BMP: BM (42 4D)
                };

                // Check if file starts with any known signature
                let isValid = false;
                for (const [, sig] of Object.entries(signatures)) {
                    // Compare each byte of signature to file bytes
                    if (sig.every((byte, i) => arr[i] === byte)) {
                        isValid = true;
                        break;
                    }
                }

                resolve(isValid);
            };

            reader.onerror = () => resolve(false);

            // Only read first 16 bytes (enough for any signature)
            reader.readAsArrayBuffer(file.slice(0, 16));
        });
    }

    // Non-image files pass if extension and MIME checks passed
    return true;
}

/**
 * checkFileSize(file, maxSizeMB)
 * ==============================
 * Checks if a file is within the allowed size limit.
 *
 * WHY SIZE LIMITS:
 * - localStorage has ~5MB limit (varies by browser)
 * - Large images slow down the app
 * - Printing/export may fail with huge images
 * - Network transfers are slow with large files
 *
 * SIZE MATH:
 * - 1 KB (kilobyte) = 1024 bytes
 * - 1 MB (megabyte) = 1024 KB = 1,048,576 bytes
 * - maxSizeMB × 1024 × 1024 = max bytes allowed
 *
 * @param {File} file - File to check
 * @param {number} maxSizeMB - Maximum size in megabytes (default: 50MB)
 * @returns {boolean} True if file is within limit
 *
 * EXAMPLE:
 * if (!checkFileSize(uploadedFile, 5)) {
 *     toast('File too large. Maximum size is 5MB.', 'error');
 *     return;
 * }
 */
export function checkFileSize(file, maxSizeMB = 50) {
    // Convert MB to bytes: MB × 1024 (KB) × 1024 (bytes)
    const maxBytes = maxSizeMB * 1024 * 1024;

    // file.size is in bytes
    return file.size <= maxBytes;
}

/**
 * fileToBase64(file)
 * ==================
 * Converts a File or Blob object to a base64 data URL string.
 *
 * PART OF DUAL STORAGE STRATEGY:
 * Used to convert original images stored in window.originalImages
 * back to base64 format for PDF generation.
 *
 * WHY NEEDED:
 * - window.originalImages stores File/Blob objects (efficient, no encoding)
 * - PDF generation needs base64 data URLs
 * - This converts on-demand when generating PDF
 *
 * HOW IT WORKS:
 * 1. FileReader.readAsDataURL() reads file contents
 * 2. Returns data URL format: "data:image/jpeg;base64,/9j/4AAQ..."
 * 3. This string can be used directly in <img src="...">
 *
 * @param {File|Blob} file - File or Blob to convert
 * @returns {Promise<string>} Base64 data URL string
 *
 * EXAMPLE:
 * const originalFile = window.originalImages.floorPlan;
 * const base64 = await fileToBase64(originalFile);
 * // base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            // reader.result contains the data URL
            resolve(reader.result);
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        // Read file as data URL (base64 encoded)
        reader.readAsDataURL(file);
    });
}

/**
 * compressImageFile(file, maxWidth, quality)
 * ==========================================
 * Compresses and resizes an image to reduce storage size.
 *
 * WHY COMPRESS:
 * - Modern phone cameras take 4000px+ images (several MB each)
 * - localStorage has ~5MB limit total
 * - For preview/printing, 800px width is sufficient
 * - Compression can reduce file size 80-90%
 *
 * HOW IT WORKS:
 *
 * 1. READ FILE → Convert file to Data URL (base64 string)
 *    File → FileReader → "data:image/jpeg;base64,/9j/4AAQ..."
 *
 * 2. LOAD INTO IMAGE → Create Image element to get dimensions
 *    img.src = dataUrl → img.width/height available
 *
 * 3. RESIZE ON CANVAS → Scale down if larger than maxWidth
 *    4000px wide → scaled to 800px (height proportionally)
 *
 * 4. EXPORT AS JPEG → Canvas → base64 with quality compression
 *    PNG is lossless (large), JPEG is lossy (smaller)
 *    Quality 0.7 = 70% quality (good balance)
 *
 * 5. COMPARE SIZES → Use compressed only if smaller
 *    Sometimes small images get larger with JPEG (rare but possible)
 *
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width in pixels (default: 800)
 * @param {number} quality - JPEG quality 0-1 (default: 0.7 = 70%)
 * @returns {Promise<string>} Base64 data URL of compressed image
 *
 * EXAMPLE:
 * const compressedBase64 = await compressImageFile(uploadedFile, 800, 0.7);
 * document.getElementById('preview').src = compressedBase64;
 * saveToLocalStorage(compressedBase64);  // Much smaller now!
 */
export function compressImageFile(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            // STEP 1: Create an Image element to load the file
            const img = new Image();

            img.onload = () => {
                // STEP 2: Create a canvas for resizing
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // STEP 3: Calculate new dimensions (maintain aspect ratio)
                if (width > maxWidth) {
                    // Example: 4000 × 3000 image, maxWidth 800
                    // height = 3000 × (800 / 4000) = 600
                    // Result: 800 × 600 (same 4:3 ratio)
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                // Set canvas to new dimensions
                canvas.width = width;
                canvas.height = height;

                // STEP 4: Draw the image onto the canvas (this resizes it)
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // STEP 5: Export as base64
                // Keep PNG for PNGs (transparency), convert others to JPEG
                const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

                // toDataURL(mimeType, quality) → "data:image/jpeg;base64,..."
                // quality only affects JPEG/WebP, ignored for PNG
                const compressed = canvas.toDataURL(mimeType, quality);

                // STEP 6: Use smaller version
                // Sometimes small images get larger after processing
                if (compressed.length > e.target.result.length) {
                    resolve(e.target.result);  // Original was smaller
                } else {
                    resolve(compressed);  // Compressed is smaller
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));

            // Load the image from the file data
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));

        // Read file as Data URL (base64)
        reader.readAsDataURL(file);
    });
}

/* ============================================================================
   SECTION 10: CSS INJECTION (TOAST ANIMATIONS)
   ============================================================================
   This code runs ONCE when the module loads.
   It injects CSS animations needed by the toast() function into the page.

   WHY INJECT CSS FROM JS:
   - Toast animations are only needed if toast() is called
   - Keeps animation CSS bundled with the toast function (co-location)
   - Avoids needing to add rules to main.css

   HOW IT WORKS:
   1. Create a <style> element
   2. Add CSS text content
   3. Append to <head>
   Result: CSS rules are now available to the browser
   ============================================================================ */

// Create a <style> element to hold our CSS
const style = document.createElement('style');

// Define the keyframe animations for toast slide in/out
style.textContent = `
    /*
     * slideIn Animation
     * Used when toast appears
     * - Starts off-screen to the right (translateX 100%)
     * - Ends at normal position (translateX 0)
     * - Fades in from invisible to visible
     * Duration: 0.3s (set in toast() function)
     */
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    /*
     * slideOut Animation
     * Used when toast disappears
     * - Starts at normal position
     * - Slides off-screen to the right
     * - Fades out to invisible
     * Duration: 0.3s (set in toast() function)
     */
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;

// Inject the <style> element into the document <head>
// This makes the animations available to any element using them
document.head.appendChild(style);

/* ============================================================================
   SECTION 8: LOADING STATE UTILITIES (M-04)
   ============================================================================
   Functions for managing loading states during async operations.
   Uses a full-screen overlay with spinner for major operations.
   ============================================================================ */

/**
 * showLoading(message)
 * ====================
 * Display the loading overlay with a custom message.
 * 
 * @param {string} message - Text to display under the spinner
 * 
 * EXAMPLE:
 * showLoading('Generating PDF...');
 * await generatePDF();
 * hideLoading();
 */
export function showLoading(message = 'Loading...') {
    const overlay = getById('loadingOverlay');
    const text = getById('loadingText');
    
    if (overlay) {
        if (text) text.textContent = message;
        overlay.setAttribute('aria-busy', 'true');
        overlay.classList.add('visible');
    }
}

/**
 * hideLoading()
 * =============
 * Hide the loading overlay.
 * Always call this in a finally block to ensure cleanup.
 * 
 * EXAMPLE:
 * try {
 *     showLoading('Processing...');
 *     await doSomething();
 * } finally {
 *     hideLoading();
 * }
 */
export function hideLoading() {
    const overlay = getById('loadingOverlay');
    
    if (overlay) {
        overlay.setAttribute('aria-busy', 'false');
        overlay.classList.remove('visible');
    }
}

/**
 * withLoading(asyncFn, message)
 * ============================
 * Execute an async function with automatic loading state management.
 * Shows loading before execution, hides after completion or error.
 * 
 * @param {Function} asyncFn - Async function to execute
 * @param {string} message - Loading message to display
 * @returns {Promise<any>} - Result from asyncFn
 * 
 * EXAMPLE:
 * const result = await withLoading(
 *     () => generatePDF(data),
 *     'Generating PDF...'
 * );
 */
export async function withLoading(asyncFn, message = 'Loading...') {
    showLoading(message);
    try {
        return await asyncFn();
    } finally {
        hideLoading();
    }
}
