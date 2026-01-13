# Dual Storage Strategy - Implementation Plan

**Date:** 2026-01-11
**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** CRITICAL

---

## Problem Statement

1. `compressBase64Image()` is a NO-OP - doesn't actually compress
2. localStorage has 5MB limit - fills up with large images
3. When quota exceeded, images are silently deleted
4. PDF quality suffers when using heavily compressed images

---

## Solution: Dual Storage Strategy

Keep **two versions** of each image:

| Version | Storage | Quality | Purpose |
|---------|---------|---------|---------|
| Original | Memory (`window.originalImages`) | 100% | PDF generation |
| Compressed | localStorage | 50-70% | Preview/Auto-save |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER UPLOADS IMAGE                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Store Original in Memory                                        │
│                                                                          │
│  window.originalImages.floorPlan = file;  // File object                 │
│  window.originalImages.logo = file;                                      │
│                                                                          │
│  Benefits:                                                               │
│  • No size limit (within browser memory)                                 │
│  • Original quality preserved                                            │
│  • Fast access                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Compress for localStorage                                       │
│                                                                          │
│  const compressed = await compressImageFile(file, 800, 0.6);             │
│  saveCurrentOffer({ floorPlanImage: compressed });                       │
│                                                                          │
│  Settings:                                                               │
│  • Floor plan: 800px max width, 60% quality                              │
│  • Logo: 400px max width, 70% quality                                    │
│                                                                          │
│  Benefits:                                                               │
│  • Fits in localStorage quota                                            │
│  • Fast preview rendering                                                │
│  • Auto-save works reliably                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: PDF Export Uses Original                                        │
│                                                                          │
│  // In export.js / pdfExport.js:                                         │
│  const floorPlan = window.originalImages?.floorPlan                      │
│    ? await fileToBase64(window.originalImages.floorPlan)                 │
│    : data.floorPlanImage;  // Fallback to compressed                     │
│                                                                          │
│  Benefits:                                                               │
│  • PDF gets original quality                                             │
│  • Graceful fallback if original not available                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `js/utils/helpers.js` | Add `fileToBase64()` helper |
| `js/app.js` | Store original on floor plan upload |
| `js/modules/branding.js` | Store original on logo upload, add compression |
| `js/modules/pdfExport.js` | Use original images for PDF export |

---

## Implementation Details

### 1. Global Image Store (helpers.js or app.js)

```javascript
/**
 * Global store for original quality images
 * Used for PDF generation while localStorage holds compressed versions
 * Cleared on page unload (acceptable - user can re-upload)
 */
window.originalImages = {
  floorPlan: null,  // File or Blob object
  logo: null        // File or Blob object
};
```

### 2. Floor Plan Upload (app.js)

```javascript
// BEFORE:
compressImageFile(file, 2000, 0.92).then(compressedDataUrl => {
    saveCurrentOffer({ floorPlanImage: compressedDataUrl });
});

// AFTER:
// Store original for PDF generation
window.originalImages.floorPlan = file;

// Compress more aggressively for localStorage
compressImageFile(file, 800, 0.6).then(compressedDataUrl => {
    saveCurrentOffer({ floorPlanImage: compressedDataUrl });
});
```

### 3. Logo Upload (branding.js)

```javascript
// BEFORE:
const reader = new FileReader();
reader.onload = (e) => {
    const base64 = e.target.result;  // Full size, no compression!
    showLogoPreview(base64);
};
reader.readAsDataURL(file);

// AFTER:
// Store original for PDF generation
window.originalImages.logo = file;

// Compress for localStorage
compressImageFile(file, 400, 0.7).then(compressedDataUrl => {
    showLogoPreview(compressedDataUrl);
});
```

### 4. PDF Export (pdfExport.js)

```javascript
// BEFORE:
body: JSON.stringify({
    data: data,
    branding: branding,
    template: template
})

// AFTER:
// Use original images if available
const pdfData = { ...data };
const pdfBranding = { ...branding };

if (window.originalImages?.floorPlan) {
    pdfData.floorPlanImage = await fileToBase64(window.originalImages.floorPlan);
}
if (window.originalImages?.logo) {
    pdfBranding.logo = await fileToBase64(window.originalImages.logo);
}

body: JSON.stringify({
    data: pdfData,
    branding: pdfBranding,
    template: template
})
```

### 5. Helper Function (helpers.js)

```javascript
/**
 * Convert File/Blob to base64 data URL
 * @param {File|Blob} file - File to convert
 * @returns {Promise<string>} Base64 data URL
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
```

---

## Quality Comparison

| Scenario | localStorage | PDF Output |
|----------|-------------|------------|
| **Before** | 2000px, 92% | 2000px, 92% |
| **After** | 800px, 60% | Original (100%) |

**Result:** localStorage uses ~4x less space, PDF quality improves!

---

## Tradeoffs

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Original lost on refresh | User must re-upload | Acceptable UX |
| Memory usage | ~5-10MB per image | Cleared on page unload |
| Complexity | Slight increase | Well-documented code |

---

## Success Criteria

- [ ] No more "localStorage quota exceeded" errors
- [ ] PDF images are original quality
- [ ] Preview images load quickly
- [ ] Auto-save works reliably
- [ ] Memory cleared on page unload

---

## Rollback Plan

If issues occur:
1. Remove `window.originalImages` usage
2. Revert to single-storage approach
3. Increase compression at upload time

---

*Approved for implementation on 2026-01-11*
