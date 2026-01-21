# SalesHUB Audit Report

**Date**: 2026-01-21
**Trigger**: Console errors during PDF generation
**SQALE Rating**: B (Minor issues, easily fixable)

---

## Executive Summary

The audit identified **5 issues** across 3 categories:
- 1 HIGH severity (payload limits causing PDF generation failure)
- 2 MEDIUM severity (missing static assets)
- 2 LOW severity (dev dependency vulnerabilities)

All issues have straightforward fixes requiring minimal code changes.

---

## Issue Details

### ISSUE-001: Missing Logo File (MEDIUM)

**Error**: `KP_blACK.png:1 Failed to load resource: 404 (Not Found)`

**Location**: `index.html:784`
```html
<img src="assets/logos/KP_blACK.png" alt="Company Logo" class="logo-img" id="logoImg">
```

**Root Cause**: The referenced file `KP_blACK.png` does not exist.

**Available Files**:
| File | Status |
|------|--------|
| `KP_blACK.png` | MISSING |
| `KP_Black_new.png` | EXISTS |
| `KP_white.png` | EXISTS |
| `Asset 1.png` | EXISTS |
| `Asset 1@2x.png` | EXISTS |

**Fix Options**:
1. **Option A**: Rename `KP_Black_new.png` to `KP_blACK.png`
2. **Option B**: Update `index.html` to reference `KP_Black_new.png`

**Recommended**: Option B (update HTML reference)

---

### ISSUE-002: Missing Favicon (MEDIUM)

**Error**: `favicon.ico:1 Failed to load resource: 404 (Not Found)`

**Root Cause**: No favicon.ico file exists in project root. Browsers automatically request this file.

**Fix Options**:
1. Create a favicon.ico file from existing logo
2. Add `<link rel="icon">` tag with explicit path to existing PNG
3. Add `<link rel="icon" href="data:,">` to suppress the request

**Recommended**: Option 2 (use existing PNG logo)

---

### ISSUE-003: Payload Too Large for PDF Generation (HIGH)

**Error**: `413 Payload Too Large`

**Location**:
- `server.js:120` - `express.json({ limit: '10mb' })`
- `pdfController.js:21` - `MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024`

**Root Cause**:
The floor plan image was 8423.7KB (~8.2MB). After base64 encoding (adds ~33% overhead), the total payload exceeds limits.

**Size Calculation**:
```
Floor plan raw:     8.2 MB
Base64 overhead:   +2.7 MB (33%)
Total payload:     ~11 MB
Server limit:       10 MB  EXCEEDED
Per-image limit:     5 MB  EXCEEDED
```

**Fix Options**:
1. **Client-side compression**: Compress images before sending to API
2. **Increase server limit**: Raise to 25MB (not recommended for production)
3. **Streaming upload**: Upload images separately via multipart/form-data
4. **Auto-compression**: Add automatic image compression in pdfExport.js

**Recommended**: Option 4 (auto-compression in pdfExport.js)

---

### ISSUE-004: Development Dependency Vulnerabilities (LOW)

**Affected Packages**: vitest, vite, vite-node, esbuild, @vitest/coverage-v8

**Severity**: Moderate (CVSS 5.3)

**Risk**: These are dev-only dependencies. They do not affect production deployments.

**Fix**: `npm update vitest` or `npm audit fix --force`

---

### ISSUE-005: Size Limit Mismatch (LOW)

**Location**:
- `server.js:120` allows 10MB JSON body
- `pdfController.js:21` allows 5MB per image
- `js/app.js:157` allows 100MB for file uploads

**Issue**: Inconsistent limits create confusion and unexpected failures.

**Recommended Unified Limits**:
| Context | Limit | Rationale |
|---------|-------|-----------|
| Server body | 25MB | Allow large images with overhead |
| Per-image | 10MB | Reasonable for high-quality floor plans |
| File upload | 25MB | Match server body limit |

---

## Recommendations Summary

| Priority | Issue | Fix | Effort |
|----------|-------|-----|--------|
| 1 | Logo 404 | Update index.html to use `KP_Black_new.png` | 5 min |
| 2 | Payload 413 | Add image compression + increase limits | 30 min |
| 3 | Favicon 404 | Add favicon link tag | 5 min |
| 4 | Limit mismatch | Unify size limits | 10 min |
| 5 | Dev vulnerabilities | npm update vitest | 5 min |

---

## Files to Modify

1. `index.html` - Fix logo path, add favicon link
2. `server.js` - Increase JSON body limit
3. `pdfController.js` - Increase per-image limit
4. `js/modules/pdfExport.js` - Add image compression before upload

---

## Next Steps

Run the fix implementation plan to resolve all issues.
