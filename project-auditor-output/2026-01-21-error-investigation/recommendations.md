# Fix Implementation Plan

## Fix 1: Logo Path (5 min)

**File**: `index.html:784`

**Current**:
```html
<img src="assets/logos/KP_blACK.png" alt="Company Logo" class="logo-img" id="logoImg">
```

**Fixed**:
```html
<img src="assets/logos/KP_Black_new.png" alt="Company Logo" class="logo-img" id="logoImg">
```

---

## Fix 2: Favicon (5 min)

**File**: `index.html` (inside `<head>` section)

**Add**:
```html
<link rel="icon" type="image/png" href="assets/logos/KP_Black_new.png">
```

---

## Fix 3: Increase Server Body Limit (5 min)

**File**: `server.js:120-121`

**Current**:
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**Fixed**:
```javascript
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
```

---

## Fix 4: Increase Controller Image Limit (5 min)

**File**: `backend/src/controllers/pdfController.js:21`

**Current**:
```javascript
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
```

**Fixed**:
```javascript
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
```

---

## Fix 5: Add Client-Side Image Compression (20 min)

**File**: `js/modules/pdfExport.js`

**Add compression function before sending to API**:

```javascript
/**
 * Compress image if it exceeds size limit
 * @param {string} base64Image - Base64 encoded image
 * @param {number} maxSizeKB - Maximum size in KB (default 5000 = 5MB)
 * @param {number} quality - JPEG quality (0-1, default 0.8)
 * @returns {Promise<string>} Compressed base64 image
 */
async function compressImageIfNeeded(base64Image, maxSizeKB = 5000, quality = 0.8) {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    return base64Image;
  }

  // Calculate current size in KB
  const base64Data = base64Image.split(',')[1] || base64Image;
  const currentSizeKB = Math.floor((base64Data.length * 3) / 4 / 1024);

  // If under limit, return as-is
  if (currentSizeKB <= maxSizeKB) {
    console.log(`[PDF Export] Image is ${currentSizeKB}KB, under ${maxSizeKB}KB limit`);
    return base64Image;
  }

  console.log(`[PDF Export] Compressing image from ${currentSizeKB}KB to under ${maxSizeKB}KB`);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');

      // Calculate scale factor based on size ratio
      const ratio = Math.sqrt(maxSizeKB / currentSizeKB);
      canvas.width = Math.floor(img.width * ratio);
      canvas.height = Math.floor(img.height * ratio);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to JPEG for better compression
      const compressed = canvas.toDataURL('image/jpeg', quality);
      const newSizeKB = Math.floor((compressed.split(',')[1].length * 3) / 4 / 1024);
      console.log(`[PDF Export] Compressed to ${newSizeKB}KB (${canvas.width}x${canvas.height})`);

      resolve(compressed);
    };
    img.onerror = () => {
      console.warn('[PDF Export] Failed to compress image, using original');
      resolve(base64Image);
    };
    img.src = base64Image;
  });
}
```

**Modify `getOriginalImagesForPDF` function to use compression**:

```javascript
// After getting floor plan, compress if needed
if (pdfData.floorPlanImage) {
  pdfData.floorPlanImage = await compressImageIfNeeded(pdfData.floorPlanImage, 5000);
}

// After getting logo, compress if needed
if (pdfBranding.logo) {
  pdfBranding.logo = await compressImageIfNeeded(pdfBranding.logo, 2000);
}
```

---

## Fix 6: Update Dev Dependencies (Optional)

```bash
npm update vitest @vitest/coverage-v8
```

---

## Verification Checklist

After implementing fixes:

- [ ] Logo loads without 404
- [ ] Favicon loads without 404
- [ ] PDF generation works with large images (8MB+)
- [ ] All tests pass (`npm test`)
- [ ] Server restarts cleanly (`npm start`)
