# SalesHUB Task Tracker

## Phase 1 - Off-Plan (priority)
- [x] Rebrand UI strings and metadata to SalesHUB (index.html, README.md, package.json).
- [x] Make Beta features default (beta.js).
- [x] Add dedicated Export buttons for editable and hybrid PDF flows (index.html, export.js).
- [x] Add Hybrid export option to Export modal (index.html).
- [x] Export filename defaults centralized (export.js).
- [x] Improve text-PDF fidelity using preview layout metrics (pdfGenerator.js).
- [x] Document preview group identifiers (preview.css).
- [x] Align landscape floorplan frame for print layout (print.css).
- [ ] Validate jsPDF vs Live Preview alignment with your Excel sample data.
- [ ] Confirm Print/PDF output scaling for landscape template matches preview size.
- [ ] Review hybrid export naming and expected outputs (editable + visual).

## Phase 2 - Ready Properties (after Off-Plan PDF matches)
- [ ] Migrate Ready property flow into SalesHUB (status table + fields).
- [ ] Validate Ready-only rows visibility and calculations.
- [ ] Confirm Ready PDF output (jsPDF + visual).

## Testing Status
- [x] Run unit tests: `npm test` (no test files; passWithNoTests).
- [x] Run lint: `npm run lint`.
- [ ] Manual smoke test: Excel import -> preview -> editable PDF -> hybrid PDFs -> print/PDF.
