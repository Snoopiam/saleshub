# SalesHUB

Professional real estate sales offer document generator for UAE properties. Creates A4 documents with property details, financial breakdowns, floor plans, and payment plans.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

## Features

- **Live Preview** - Instant A4 document updates as you type
- **Multiple Templates** - Landscape, Portrait, and Minimal layouts
- **Auto-Calculations** - ADGM fees, agency fees, totals, and premium
- **Excel Import** - Import property data from spreadsheets (SheetJS)
- **AI Document Parsing** - Extract data from documents using Google Gemini (Beta)
- **PDF Export** - Generate high-quality PDFs matching live preview exactly
- **Payment Plan Editor** - Drag-and-drop milestone table (SortableJS)
- **Auto-Save** - localStorage persistence with manual save/load
- **Branding** - Custom logo, colors, and company labels
- **Accessibility** - WCAG 2.2 AA compliant with keyboard navigation

## Property Types Supported

| Category            | Description                                      |
| ------------------- | ------------------------------------------------ |
| **Off-Plan Resale** | Properties under construction with payment plans |
| **Ready Property**  | Completed properties with occupancy status       |

| Unit Type             | Area Fields                                |
| --------------------- | ------------------------------------------ |
| Standard (Apartments) | Internal + Balcony                         |
| Villa/Townhouse       | Internal + Terrace + BUA + GFA + Plot Size |
| Plot                  | Plot Size + Allowed Build Area             |

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm

### Installation

Open http://localhost:8000 in your browser.

### Alternative: Direct Open

Double-click to open directly in browser (some features may be limited without a local server).

## Usage

1. **Select Template** - Choose Landscape, Portrait, or Minimal layout
2. **Enter Property Details** - Fill in project name, unit info, areas
3. **Configure Financials** - Set prices, fees, and payment terms
4. **Add Payment Plan** - Use the milestone editor for Off-Plan properties
5. **Upload Floor Plan** - Add property images (optional)
6. **Export** - Generate PDF, PNG, or save as JSON template

See [User Manual](docs/USER_MANUAL.md) for detailed instructions.

## Development

### Commands

> saleshub@1.0.0 start
> npx http-server -p 8000 -c-1

> saleshub@1.0.0 test
> vitest

[1m[46m RUN [49m[22m [36mv4.0.16 [39m[90mC:/SnoopLabs/Labs/RealEstate_apps/SalesHUB[39m

> saleshub@1.0.0 test
> vitest --watch

[1m[44m DEV [49m[22m [34mv4.0.16 [39m[90mC:/SnoopLabs/Labs/RealEstate_apps/SalesHUB[39m

[32m✓[39m tests/category.test.js [2m([22m[2m13 tests[22m[2m)[22m[32m 93[2mms[22m[39m
[32m✓[39m tests/validator.test.js [2m([22m[2m66 tests[22m[2m)[22m[32m 233[2mms[22m[39m
[32m✓[39m tests/calculator.test.js [2m([22m[2m68 tests[22m[2m)[22m[32m 263[2mms[22m[39m
[32m✓[39m tests/excel.test.js [2m([22m[2m45 tests[22m[2m)[22m[33m 607[2mms[22m[39m
[32m✓[39m tests/helpers.test.js [2m([22m[2m94 tests[22m[2m)[22m[32m 91[2mms[22m[39m
[32m✓[39m tests/branding.test.js [2m([22m[2m11 tests[22m[2m)[22m[32m 77[2mms[22m[39m

> saleshub@1.0.0 test:coverage
> vitest run --coverage

[1m[46m RUN [49m[22m [36mv4.0.16 [39m[90mC:/SnoopLabs/Labs/RealEstate_apps/SalesHUB[39m
[2mCoverage enabled with [22m[33mv8[39m

> saleshub@1.0.0 lint
> eslint js/

C:\SnoopLabs\Labs\RealEstate_apps\SalesHUB\js\modulesi.js
292:14 warning 'e' is defined but never used no-unused-vars

C:\SnoopLabs\Labs\RealEstate_apps\SalesHUB\js\modules\paymentPlan.js
253:11 warning 'totalInitial' is assigned a value but never used no-unused-vars

✖ 2 problems (0 errors, 2 warnings)

> saleshub@1.0.0 lint:fix
> eslint js/ --fix

C:\SnoopLabs\Labs\RealEstate_apps\SalesHUB\js\modulesi.js
292:14 warning 'e' is defined but never used no-unused-vars

C:\SnoopLabs\Labs\RealEstate_apps\SalesHUB\js\modules\paymentPlan.js
253:11 warning 'totalInitial' is assigned a value but never used no-unused-vars

✖ 2 problems (0 errors, 2 warnings)

### Project Structure

### Architecture

All JavaScript uses ES Modules. Entry point is which imports and initializes feature modules.

### CSS Variables

Primary theming variables in :

## Testing

Tests are located in and mirror the module structure.

> saleshub@1.0.0 test
> vitest

[1m[46m RUN [49m[22m [36mv4.0.16 [39m[90mC:/SnoopLabs/Labs/RealEstate_apps/SalesHUB[39m

> saleshub@1.0.0 test
> vitest calculator

[1m[46m RUN [49m[22m [36mv4.0.16 [39m[90mC:/SnoopLabs/Labs/RealEstate_apps/SalesHUB[39m

[32m✓[39m tests/calculator.test.js [2m([22m[2m68 tests[22m[2m)[22m[32m 234[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m Tests [22m [1m[32m68 passed[39m[22m[90m (68)[39m
[2m Start at [22m 18:43:04
[2m Duration [22m 1.86s[2m (transform 129ms, setup 28ms, import 130ms, tests 234ms, environment 1.23s)[22m

> saleshub@1.0.0 test:coverage
> vitest run --coverage

[1m[46m RUN [49m[22m [36mv4.0.16 [39m[90mC:/SnoopLabs/Labs/RealEstate_apps/SalesHUB[39m
[2mCoverage enabled with [22m[33mv8[39m

## CDN Dependencies

Libraries loaded via CDN with SRI hashes:

| Library        | Version | Purpose                     |
| -------------- | ------- | --------------------------- |
| Tailwind CSS   | latest  | Utility CSS classes         |
| SheetJS (xlsx) | 0.18.5  | Excel import/export         |
| html2pdf.js    | 0.12.1  | High-quality PDF generation |
| SortableJS     | 1.15.6  | Drag-and-drop               |

## Documentation

| Document                                               | Description                    |
| ------------------------------------------------------ | ------------------------------ |
| [User Manual](docs/USER_MANUAL.md)                     | End-user guide                 |
| [Field Reference](docs/FIELD_REFERENCE.md)             | Complete field mapping         |
| [CSS Style Guide](docs/CSS_STYLE_GUIDE.md)             | Styling reference              |
| [PDF Workflow](docs/PDF_GENERATION_WORKFLOW.md)        | PDF generation details         |
| [Browser Compatibility](docs/BROWSER_COMPATIBILITY.md) | Cross-browser PDF export guide |
| [Preview Elements](docs/PREVIEW_ELEMENTS.md)           | A4 element IDs                 |

## Browser Support

- Chrome >= 80
- Firefox >= 75
- Safari >= 13
- Edge >= 80

**Note**: PDF export uses client-side rendering which may produce slight variations between browsers. See [Browser Compatibility Guide](docs/BROWSER_COMPATIBILITY.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch ()
3. Commit changes (On branch feature/amazing-feature
   Changes not staged for commit:
   (use "git add <file>..." to update what will be committed)
   (use "git restore <file>..." to discard changes in working directory)
   modified: docs/HUMANIZATION.md

no changes added to commit (use "git add" and/or "git commit -a")) 4. Push to branch () 5. Open a Pull Request
