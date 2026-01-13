# AUDIT TODO
**Project:** SalesHUB | **Started:** 2026-01-13

## Progress: ░░░░░░░░░░ 0% (0/43)

---

## 🔴 Critical (Do First) - 3 items

- [ ] **C-01** Fix Object URL Memory Leak
  - Location: `js/app.js:171-177`
  - Action: Add URL.revokeObjectURL() in clearForm() and on image replacement
  - Effort: S (1-2h)
  - From: Finding C-01
  - Test: Monitor memory in DevTools after 10+ form clears

- [ ] **C-02** Fix deepMerge() Array Bug
  - Location: `js/modules/storage.js:977-1002`
  - Action: Add Array.isArray() check before recursive merge
  - Effort: S (1h)
  - From: Finding C-02
  - Test: Verify payment plans and templates restore correctly

- [ ] **C-03** Fix Color Contrast Violations
  - Location: `css/main.css:132`, `css/preview.css:399`
  - Action: Update --text-muted to #6b7280 for WCAG AA compliance
  - Effort: S (1h)
  - From: Finding C-03
  - Test: Run contrast checker tool

---

## 🟠 High Priority - 10 items

- [ ] **H-01** Add Missing Form Labels and ARIA
  - Location: `index.html:340-349, 682, 706`
  - Action: Add id, label, and aria attributes to all form fields
  - Effort: M (3-4h)
  - From: Finding H-01

- [ ] **H-02** Fix Touch Target Sizes
  - Location: `css/main.css:747`, `css/beta.css:640`
  - Action: Increase minimum touch targets to 44x44px
  - Effort: S (2h)
  - From: Finding H-02

- [ ] **H-03** Standardize Focus Indicators
  - Location: `css/main.css`, `css/preview.css`
  - Action: Add consistent :focus-visible styles across all interactive elements
  - Effort: S (2h)
  - From: Finding H-03

- [ ] **H-04** Fix Print Stylesheet Issues
  - Location: `css/print.css:75, 168-172, 226-231`
  - Action: Fix image distortion, remove gradients, prevent table splits
  - Effort: M (3h)
  - From: Finding H-04

- [ ] **H-05** Add Payment Plan Loop Guard
  - Location: `js/modules/paymentPlan.js:148-168`
  - Action: Add MAX_ITERATIONS check to prevent infinite loops
  - Effort: XS (30min)
  - From: Finding H-05

- [ ] **H-06** Improve Storage Quota Handling
  - Location: `js/modules/storage.js:314-346`
  - Action: Check quota before save, show warning, provide cleanup option
  - Effort: M (3h)
  - From: Finding H-06

- [ ] **H-07** Add Frontend Retry Logic
  - Location: `js/modules/pdfExport.js:187`
  - Action: Implement fetchWithRetry with exponential backoff
  - Effort: M (4h)
  - From: Finding H-07

- [ ] **H-08** Add Calculator Input Validation
  - Location: `js/modules/calculator.js:133-148`
  - Action: Validate percentages ≤100, numbers positive
  - Effort: S (2h)
  - From: Finding H-08

- [ ] **H-09** Expand Validator Rules
  - Location: `js/modules/validator.js:8-24`
  - Action: Add validation for all financial fields and required fields
  - Effort: M (4h)
  - From: Finding H-09

- [ ] **H-10** Fix Beta Features Memory Leak
  - Location: `js/modules/beta.js:75-95`
  - Action: Store and cleanup event listeners when beta toggled
  - Effort: S (1h)
  - From: Finding H-10

---

## 🟡 Medium Priority - 18 items

- [ ] **M-01** Organize CSS Variables
  - Location: `css/main.css:113-162`
  - Action: Group CSS variables by category (colors, spacing, typography)
  - Effort: S

- [ ] **M-02** Remove Redundant CSS Rules
  - Location: Multiple CSS files
  - Action: Deduplicate and consolidate repeated styles
  - Effort: M

- [ ] **M-03** Add Tablet Breakpoint
  - Location: `css/main.css:1625-1662`
  - Action: Add media query for 1024px breakpoint
  - Effort: S

- [ ] **M-04** Complete Reduced Motion Support
  - Location: `css/main.css:1609-1617`
  - Action: Apply prefers-reduced-motion to all animations
  - Effort: S

- [ ] **M-05** Standardize Z-Index Scale
  - Location: Multiple CSS files
  - Action: Create z-index variable scale, replace magic numbers
  - Effort: S

- [ ] **M-06** Improve Semantic HTML
  - Location: `index.html:777`
  - Action: Use article/section/aside elements appropriately
  - Effort: M

- [ ] **M-07** Add ARIA Relationships
  - Location: `index.html:341`
  - Action: Add aria-describedby, aria-controls where needed
  - Effort: S

- [ ] **M-08** Announce Validation Messages
  - Location: `index.html:710`
  - Action: Use aria-live regions for dynamic validation
  - Effort: S

- [ ] **M-09** Fix Column Height Clipping
  - Location: `css/templates/landscape.css:161`
  - Action: Use min-height instead of fixed height
  - Effort: XS

- [ ] **M-10** Fix Header Gradient Print Issue
  - Location: `css/templates/minimal.css:86`
  - Action: Add print-specific solid color fallback
  - Effort: XS

- [ ] **M-11** Sanitize Excel Import Data
  - Location: `js/modules/excel.js:236-241`
  - Action: Validate and sanitize imported values
  - Effort: M

- [ ] **M-12** Add CSRF Protection
  - Location: `js/modules/pdfExport.js`
  - Action: Implement CSRF token for API calls
  - Effort: M

- [ ] **M-13** Validate Branding Color
  - Location: `js/modules/branding.js:62-84`
  - Action: Validate hex color format before saving
  - Effort: XS

- [ ] **M-14** Clear Invalid Fields on Category Change
  - Location: `js/modules/category.js:369-410`
  - Action: Reset category-specific fields when switching
  - Effort: S

- [ ] **M-15** Add Backend Fetch Timeout
  - Location: `backend/src/services/pdfService.js:338`
  - Action: Add timeout to external image fetches
  - Effort: S

- [ ] **M-16** Handle Library Loading Failures
  - Location: `js/modules/excel.js:74-78`
  - Action: Show user-friendly error when SheetJS fails to load
  - Effort: S

- [ ] **M-17** Add Loading State UI
  - Location: `js/modules/export.js:46-85`
  - Action: Show progress indicator for long export operations
  - Effort: M

- [ ] **M-18** Fix Timeout Race Condition
  - Location: `backend/src/controllers/pdfController.js:36-48`
  - Action: Clear timeout on successful response
  - Effort: S

---

## 🟢 Low Priority - 12 items

- [ ] **L-01** Standardize CSS Comments
  - Location: Multiple CSS files
  - Action: Use consistent comment format throughout
  - Effort: XS

- [ ] **L-02** Replace Magic Numbers
  - Location: Multiple files
  - Action: Extract 6px, 12px, 8mm etc. to named variables
  - Effort: S

- [ ] **L-03** Add Vendor Prefixes
  - Location: Multiple CSS files
  - Action: Add -webkit-, -moz- prefixes where needed
  - Effort: XS

- [ ] **L-04** Improve Color Palette
  - Location: `css/main.css`
  - Action: Evaluate WCAG AAA compliance for full palette
  - Effort: S

- [ ] **L-05** Enhance Print Page Breaks
  - Location: `css/print.css`
  - Action: Add comprehensive break-inside, break-before rules
  - Effort: S

- [ ] **L-06** Evaluate CSS Grid
  - Location: `css/main.css`
  - Action: Consider CSS Grid for main layout
  - Effort: M

- [ ] **L-07** Add CSS Variable Fallbacks
  - Location: Multiple CSS files
  - Action: Add fallback values for older browser support
  - Effort: S

- [ ] **L-08** Smooth Template Switching
  - Location: `css/templates/*.css`
  - Action: Add fade transition to prevent flash on switch
  - Effort: S

- [ ] **L-09** Beta Toggle Gradient Fallback
  - Location: `css/beta.css`
  - Action: Add solid color fallback for gradient
  - Effort: XS

- [ ] **L-10** Make Storage Key Configurable
  - Location: `js/modules/storage.js:55`
  - Action: Extract 'salesOfferApp' to config constant
  - Effort: XS

- [ ] **L-11** Remove Production Console Logs
  - Location: Multiple JS files
  - Action: Remove or gate console.log statements
  - Effort: S

- [ ] **L-12** Improve generateId() Collision Resistance
  - Location: `js/utils/helpers.js:195-197`
  - Action: Use crypto.randomUUID() or longer random string
  - Effort: XS

---

## Completed

| Date | ID | Notes |
|------|-----|-------|
| 2026-01-13 | - | Initial audit completed |

---

## Metrics Dashboard

### Current (2026-01-13)
| Metric | Value | Status |
|--------|-------|--------|
| Health Score | 68/100 | 🟡 CAUTION |
| Test Coverage | 60% | 🟡 CAUTION |
| Critical Issues | 3 | 🔴 |
| High Issues | 10 | 🟠 |
| Security Vulns | 5 (dev only) | 🟡 |

### Target (After All Tasks)
| Metric | Value | Status |
|--------|-------|--------|
| Health Score | 85/100 | 🟢 HEALTHY |
| Test Coverage | 80% | 🟢 HEALTHY |
| Critical Issues | 0 | 🟢 |
| High Issues | 2 | 🟢 |
| Security Vulns | 0 | 🟢 |

---

## Quick Reference

**Effort Scale:**
- XS = < 30 minutes
- S = 1-2 hours
- M = 3-4 hours
- L = 5-8 hours
- XL = > 8 hours

**Priority Guide:**
- 🔴 Critical = Data loss, security, crashes
- 🟠 High = Accessibility, stability, UX
- 🟡 Medium = Code quality, maintainability
- 🟢 Low = Polish, optimization
