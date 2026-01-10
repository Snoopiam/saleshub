# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SalesHUB is a browser-based real estate sales offer document generator for UAE properties. It creates printable A4 documents with property details, financial breakdowns, floor plans, and payment plans. The app runs entirely client-side with localStorage persistence.

## Commands

```bash
npm start              # Start http-server on port 8000
npm test               # Run all tests with Vitest
npm test calculator    # Run tests matching "calculator"
npm run test:coverage  # Run tests with coverage report
npm run lint           # ESLint check on js/ directory
npm run lint:fix       # Auto-fix ESLint issues
```

## Architecture

### Module System

ES Modules throughout. Entry point is `js/app.js` which imports and initializes all feature modules:

```
js/app.js (orchestrator)
├── js/utils/helpers.js     # Shared utilities (DOM, formatting, validation)
└── js/modules/
    ├── calculator.js       # Auto-calculation with lock/unlock feature
    ├── storage.js          # localStorage persistence (single key: 'salesOfferApp')
    ├── category.js         # Off-Plan vs Ready Property mode switching
    ├── paymentPlan.js      # Drag-drop payment milestone table
    ├── branding.js         # Company logo/colors customization
    ├── validator.js        # Field validation
    ├── templates.js        # Template selector UI
    ├── export.js           # PDF/image/JSON export (html2pdf.js for high-quality PDFs)
    ├── excel.js            # Excel import via SheetJS
    ├── ai.js               # Google Gemini document parsing (Beta)
    └── beta.js             # Beta features panel
```

### Data Flow

1. User input → `app.js` event listeners → debounced save/preview
2. `calculator.js` computes derived fields (totals, fees, premiums)
3. `storage.js` persists to localStorage under single key `salesOfferApp`
4. `updatePreview()` in `app.js` syncs form data to A4 preview panel

### Key Patterns

**Calculator Lock System**: Fields can be "locked" to override auto-calculation. Check `isFieldLocked()` before computing. Lock states persist in localStorage.

**Category System**: Two modes - "offplan" (resale with payment plans) and "ready" (completed properties). Category stored in localStorage as `propertyCategory`. Calculator reads this to determine total calculation formula.

**Circular Dependency Avoidance**: `calculator.js` reads category from localStorage directly instead of importing from `category.js` to avoid circular imports.

**Event-Driven Updates**: Custom events like `dataImported`, `categoryChanged`, `unitTypeChanged` trigger preview updates across modules.

### Property Types

- **Standard (Apartments)**: Internal + Balcony areas
- **Villa/Townhouse**: Internal + Terrace + BUA + GFA + Plot Size
- **Plot**: Plot Size + Allowed Build Area

### CDN Dependencies

Libraries loaded via CDN (not npm): Tailwind CSS, SheetJS (xlsx), html2pdf.js, SortableJS

### PDF Generation

PDF export uses html2pdf.js to capture the live preview as a high-quality screenshot. Settings: PNG format (lossless), scale 4x for high resolution, matches preview exactly.

## Testing

Tests in `tests/` use Vitest with jsdom environment. Test files mirror module structure (e.g., `calculator.test.js` tests `calculator.js`).

## CSS Structure

- `css/main.css` - Input panel and UI styling
- `css/preview.css` - A4 document preview styling
- `css/print.css` - Print-specific styles
- `css/beta.css` - Beta features panel
- `css/templates/` - Template-specific stylesheets

## Field ID Conventions

- `input-*` - Standard calculated fields
- `u_*` - User input fields (legacy naming)
- `disp_*` - Preview display elements
- `display-*` - Alternative preview elements
