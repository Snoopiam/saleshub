# SalesHUB

Professional real estate sales offer document generator for UAE properties. Creates A4 documents with property details, financial breakdowns, floor plans, and payment plans.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Tests](https://img.shields.io/badge/tests-196%20passing-success)

## Features

- **Live Preview** - Instant A4 document updates as you type
- **Multiple Templates** - Landscape, Portrait, and Minimal layouts
- **Auto-Calculations** - ADGM fees, agency fees, totals, and premium
- **Excel Import** - Import property data from spreadsheets (SheetJS)
- **HQ PDF Export** - Server-side Puppeteer rendering for pixel-perfect PDFs
- **Payment Plan Editor** - Drag-and-drop milestone table (SortableJS)
- **Auto-Save** - localStorage persistence with encryption for sensitive data
- **Branding** - Custom logo, colors, and company labels
- **Accessibility** - WCAG 2.2 AA compliant with keyboard navigation

## Property Types Supported

| Category | Description |
|----------|-------------|
| **Off-Plan Resale** | Properties under construction with payment plans |
| **Ready Property** | Completed properties with occupancy status |

| Unit Type | Area Fields |
|-----------|-------------|
| Standard (Apartments) | Internal + Balcony |
| Villa/Townhouse | Internal + Terrace + BUA + GFA + Plot Size |
| Plot | Plot Size + Allowed Build Area |

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (optional, for templates)

### Installation

```bash
# Clone the repository
git clone https://github.com/Snoopiam/saleshub.git
cd saleshub

# Install dependencies
npm install

# Start the server
npm start
```

Open http://localhost:8000 in your browser.

### Development Mode

```bash
npm run dev    # Start with auto-reload (nodemon)
```

## Usage

1. **Select Template** - Choose Landscape, Portrait, or Minimal layout
2. **Enter Property Details** - Fill in project name, unit info, areas
3. **Configure Financials** - Set prices, fees, and payment terms
4. **Add Payment Plan** - Use the milestone editor for Off-Plan properties
5. **Upload Floor Plan** - Add property images (optional)
6. **Export** - Generate PDF or save as JSON template

## Architecture

```
SalesHUB/
├── server.js                    # Express server (frontend + API)
├── backend/src/
│   ├── routes/                  # API route definitions
│   ├── controllers/             # Request handlers
│   │   ├── pdfController.js     # PDF generation endpoint
│   │   ├── templateController.js # Template CRUD
│   │   └── settingsController.js # App settings
│   ├── services/
│   │   ├── puppeteerPdfService.js # Puppeteer PDF renderer
│   │   ├── metricsService.js    # Performance metrics
│   │   └── requestQueue.js      # Concurrent request limiter
│   └── db/
│       └── connection.js        # MongoDB connection manager
│
├── js/
│   ├── app.js                   # Frontend orchestrator
│   ├── utils/
│   │   ├── helpers.js           # Shared utilities
│   │   └── crypto.js            # AES-GCM encryption
│   └── modules/
│       ├── calculator.js        # Auto-calculation with lock/unlock
│       ├── storage.js           # localStorage with encryption
│       ├── category.js          # Off-Plan vs Ready modes
│       ├── paymentPlan.js       # Drag-drop milestone table
│       ├── branding.js          # Logo/colors customization
│       ├── pdfExport.js         # Backend PDF API client
│       ├── export.js            # Legacy html2pdf.js export
│       ├── excel.js             # Excel import via SheetJS
│       ├── validator.js         # Field validation
│       ├── templates.js         # Template selector
│       └── imageStorage.js      # IndexedDB image persistence
│
├── css/
│   ├── main.css                 # Primary styles
│   ├── preview.css              # A4 preview styles
│   └── print.css                # Print stylesheet
│
├── tests/                       # Vitest test files
├── docs/                        # Documentation
└── assets/                      # Logos and fonts
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pdf/generate` | POST | Generate PDF from data |
| `/api/templates` | GET | List all templates |
| `/api/templates/:id` | GET | Get template by ID |
| `/api/templates` | POST | Save new template |
| `/api/templates/:id` | PUT | Update template |
| `/api/templates/:id` | DELETE | Delete template |
| `/api/settings` | GET/POST | App settings |
| `/health` | GET | Health check with MongoDB/Puppeteer status |
| `/metrics` | GET | Performance metrics |
| `/queue-status` | GET | PDF queue status |

### PDF Generation Example

```javascript
const response = await fetch('/api/pdf/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: { /* property data */ },
    branding: { /* logo, colors */ },
    template: 'landscape'
  })
});
const blob = await response.blob();
```

## Commands

```bash
npm start              # Start Express server on port 8000
npm run dev            # Start with nodemon for auto-reload
npm test               # Run all tests with Vitest
npm test calculator    # Run tests matching "calculator"
npm run test:coverage  # Run tests with coverage report
npm run lint           # ESLint check on js/ and backend/src/
npm run build:css      # Build Tailwind CSS
npm run setup:hooks    # Install git pre-commit hooks
```

## Testing

Tests use Vitest with jsdom environment.

```bash
# Run all tests
npm test

# Run specific test file
npm test calculator

# Run with coverage
npm run test:coverage
```

**Current Status:** 196 tests passing across 6 test files.

## CDN Dependencies

Libraries loaded via CDN with SRI hashes:

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | 3.x | Utility CSS classes |
| SheetJS (xlsx) | 0.18.5 | Excel import/export |
| html2pdf.js | 0.12.1 | Legacy PDF generation |
| SortableJS | 1.15.6 | Drag-and-drop |

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/saleshub
```

## Security Features

- **Rate Limiting** - 20 req/15min for PDF, 100 req/15min for API
- **Helmet.js** - Security headers (CSP, HSTS, X-Frame-Options)
- **Input Sanitization** - XSS prevention in PDF templates
- **Encrypted Storage** - AES-GCM 256-bit for sensitive localStorage data
- **Pre-commit Hooks** - Secrets scanning before commits

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | >= 80 |
| Firefox | >= 75 |
| Safari | >= 13 |
| Edge | >= 80 |

## Documentation

| Document | Description |
|----------|-------------|
| [Backend Setup](BACKEND_SETUP.md) | Server configuration guide |
| [User Manual](docs/USER_MANUAL.md) | End-user guide |
| [Field Reference](docs/FIELD_REFERENCE.md) | Complete field mapping |
| [CSS Style Guide](docs/CSS_STYLE_GUIDE.md) | Styling reference |
| [PDF Workflow](docs/PDF_GENERATION_WORKFLOW.md) | PDF generation details |
| [Browser Compatibility](docs/BROWSER_COMPATIBILITY.md) | Cross-browser guide |
| [TypeScript Migration](docs/TYPESCRIPT_MIGRATION_PLAN.md) | Future TS migration plan |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Health Score:** 85/100 | **Tests:** 196 passing | **Version:** 2.0.0
