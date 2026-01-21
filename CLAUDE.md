# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SalesHUB is a real estate sales offer document generator for UAE properties. It creates A4 documents with property details, financial breakdowns, floor plans, and payment plans. The app has a browser frontend with localStorage persistence and an Express backend for high-quality PDF generation via Puppeteer.

## Commands

```bash
npm start              # Start Express server on port 8000 (serves frontend + PDF API)
npm run dev            # Start with nodemon for auto-reload
npm test               # Run all tests with Vitest
npm test calculator    # Run tests matching "calculator"
npm run test:coverage  # Run tests with coverage report
npm run lint           # ESLint check on js/ and backend/src/
npm run build:css      # Build Tailwind CSS
```

## Architecture

### Full Stack Structure

```
server.js                    # Express server (frontend + API)
├── backend/src/
│   ├── routes/              # API route definitions
│   ├── controllers/         # Request handlers (pdfController.js)
│   └── services/            # Puppeteer PDF service
│
├── js/app.js               # Frontend orchestrator
├── js/utils/helpers.js     # Shared utilities
└── js/modules/
    ├── calculator.js       # Auto-calculation with lock/unlock
    ├── storage.js          # localStorage (key: 'salesOfferApp')
    ├── category.js         # Off-Plan vs Ready Property modes
    ├── paymentPlan.js      # Drag-drop milestone table
    ├── branding.js         # Logo/colors customization
    ├── pdfExport.js        # Backend PDF API client
    ├── export.js           # Legacy html2pdf.js export
    ├── excel.js            # Excel import via SheetJS
    ├── validator.js        # Field validation
    ├── templates.js        # Template selector
    └── beta.js             # Beta features panel
```

### PDF Generation (Two Methods)

1. **Backend (HQ)**: `pdfExport.js` → POST `/api/pdf/generate` → Puppeteer renders HTML template → returns PDF buffer
2. **Legacy**: `export.js` → html2pdf.js captures preview as screenshot (client-side)

### Dual Storage Strategy

Images are stored in two versions to manage localStorage quota:
- **Original quality**: `window.originalImages` (memory) + IndexedDB (`imageStorage.js`) - used for PDF export
- **Compressed**: localStorage - used for preview/auto-save

### Key Patterns

**Calculator Lock System**: Fields can be "locked" to override auto-calculation. Check `isFieldLocked()` before computing. Lock states persist in localStorage.

**Category System**: Two modes - "offplan" (resale with payment plans) and "ready" (completed properties). Category stored in localStorage as `propertyCategory`. Calculator reads this directly (not imported) to avoid circular deps.

**Event-Driven Updates**: Custom events `dataImported`, `categoryChanged`, `unitTypeChanged` trigger preview updates across modules.

### Property Types

- **Standard (Apartments)**: Internal + Balcony areas
- **Villa/Townhouse**: Internal + Terrace + BUA + GFA + Plot Size
- **Plot**: Plot Size + Allowed Build Area

### CDN Dependencies

Libraries loaded via CDN (not npm): Tailwind CSS, SheetJS (xlsx), html2pdf.js, SortableJS

## Testing

Tests in `tests/` use Vitest with jsdom environment. Test files mirror module structure.

## Field ID Conventions

- `input-*` - Standard calculated fields
- `u_*` - User input fields (legacy)
- `disp_*` / `display-*` - Preview display elements

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pdf/generate` | POST | Generate PDF (body: `{data, branding, template}`) |
| `/api/templates` | GET/POST | List or save templates |
| `/api/templates/:id` | GET/PUT/DELETE | Template CRUD |
| `/api/settings` | GET/POST | App settings |
| `/health` | GET | Health check (MongoDB/Puppeteer status) |
| `/metrics` | GET | Performance metrics |
| `/api/pdf/queue-status` | GET | PDF generation queue status |

## Rate Limits

- PDF generation: 20 requests / 15 minutes
- General API: 100 requests / 15 minutes

## Environment Variables

```env
PORT=8000                                    # Server port (default: 8000)
NODE_ENV=development                         # development | production
MONGODB_URI=mongodb://localhost:27017/saleshub  # Optional, for templates
```
