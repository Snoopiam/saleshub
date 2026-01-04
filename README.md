diff --git a/README.md b/README.md
index f22506f7be5aba9dd985d82453d02a1a43ca474b..10c2c6336401ab7769a517ad7af3480d6fcba296 100644
--- a/README.md
+++ b/README.md
@@ -1,57 +1,57 @@
-# Sales Offer Generator
+# SalesHUB
 
 A professional real estate sales offer document generator with live preview, auto-calculations, and AI-powered document parsing.
 
 ![Version](https://img.shields.io/badge/version-1.1.0-blue)
 ![License](https://img.shields.io/badge/license-MIT-green)
 ![Tests](https://img.shields.io/badge/tests-430-brightgreen)
 ![Health](https://img.shields.io/badge/health-80%25-success)
 
 ![App Overview](docs/images/1.default.png)
 
 ## Features
 
 - **Live A4 Document Preview** - See changes in real-time as you type
 - **Auto-Calculations** - Automatic calculation of derived fields (premium, fees, totals)
 - **Multiple Templates** - Landscape, Portrait, and Minimal designs
 - **Property Categories** - Support for Off-Plan Resale and Ready Property
 - **Data Persistence** - Auto-saves to browser storage, never lose your work
 - **Excel Import** - Import property data from Excel spreadsheets
 - **AI Document Parser** - Extract data from property brochures using Google Gemini
 - **Branding Customization** - Custom logo, colors, and labels
 - **Multiple Export Formats** - PDF, PNG, and JSON export
 - **Template System** - Save and reuse offer templates
 - **Security** - Content Security Policy, SRI for CDN resources, input sanitization
 
 ## Quick Start
 
 ### Step 1: Open a Terminal
 
 Navigate to the project folder in PowerShell or Command Prompt:
 ```powershell
-cd "Sales Offer"
+cd "SalesHUB"
 ```
 
 ### Step 2: Start the Server
 
 Choose ONE of these options:
 
 **Option A: Node.js (Recommended)**
 ```powershell
 npm install        # First time only
 npm run serve:node
 ```
 
 **Option B: Python**
 ```powershell
 python -m http.server 8000
 ```
 
 **Option C: VS Code**
 - Install the "Live Server" extension
 - Right-click `index.html` → "Open with Live Server"
 
 ### Step 3: Open the App
 
 Open your browser and go to:
 ```
@@ -85,51 +85,51 @@ npm run serve:node     # Node.js server
 npm test               # Run all tests
 npm run test:ui        # Run tests with UI
 npm run test:coverage  # Run tests with coverage report
 
 # Linting
 npm run lint           # Check for issues
 npm run lint:fix       # Auto-fix issues
 ```
 
 ### Testing
 
 The project uses [Vitest](https://vitest.dev/) for testing with 430+ tests covering:
 
 - **helpers.test.js** - Utility functions (formatCurrency, escapeHtml, sanitizeInput, etc.)
 - **calculator.test.js** - Financial calculations (ADGM, agency fees, totals)
 - **validator.test.js** - Form and payment plan validation
 
 Run tests:
 ```powershell
 npm test
 ```
 
 ## Project Structure
 
 ```
-Sales Offer/
+SalesHUB/
 ├── index.html              # Main application
 ├── package.json            # Project configuration & scripts
 ├── vitest.config.js        # Test configuration
 ├── eslint.config.js        # Linting configuration
 ├── .editorconfig           # Editor settings
 ├── assets/
 │   ├── fonts/              # Montserrat font files
 │   ├── logos/              # Brand logo assets
 │   └── samples/            # Sample PDF documents
 ├── css/
 │   ├── main.css            # Sidebar & layout styles
 │   ├── preview.css         # A4 document styles
 │   ├── print.css           # Print media styles
 │   ├── beta.css            # Beta feature styles
 │   └── templates/
 │       ├── landscape.css   # Landscape template
 │       ├── portrait.css    # Portrait template
 │       └── minimal.css     # Minimal template
 ├── data/                   # Excel data files
 ├── docs/
 │   ├── audit/              # Audit reports
 │   ├── archive/            # Archived documentation
 │   └── *.md                # Technical documentation
 ├── js/
 │   ├── app.js              # Main application logic
