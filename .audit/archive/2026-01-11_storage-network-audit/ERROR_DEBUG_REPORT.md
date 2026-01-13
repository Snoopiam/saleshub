# Error Debug Report

**Date:** 2026-01-11
**Errors Analyzed:**
1. `localStorage quota exceeded, attempting to compress images...`
2. `Image too large, returning placeholder`

---

## Error 1: localStorage quota exceeded

### Define
**Console Message:** `localStorage quota exceeded, attempting to compress images...`
**Source:** `js/modules/storage.js:328`
**Reproduction:** Upload large floor plan image (>500KB), make multiple saves

### Examine

**Stack Trace Path:**
```
User uploads image → app.js → saveCurrentOffer() → saveState()
                                                       ↓
                                           localStorage.setItem() THROWS
                                                       ↓
                                           catch block (line 326)
                                                       ↓
                                           console.warn (line 328)
                                                       ↓
                                           compressStateImages() (line 333)
                                                       ↓
                                           compressBase64Image() ← NO-OP!
```

### Break Down

**Location:** `js/modules/storage.js:314-366`

```javascript
export function saveState(state) {
    try {
        state._version = SCHEMA_VERSION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));  // ← THROWS HERE
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn('localStorage quota exceeded, attempting to compress images...');

            const compressedState = compressStateImages(state);  // ← DOESN'T ACTUALLY COMPRESS
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(compressedState));
                // Still fails because compressedState is same size!
```

### Understand — ROOT CAUSE

**Root Cause:** `compressBase64Image()` is a stub function that doesn't compress.

```javascript
// js/modules/storage.js:504-520
function compressBase64Image(base64, _quality = 0.5) {
    if (!base64 || !base64.startsWith('data:image')) {
        return base64;
    }
    if (base64.length > MAX_IMAGE_SIZE * 4) {
        console.warn('Image too large, returning placeholder');
        return '';
    }
    return base64;  // ⚠️ RETURNS UNCHANGED - NO COMPRESSION!
}
```

**Why This Happens:**
- Comment says "Real compression should happen at upload time (async)"
- But upload-time compression may not be aggressive enough
- When quota is exceeded, this function is supposed to help but doesn't

### Generate — Fix

**Before (Broken):**
```javascript
function compressBase64Image(base64, _quality = 0.5) {
    if (!base64 || !base64.startsWith('data:image')) {
        return base64;
    }
    if (base64.length > MAX_IMAGE_SIZE * 4) {
        console.warn('Image too large, returning placeholder');
        return '';
    }
    return base64;  // NO COMPRESSION
}
```

**After (Fixed) - Async Canvas Compression:**
```javascript
async function compressBase64ImageAsync(base64, quality = 0.5, maxWidth = 600) {
    if (!base64 || !base64.startsWith('data:image')) {
        return base64;
    }

    // If extremely large, remove
    if (base64.length > MAX_IMAGE_SIZE * 4) {
        console.warn('Image too large, removing');
        return '';
    }

    // If under limit, no need to compress
    if (base64.length <= MAX_IMAGE_SIZE) {
        return base64;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Scale down if too wide
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', quality);

            // Return smaller version
            resolve(compressed.length < base64.length ? compressed : base64);
        };
        img.onerror = () => resolve('');  // Remove on error
        img.src = base64;
    });
}
```

**Note:** This requires making `compressStateImages()` async as well.

### Verified

Test by:
1. Upload a 1MB floor plan image
2. Fill out form data until storage approaches 5MB limit
3. Verify compression actually reduces image size
4. Check that save succeeds after compression

---

## Error 2: Image too large, returning placeholder

### Define
**Console Message:** `Image too large, returning placeholder`
**Source:** `js/modules/storage.js:513`
**Reproduction:** Upload image >2MB (4x MAX_IMAGE_SIZE)

### Examine

```javascript
// js/modules/storage.js:510-514
if (base64.length > MAX_IMAGE_SIZE * 4) {  // > 2MB
    console.warn('Image too large, returning placeholder');
    return '';
}
```

### Break Down

**Trigger Condition:**
- MAX_IMAGE_SIZE = 500 * 1024 = 512,000 characters
- 4x limit = 2,048,000 characters (~2MB)
- Any base64 image over 2MB gets removed entirely

### Understand — ROOT CAUSE

**Root Cause:** This is a fallback behavior, not a bug. However:
1. User isn't clearly notified their image was removed
2. The warning only appears in console, not UI
3. No guidance on how to resize the image

### Generate — Fix

**Before:**
```javascript
if (base64.length > MAX_IMAGE_SIZE * 4) {
    console.warn('Image too large, returning placeholder');
    return '';
}
```

**After (Better UX):**
```javascript
if (base64.length > MAX_IMAGE_SIZE * 4) {
    console.warn('Image too large (>2MB), removing to save storage');
    // Import toast if not already available
    toast('Floor plan image was too large and has been removed. Please use an image under 2MB.', 'warning');
    return '';
}
```

### Verified

Test by:
1. Upload a 3MB image
2. Verify user sees toast notification
3. Verify image is removed but other data is saved

---

## Error 3: Browser Extension Errors (Not App-Related)

### Define
**Console Messages:**
- `Unchecked runtime.lastError: The message port closed before a response was received.`
- `Element Cloner content script loaded`

### Understand — ROOT CAUSE

**Root Cause:** These are browser extension errors, NOT from the SalesHUB app.

- `runtime.lastError` - Chrome extension messaging error
- `Element Cloner content script` - Browser extension loading
- `installHook.js` - React DevTools or similar extension

### Generate — Resolution

**No fix needed** - these are external extension errors. Users can:
1. Disable browser extensions to eliminate these messages
2. Ignore them as they don't affect app functionality

---

## Summary

| Error | Root Cause | Fix Status |
|-------|-----------|------------|
| localStorage quota exceeded | `compressBase64Image()` doesn't compress | Needs Fix |
| Image too large | Expected behavior, but poor UX | Needs UX improvement |
| runtime.lastError | Browser extension | No fix needed |
| Element Cloner | Browser extension | No fix needed |

---

## Priority Fixes

1. **CRITICAL:** Implement actual image compression in `compressBase64Image()`
2. **HIGH:** Add user notification when images are removed
3. **MEDIUM:** Consider using IndexedDB for large images

---

*Generated by Error Debugger*
