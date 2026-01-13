# TypeScript Migration Plan

**Project:** SalesHUB
**Created:** 2026-01-13
**Status:** Planning Phase
**Priority:** LOW (L-05)

## Overview

This document outlines the strategy for migrating SalesHUB from JavaScript to TypeScript. The migration will improve type safety, IDE support, and maintainability.

## Current State

- **Frontend:** Vanilla JS modules in `js/` (~15 files)
- **Backend:** Express.js in `backend/src/` (~10 files)
- **Tests:** Vitest with jsdom (~6 test files)
- **Build:** No bundler (browser ES modules + Node.js)

## Migration Strategy

### Phase 1: Setup & Configuration

1. **Install TypeScript dependencies**
   ```bash
   npm install -D typescript @types/node @types/express
   ```

2. **Create tsconfig.json files**
   - `tsconfig.json` (root - shared settings)
   - `tsconfig.backend.json` (Node.js backend)
   - `tsconfig.frontend.json` (browser modules)

3. **Update ESLint for TypeScript**
   ```bash
   npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
   ```

### Phase 2: Backend Migration (Recommended First)

Backend is simpler and has fewer dependencies. Migrate in order:

1. **Services layer** (isolated, pure functions)
   - `metricsService.js` → `metricsService.ts`
   - `requestQueue.js` → `requestQueue.ts`
   - `puppeteerPdfService.js` → `puppeteerPdfService.ts`

2. **Database layer**
   - `db/connection.js` → `db/connection.ts`

3. **Controllers**
   - `pdfController.js` → `pdfController.ts`
   - `templateController.js` → `templateController.ts`
   - `settingsController.js` → `settingsController.ts`

4. **Routes and server**
   - `routes/index.js` → `routes/index.ts`
   - `server.js` → `server.ts`

### Phase 3: Frontend Migration

Frontend requires careful handling due to browser ES modules:

1. **Utilities first** (no dependencies)
   - `js/utils/helpers.js` → `js/utils/helpers.ts`
   - `js/utils/crypto.js` → `js/utils/crypto.ts`

2. **Independent modules**
   - `js/modules/validator.js`
   - `js/modules/branding.js`
   - `js/modules/templates.js`

3. **Core modules with dependencies**
   - `js/modules/storage.js`
   - `js/modules/calculator.js`
   - `js/modules/category.js`

4. **Feature modules**
   - `js/modules/paymentPlan.js`
   - `js/modules/excel.js`
   - `js/modules/pdfExport.js`
   - `js/modules/export.js`
   - `js/modules/imageStorage.js`

5. **Main orchestrator**
   - `js/app.js` → `js/app.ts`

### Phase 4: Test Migration

- Update Vitest config for TypeScript
- Migrate test files to `.test.ts`
- Add type definitions for test utilities

## Type Definitions Needed

### Custom Types (create in `types/`)

```typescript
// types/offer.ts
interface OfferData {
  projectName?: string;
  unitNo?: string;
  unitType?: string;
  unitModel?: string;
  bedrooms?: string;
  views?: string;
  internalArea?: number;
  balconyArea?: number;
  totalArea?: number;
  originalPrice?: number;
  sellingPrice?: number;
  paymentPlan?: PaymentPlanRow[];
  category?: 'offplan' | 'ready';
  // ... more fields
}

interface PaymentPlanRow {
  date: string;
  percentage: string;
  amount: number | string;
}

interface Branding {
  logo?: string;
  primaryColor?: string;
  companyName?: string;
  footerText?: string;
  createdBy?: string;
  labels?: BrandingLabels;
}
```

### External Type Packages

- `@types/express` - Express.js
- `@types/node` - Node.js built-ins
- `@types/puppeteer` - Puppeteer (or bundled types)
- `@types/compression` - Compression middleware
- `@types/cors` - CORS middleware

## Build Configuration

### Backend (Node.js)

```json
// tsconfig.backend.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "./dist/backend",
    "rootDir": "./backend/src"
  },
  "include": ["backend/src/**/*"]
}
```

### Frontend (Browser ES Modules)

```json
// tsconfig.frontend.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ES2020",
    "moduleResolution": "bundler",
    "outDir": "./dist/js",
    "rootDir": "./js"
  },
  "include": ["js/**/*"]
}
```

## Migration Guidelines

### File-by-File Approach

1. Rename `.js` to `.ts`
2. Add type annotations to function parameters
3. Fix type errors
4. Run tests to verify behavior unchanged
5. Commit when tests pass

### Gradual Migration Tips

- Use `// @ts-check` in JS files for early type checking
- Start with `strict: false`, enable strictness incrementally
- Use `any` temporarily for complex types, refine later
- Keep `.js` and `.ts` files coexisting during transition

### Common Patterns

```typescript
// Before (JS)
function formatCurrency(value) {
  if (!value) return '-';
  const num = parseFloat(value);
  return isNaN(num) ? '-' : `AED ${num.toLocaleString()}`;
}

// After (TS)
function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? '-' : `AED ${num.toLocaleString()}`;
}
```

## Estimated Effort

| Phase | Files | Effort |
|-------|-------|--------|
| Setup | - | 2-4 hours |
| Backend | ~10 files | 1-2 days |
| Frontend | ~15 files | 2-3 days |
| Tests | ~6 files | 0.5-1 day |
| **Total** | ~31 files | **4-6 days** |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Comprehensive test suite, migrate incrementally |
| Browser module compatibility | Keep ES module format, avoid bundler initially |
| Team learning curve | TypeScript is optional reading for existing devs |
| Build complexity increase | Keep simple tsc compilation, avoid complex bundlers |

## Success Criteria

- [ ] All TypeScript files compile without errors
- [ ] All tests pass
- [ ] No runtime regressions
- [ ] IDE autocomplete and type checking working
- [ ] CI pipeline updated for TypeScript

## Next Steps

1. Review and approve this plan
2. Create tracking issue/ticket
3. Set up TypeScript configuration (Phase 1)
4. Begin backend migration (Phase 2)

---

**Note:** This is a planning document. Implementation should be tracked separately and prioritized based on team capacity.
