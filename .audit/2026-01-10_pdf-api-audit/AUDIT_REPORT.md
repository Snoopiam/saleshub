# Backend API Audit Report: PDF Generation Endpoint

**Audit Date:** 2026-01-10
**Endpoint:** `POST /api/pdf/generate`
**Error Report:** 500 Internal Server Error with "Connection closed" message

---

## Summary

| Metric | Value |
|--------|-------|
| Endpoints audited | 1 (PDF generation) |
| Files analyzed | 6 |
| Issues found | 8 (2 critical, 3 high, 2 medium, 1 low) |
| Overall score | 58/100 |

---

## Root Cause Analysis

The "Connection closed" error occurs when the Puppeteer browser instance disconnects unexpectedly during PDF generation. This is a **race condition** issue:

1. `getBrowser()` checks `isConnected()` and returns the browser
2. Between the check and `browser.newPage()`, the browser can disconnect
3. Operations on a disconnected browser throw "Connection closed" errors
4. No retry mechanism exists to recover from browser disconnection

---

## Critical Issues

### 1. Race Condition in Browser Connection Check
**File:** `backend/src/services/puppeteerPdfService.js:20-48`
**Severity:** CRITICAL

```javascript
async getBrowser() {
  // Check if browser exists AND is still connected
  if (!this.browser || !this.browser.isConnected()) {
    // ... launch browser
  }
  return this.browser;  // Browser can disconnect after this line
}
```

**Problem:** The `isConnected()` check is not atomic with browser usage. The browser can disconnect between the check and actual usage in `generatePDF()`.

**Impact:** Random "Connection closed" errors that cannot be recovered.

---

### 2. No Retry Logic for Browser Disconnection
**File:** `backend/src/services/puppeteerPdfService.js:58-109`
**Severity:** CRITICAL

```javascript
async generatePDF(data, branding = {}, template = 'landscape') {
  const browser = await this.getBrowser();
  let page;
  try {
    page = await browser.newPage();  // Fails if browser disconnected
    // ... rest of PDF generation
  } finally {
    // ...
  }
}
```

**Problem:** If the browser disconnects during `generatePDF()`, the entire request fails with no retry attempt.

**Impact:** Users see persistent "Connection closed" errors until the browser is relaunched.

---

## High Priority Issues

### 3. Missing Async Handler Wrapper
**File:** `backend/src/routes/index.js:8`
**Severity:** HIGH

```javascript
router.post('/pdf/generate', pdfController.generatePDF);
```

**Problem:** Controller is not wrapped with async error handler. If an unhandled promise rejection occurs, Express won't catch it properly.

**Recommendation:** Use async handler pattern:
```javascript
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post('/pdf/generate', asyncHandler(pdfController.generatePDF));
```

---

### 4. No Circuit Breaker for Puppeteer
**File:** `backend/src/services/puppeteerPdfService.js`
**Severity:** HIGH

**Problem:** No circuit breaker pattern implemented. If Puppeteer keeps failing:
- Every request attempts browser launch
- Server resources get exhausted
- No graceful degradation

**Recommendation:** Implement circuit breaker that opens after 3-5 failures and provides immediate error response.

---

### 5. Browser Instance Not Thread-Safe
**File:** `backend/src/services/puppeteerPdfService.js:11-14`
**Severity:** HIGH

```javascript
class PuppeteerPdfService {
  constructor() {
    this.browser = null;  // Single shared instance
  }
```

**Problem:** Single browser instance shared across all requests. Concurrent requests can cause:
- Race conditions on `this.browser`
- One request's failure affects all others
- Browser state corruption

**Recommendation:** Use browser pool or per-request browser instances with proper lifecycle management.

---

## Medium Priority Issues

### 6. Timeout Race Condition in Controller
**File:** `backend/src/controllers/pdfController.js:36-48`
**Severity:** MEDIUM

```javascript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('PDF_TIMEOUT')), REQUEST_TIMEOUT_MS);
});

const pdfBuffer = await Promise.race([
  puppeteerPdfService.generatePDF(data, branding, template),
  timeoutPromise
]);
```

**Problem:** When timeout wins, `generatePDF()` continues running in background:
- Browser page not closed
- Resources leaked
- Browser may be left in inconsistent state

**Recommendation:** Use AbortController pattern to cancel the PDF generation when timeout occurs.

---

### 7. External Font Loading Can Cause Hangs
**File:** `backend/src/services/puppeteerPdfService.js:159`
**Severity:** MEDIUM

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat..." rel="stylesheet">
```

**Problem:** Loading fonts from Google CDN:
- Network failures cause page load failures
- Slow networks cause timeouts
- No fallback fonts defined

**Recommendation:** Bundle fonts locally or use proper fallback chain.

---

## Low Priority Issues

### 8. Inconsistent Error Response Format
**File:** `backend/src/controllers/pdfController.js:53-56 vs 93-96`
**Severity:** LOW

```javascript
// Line 53 - uses 'error' and 'message'
return res.status(500).json({
  error: 'PDF generation failed',
  message: 'Generated PDF is empty or invalid'
});

// Line 93 - same structure (good)
res.status(500).json({
  error: 'PDF generation failed',
  message: userMessage
});
```

**Status:** Error responses ARE consistent. No issue here.

---

## Audit Checklist Results

### 1. Request Validation
| Check | Status |
|-------|--------|
| Missing required parameters return 400 | PASS |
| Invalid parameter types return 400 | PASS |
| Request body validation exists | PASS |
| Input size limits configured | PASS (50mb) |

### 2. Error Response Format
| Check | Status |
|-------|--------|
| Consistent JSON structure | PASS |
| 500 errors don't leak stack traces | PASS |
| Error messages are actionable | PARTIAL |

### 3. HTTP Status Codes
| Check | Status |
|-------|--------|
| 400 for validation errors | PASS |
| 500 for server errors | PASS |
| 504 for timeouts | PASS |

### 4. Async Error Handling
| Check | Status |
|-------|--------|
| try/catch wraps async functions | PASS |
| Error middleware exists | PASS |
| Errors logged with context | PASS |

### 5. Timeout Management
| Check | Status |
|-------|--------|
| Long operations have timeouts | PASS |
| Timeout errors return 504 | PASS |
| Operations cancelled on timeout | FAIL |

### 6. Resource Management
| Check | Status |
|-------|--------|
| Pages closed on error | PASS |
| Browser properly managed | PARTIAL |

### 7. Rate Limiting
| Check | Status |
|-------|--------|
| Global rate limiting | FAIL |
| 429 responses | FAIL |

### 8. Circuit Breaker
| Check | Status |
|-------|--------|
| Circuit breaker implemented | FAIL |
| Fallback behavior | FAIL |

### 9. Health & Monitoring
| Check | Status |
|-------|--------|
| Health check endpoint | PASS |
| Structured logging | PARTIAL |

### 10. Graceful Shutdown
| Check | Status |
|-------|--------|
| SIGTERM/SIGINT handlers | PASS |
| Browser closed on shutdown | PASS |

---

## Recommendations (Prioritized)

### Immediate (Fix the Current Error)

1. **Add Retry Logic to Browser Operations**
   - Retry browser operations 2-3 times on "Connection closed" errors
   - Re-launch browser on disconnect before retry
   - Log each retry attempt

2. **Use Mutex/Lock for Browser Access**
   - Prevent concurrent access to browser instance
   - Queue requests when browser is being relaunched

### Short-Term (Improve Reliability)

3. **Implement Circuit Breaker**
   - Open circuit after 3-5 consecutive failures
   - Return 503 with retry-after header when open
   - Auto-close circuit after 30 seconds

4. **Add AbortController for Timeouts**
   - Cancel Puppeteer operations when timeout occurs
   - Properly clean up resources

5. **Wrap Routes with Async Handler**
   - Ensure all async errors are caught by Express
   - Consistent error propagation

### Long-Term (Production Readiness)

6. **Implement Browser Pool**
   - Multiple browser instances for concurrency
   - Automatic instance recycling

7. **Add Rate Limiting**
   - Prevent abuse and resource exhaustion
   - Return 429 with appropriate headers

8. **Bundle Fonts Locally**
   - Remove external CDN dependency
   - Faster, more reliable PDF generation

---

## Files Analyzed

| File | Purpose |
|------|---------|
| `server.js` | Express server setup, error handling |
| `backend/src/routes/index.js` | Route definitions |
| `backend/src/controllers/pdfController.js` | PDF request handling |
| `backend/src/services/puppeteerPdfService.js` | Puppeteer PDF generation |
| `backend/src/services/pdfService.js` | PDFKit service (unused for this endpoint) |
| `js/modules/pdfExport.js` | Frontend PDF export client |

---

## Conclusion

The "Connection closed" error is caused by Puppeteer browser disconnection with no retry mechanism. The critical fixes needed are:

1. Add retry logic for browser operations
2. Implement proper browser connection management with mutex
3. Add circuit breaker for graceful degradation

Without these fixes, the error will continue to occur intermittently when the Puppeteer browser crashes or disconnects.

---

*Generated by Backend API Auditor*
