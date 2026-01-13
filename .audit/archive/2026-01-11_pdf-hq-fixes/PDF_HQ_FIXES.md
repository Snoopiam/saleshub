# PDF (HQ) Export Fixes - 2026-01-11

## Summary

Three critical issues with PDF (HQ) export were identified and fixed:

| Issue | Root Cause | Status |
|-------|-----------|--------|
| Total Initial Payment missing | `saveFormData()` didn't include `totalPayment` | **FIXED** |
| Style/design differences | CSS values not synced with frontend preview | **FIXED** |
| Image quality reduced | `window.originalImages` lost on page refresh | **FIXED** |

---

## Issue 1: Total Initial Payment Not Captured

### Problem
The "Total Initial Payment" field showed `undefined` or blank in generated PDFs, even though the value was visible in the browser preview.

### Root Cause
`saveFormData()` in `js/app.js` was not including the `totalPayment` field in the offer object sent to the PDF API.

### Fix Applied
**File:** `js/app.js` (line 224)

```javascript
function saveFormData() {
    const offer = {
        projectName: getVal('input-projectName'),
        developerName: getVal('input-developerName'),
        // ... other fields ...

        // FIX: Include calculated total for PDF export
        totalPayment: calculateTotal(),

        paymentPlan: getPaymentPlan(),
        readyProperty: getReadyPropertyData()
    };
    saveCurrentOffer(offer);
}
```

### Verification
PDF template correctly references this value at `puppeteerPdfService.js:599-600`:
```html
<td>Total Initial Payment</td>
<td>${formatCurrency(data.totalPayment)}</td>
```

---

## Issue 2: Style/Design Differences

### Problem
PDF output had subtle styling differences compared to the browser preview:
- Floor plan shadow was lighter
- Footer font size was larger
- Created-by footer positioning was off
- Fonts sometimes didn't load properly

### Root Cause
CSS values in `puppeteerPdfService.js` were not synchronized with `css/preview.css` and `css/landscape.css`.

### Fixes Applied
**File:** `backend/src/services/puppeteerPdfService.js`

| Element | Before | After | Source |
|---------|--------|-------|--------|
| Floor plan shadow | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.603)` | preview.css |
| Footer font-size | `18px` | `14px` | preview.css |
| Created-by bottom | `4mm` | `5mm` | preview.css |
| Created-by font-size | (missing) | `8px` | preview.css |
| Created-by overflow | (missing) | `nowrap + ellipsis` | preview.css |
| Font import | `0,400;0,600...` | `0,400;0,600...;1,400` | Added italic |
| waitUntil | `['load', 'domcontentloaded']` | `['load', 'domcontentloaded', 'networkidle0']` | Font loading |

### CSS Changes Detail

```css
/* Floor plan shadow - SYNCED */
.floorplan-img {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.603));
}

/* Footer project name - SYNCED */
.footer-proj {
  font-size: 14px;
}

/* Created By footer - SYNCED */
.created-by-footer {
  position: absolute;
  bottom: 5mm;
  right: 5mm;
  font-size: 8px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Puppeteer waitUntil
Added `networkidle0` to ensure all fonts and resources are fully loaded before PDF generation:
```javascript
await page.goto(htmlDataUrl, {
  waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
  timeout: 30000
});
```

---

## Issue 3: Image Quality Reduced

### Problem
Floor plan and logo images appeared at reduced quality in the PDF, even though high-resolution originals were uploaded.

### Root Cause
The dual storage strategy stored originals in `window.originalImages`, but this was lost on page refresh. After refresh, the system fell back to compressed localStorage images (800px/60% quality for floor plans, 400px/70% for logos).

### Fix Applied
Created persistent storage using IndexedDB that survives page refresh.

**New File:** `js/modules/imageStorage.js`

```javascript
// IndexedDB wrapper for persistent original image storage
const DB_NAME = 'SalesHubImages';
const STORE_NAME = 'originalImages';

export async function saveImage(key, file) {
  // Stores original File/Blob in IndexedDB
}

export async function loadImage(key) {
  // Retrieves original from IndexedDB
}

export async function getImageAsBase64(key) {
  // Gets base64 for PDF export (tries IndexedDB first, then window.originalImages)
}

export async function restoreImages() {
  // Called on page load to restore images to window.originalImages
}
```

**Modified Files:**

| File | Changes |
|------|---------|
| `js/app.js` | Import imageStorage, call `restoreImages()` in `init()`, save floor plan with `saveImage('floorPlan', file)` |
| `js/modules/branding.js` | Import imageStorage, save logo with `saveImage('logo', file)` |
| `js/modules/pdfExport.js` | Import imageStorage, use `getImageAsBase64()` before PDF export |

### Storage Strategy (Updated)

| Layer | Storage | Persistence | Purpose |
|-------|---------|-------------|---------|
| 1 | IndexedDB | Permanent | Original quality images |
| 2 | `window.originalImages` | Session | Runtime cache (restored from IndexedDB) |
| 3 | localStorage | Permanent | Compressed previews (fallback) |

### Image Flow

```
Upload → Save to IndexedDB (original)
       → Store in window.originalImages (cache)
       → Compress & save to localStorage (preview)

Page Load → Restore from IndexedDB to window.originalImages
          → Display from localStorage (preview)

PDF Export → Try IndexedDB first
           → Fallback to window.originalImages
           → Use original quality for PDF
```

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `js/modules/imageStorage.js` | +251 (new) | IndexedDB storage module |
| `js/app.js` | ~20 | Added totalPayment, IndexedDB integration |
| `js/modules/branding.js` | ~10 | IndexedDB for logo storage |
| `js/modules/pdfExport.js` | ~25 | Load from IndexedDB before export |
| `backend/src/services/puppeteerPdfService.js` | ~15 | CSS sync, networkidle0 |

---

## Testing

### API Test
```bash
curl -X POST http://localhost:8000/api/pdf/generate \
  -H "Content-Type: application/json" \
  -d '{"data": {"totalPayment": 660000, ...}}'
```
Result: HTTP 200, 100KB PDF generated successfully

### Manual Test Steps
1. Open http://localhost:8000
2. Upload a high-resolution floor plan image
3. Enter financial data (ensure Total Initial Payment shows)
4. Refresh page (images should persist)
5. Click "Export PDF (HQ)"
6. Verify:
   - Total Initial Payment is correct
   - Styling matches browser preview
   - Images are original quality

---

## Related Documentation

- [Dual Storage Strategy](../2026-01-11_storage-network-audit/DUAL_STORAGE_STRATEGY.md)
- [PDF API Audit](../2026-01-10_pdf-api-audit/AUDIT_REPORT.md)
