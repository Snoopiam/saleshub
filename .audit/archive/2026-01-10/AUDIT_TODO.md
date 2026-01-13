# AUDIT TODO
**Project:** SalesHUB | **Started:** 2026-01-10

## Progress: ░░░░░░░░░░ 0% (0/10)

---

## 🔴 Critical (Do First)

- [ ] **MP-01** Restore/create test suite
  - Location: `tests/`
  - Action: Check git history for deleted tests, restore or recreate 297 tests
  - Effort: L
  - From: Finding C-01, C-02
  - Commands:
    ```bash
    git log --all --full-history -- tests/
    git log --diff-filter=D -- tests/
    ```

---

## 🟠 High Priority

- [ ] **MP-02** Update vitest to v4 (fixes security vulnerabilities)
  - Location: `package.json`
  - Action: `npm install vitest@4.0.16 @vitest/coverage-v8@4.0.16`
  - Effort: M
  - From: Finding H-01
  - Note: Review breaking changes, update test syntax if needed

- [ ] **MP-03** Upgrade express to v5
  - Location: `package.json`, `backend/`
  - Action: `npm install express@5`
  - Effort: M
  - From: Finding H-02
  - Note: Test all routes after upgrade

- [ ] **MP-04** Upgrade mongodb driver to v7
  - Location: `package.json`, `backend/`
  - Action: `npm install mongodb@7`
  - Effort: M
  - From: Finding H-02
  - Note: Verify database connections work

---

## 🟡 Medium Priority

- [ ] **MP-05** Replace console.* with proper logger
  - Location: `js/modules/`, `backend/src/`
  - Action: Install pino/winston for backend, create logger wrapper for frontend
  - Effort: M
  - From: Finding M-01
  - Files: export.js, pdfExport.js, storage.js, pdfController.js, pdfService.js

- [ ] **QW-02** Fix unused variable lint warnings
  - Location: `js/modules/ai.js:292`, `js/modules/paymentPlan.js:253`
  - Action: Prefix with underscore or remove unused variables
  - Effort: XS
  - From: Finding M-02

---

## 🟢 Low Priority (Quick Wins)

- [ ] **QW-01** Add "type": "module" to package.json
  - Location: `package.json`
  - Action: Add `"type": "module"` field
  - Effort: XS
  - From: Finding L-01

- [ ] **QW-03** Update pdfkit to 0.17.2
  - Location: `package.json`
  - Action: `npm install pdfkit@0.17.2`
  - Effort: S
  - From: Finding H-02

- [ ] **FI-01** Update concurrently to v9
  - Location: `package.json`
  - Action: `npm install concurrently@9`
  - Effort: XS

- [ ] **FI-02** Update dotenv to v17
  - Location: `package.json`
  - Action: `npm install dotenv@17`
  - Effort: XS

---

## Completed

| Date | ID | Notes |
|------|-----|-------|
| | | |

---

## Metrics Dashboard

### Current (2026-01-10)
| Metric | Value | Status |
|--------|-------|--------|
| Health Score | 50/100 | 🔴 AT RISK |
| Test Coverage | 0% | 🔴 CRITICAL |
| Security Vulns | 5 | 🟠 HIGH |
| Outdated Deps | 9 | 🔴 HIGH |
| Lint Warnings | 2 | 🟡 MEDIUM |
| Console Statements | 25 | 🟡 MEDIUM |

### Target (After All Tasks)
| Metric | Value | Status |
|--------|-------|--------|
| Health Score | 85/100 | 🟢 HEALTHY |
| Test Coverage | 80%+ | 🟢 HEALTHY |
| Security Vulns | 0 | 🟢 HEALTHY |
| Outdated Deps | 0 | 🟢 HEALTHY |
| Lint Warnings | 0 | 🟢 HEALTHY |
| Console Statements | 0 | 🟢 HEALTHY |

---

## Quick Reference

### Run Tests
```bash
npm test              # Run all tests
npm test:coverage     # Run with coverage
```

### Check Dependencies
```bash
npm outdated          # List outdated packages
npm audit             # Security check
```

### Lint
```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### Git History (for finding deleted tests)
```bash
git log --all --full-history -- tests/
git show <commit>:tests/calculator.test.js
git checkout <commit>^ -- tests/
```
