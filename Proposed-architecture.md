SalesHUB (Enhanced)
├── 📁 /                    # Your existing frontend
│   ├── index.html          # Keep this
│   ├── js/                 # Keep your modules
│   └── css/                # Keep your styles
│
├── 🆕 /backend/             # NEW: Backend API
│   ├── src/
│   │   ├── controllers/
│   │   │   └── pdfController.js       # Generate PDF
│   │   ├── services/
│   │   │   ├── pdfService.js          # PDF library wrapper
│   │   │   └── templateService.js     # Template management
│   │   ├── models/
│   │   │   ├── Template.js
│   │   │   └── Settings.js
│   │   └── routes/
│   │       └── index.js               # API routes
│   ├── config/
│   │   └── pdf.config.js
│   └── server.js
│
├── 🆕 /shared/              # NEW: Shared types/config
│   └── types.js
│
├── 📁 docs/                # Keep your docs
├── 📁 tests/               # Keep your tests
├── package.json           # Update this
└── docker-compose.yml     # NEW: Run everything together
