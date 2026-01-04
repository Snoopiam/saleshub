diff --git a/js/modules/pdfGenerator.js b/js/modules/pdfGenerator.js
index f866cdd9936038e64bac83bd854272f1e1199fb2..4eb231387c3a137be17eb7c95440d37449eb69de 100644
--- a/js/modules/pdfGenerator.js
+++ b/js/modules/pdfGenerator.js
@@ -23,100 +23,230 @@ function registerFonts(doc) {
     doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');
     doc.addFont('Montserrat-SemiBold.ttf', 'Montserrat', 'semibold');
     doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');
 }

 /**
  * Generate text-based PDF matching the preview layout
  * @param {string} filename - Filename without extension
  * @returns {Promise<boolean>} Success status
  */
 export async function generateTextPDF(filename) {
     const { jsPDF } = window.jspdf;
     const template = getCurrentTemplate();
     const isPortrait = template === 'portrait';

     // A4 dimensions in mm
     const pageWidth = isPortrait ? 210 : 297;
     const pageHeight = isPortrait ? 297 : 210;
     const margin = 11;

     // Get brand color
     const brandColorHex = window.getComputedStyle(document.documentElement)
         .getPropertyValue('--primary-color').trim() || '#62c6c1';
     const primaryColor = hexToRgb(brandColorHex);

-    // Layout measurements
-    const headerBarHeight = 8;
-    const leftColWidth = (pageWidth - margin * 2) * 0.40;
-    const rightColX = margin + leftColWidth + 8;
-    const rightColWidth = (pageWidth - margin * 2) * 0.60 - 8;
-
     const doc = new jsPDF({
         orientation: isPortrait ? 'portrait' : 'landscape',
         unit: 'mm',
         format: 'a4',
         compress: true
     });

     // Register Montserrat fonts
     registerFonts(doc);

-    let yPos = headerBarHeight + 5; // CSS: margin-top 5mm
+    const layout = getLayoutMetrics(pageWidth, pageHeight);
+    if (layout) {
+        renderFromPreviewLayout(doc, layout, primaryColor);
+    } else {
+        const headerBarHeight = 8;
+        const leftColWidth = (pageWidth - margin * 2) * 0.40;
+        const rightColX = margin + leftColWidth + 8;
+        const rightColWidth = (pageWidth - margin * 2) * 0.60 - 8;
+
+        let yPos = headerBarHeight + 5; // CSS: margin-top 5mm

-    // Draw header bar
-    drawHeaderBar(doc, pageWidth, headerBarHeight, primaryColor);
+        // Draw header bar
+        drawHeaderBar(doc, pageWidth, headerBarHeight, primaryColor);

-    // Draw logo
-    drawLogo(doc, pageWidth);
+        // Draw logo
+        drawLogo(doc, pageWidth);

-    // Draw main title
-    yPos = drawMainTitle(doc, margin, yPos);
+        // Draw main title
+        yPos = drawMainTitle(doc, margin, yPos);

-    // Draw Property Details table
-    yPos = drawPropertyDetailsTable(doc, yPos, margin, leftColWidth, primaryColor);
+        // Draw Property Details table
+        yPos = drawPropertyDetailsTable(doc, yPos, margin, leftColWidth, primaryColor);

-    // Draw Financial Breakdown table
-    yPos = drawFinancialTable(doc, yPos, margin, leftColWidth, primaryColor);
+        // Draw Financial Breakdown table
+        yPos = drawFinancialTable(doc, yPos, margin, leftColWidth, primaryColor);

-    // Draw Property Status table (Ready properties)
-    yPos = drawPropertyStatusTable(doc, yPos, margin, leftColWidth, primaryColor);
+        // Draw Property Status table (Ready properties)
+        yPos = drawPropertyStatusTable(doc, yPos, margin, leftColWidth, primaryColor);

-    // Draw Payment Plan table (Off-Plan)
-    drawPaymentPlanTable(doc, yPos, margin, leftColWidth, primaryColor);
+        // Draw Payment Plan table (Off-Plan)
+        drawPaymentPlanTable(doc, yPos, margin, leftColWidth, primaryColor);

-    // Draw floor plan image
-    drawFloorPlanImage(doc, rightColX, rightColWidth, headerBarHeight, pageHeight);
+        // Draw floor plan image
+        drawFloorPlanImage(doc, rightColX, rightColWidth, headerBarHeight, pageHeight);

-    // Draw footer
-    drawFooter(doc, pageWidth, pageHeight, margin, primaryColor);
+        // Draw footer
+        drawFooter(doc, pageWidth, pageHeight, margin, primaryColor);
+    }

     // Save
     doc.save(`${filename}.pdf`);
     return true;
 }

+function getLayoutMetrics(pageWidth, pageHeight) {
+    const page = getById('a4Page');
+    if (!page) return null;
+    const originalTransform = page.style.transform;
+    const originalTransition = page.style.transition;
+    if (originalTransform && originalTransform !== 'none') {
+        page.style.transition = 'none';
+        page.style.transform = 'none';
+    }
+    const rect = page.getBoundingClientRect();
+    if (originalTransform && originalTransform !== 'none') {
+        page.style.transform = originalTransform;
+        page.style.transition = originalTransition;
+    }
+    if (!rect.width || !rect.height) return null;
+
+    return {
+        page,
+        rect,
+        scaleX: pageWidth / rect.width,
+        scaleY: pageHeight / rect.height
+    };
+}
+
+function pxToMmX(layout, px) {
+    return (px - layout.rect.left) * layout.scaleX;
+}
+
+function pxToMmY(layout, px) {
+    return (px - layout.rect.top) * layout.scaleY;
+}
+
+function pxToPt(px) {
+    return px * 0.75;
+}
+
+function parseRgb(color) {
+    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
+    if (!match) return null;
+    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
+}
+
+function getFontStyle(weight) {
+    if (weight === 'bold' || weight === 'bolder') return 'bold';
+    if (weight === 'normal' || weight === 'lighter') return 'normal';
+    const numeric = parseInt(weight, 10);
+    if (Number.isNaN(numeric)) return 'normal';
+    if (numeric >= 800) return 'black';
+    if (numeric >= 600) return 'bold';
+    if (numeric >= 500) return 'semibold';
+    return 'normal';
+}
+
+function isVisible(el) {
+    if (!el) return false;
+    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
+    const style = getComputedStyle(el);
+    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
+}
+
+function renderFromPreviewLayout(doc, layout, primaryColor) {
+    const headerBar = document.querySelector('#a4Page .header-bar');
+    if (headerBar) {
+        const rect = headerBar.getBoundingClientRect();
+        const color = parseRgb(getComputedStyle(headerBar).backgroundColor) || primaryColor;
+        doc.setFillColor(...color);
+        doc.rect(0, 0, layout.rect.width * layout.scaleX, rect.height * layout.scaleY, 'F');
+    }
+
+    const logo = getById('logoImg');
+    if (logo && logo.src && isVisible(logo)) {
+        const rect = logo.getBoundingClientRect();
+        const x = pxToMmX(layout, rect.left);
+        const y = pxToMmY(layout, rect.top);
+        const w = rect.width * layout.scaleX;
+        const h = rect.height * layout.scaleY;
+        try {
+            doc.addImage(logo.src, 'PNG', x, y, w, h, undefined, 'SLOW');
+        } catch (e) {
+            console.warn('Logo could not be added to PDF:', e);
+        }
+    }
+
+    const floorPlan = getById('floorPlanImg');
+    if (floorPlan && floorPlan.src && isVisible(floorPlan)) {
+        const rect = floorPlan.getBoundingClientRect();
+        const x = pxToMmX(layout, rect.left);
+        const y = pxToMmY(layout, rect.top);
+        const w = rect.width * layout.scaleX;
+        const h = rect.height * layout.scaleY;
+        try {
+            doc.addImage(floorPlan.src, 'PNG', x, y, w, h, undefined, 'SLOW');
+        } catch (e) {
+            console.warn('Floor plan could not be added to PDF:', e);
+        }
+    }
+
+    const textNodes = document.querySelectorAll(
+        '#a4Page .section-label, #a4Page .main-title, #a4Page .table-title, #a4Page .data-table td, #a4Page .payment-plan-table th, #a4Page .payment-plan-table td, #a4Page .footer-proj, #a4Page .footer-sub, #a4Page .created-by-footer'
+    );
+    textNodes.forEach((node) => {
+        if (!isVisible(node)) return;
+        const text = node.textContent.trim();
+        if (!text) return;
+        const rect = node.getBoundingClientRect();
+        const style = getComputedStyle(node);
+        const fontSize = pxToPt(parseFloat(style.fontSize));
+        const fontStyle = getFontStyle(style.fontWeight);
+        const color = parseRgb(style.color) || [17, 24, 39];
+        const align = style.textAlign === 'right' ? 'right' : style.textAlign === 'center' ? 'center' : 'left';
+
+        doc.setFont('Montserrat', fontStyle);
+        doc.setFontSize(fontSize);
+        doc.setTextColor(...color);
+
+        const x = align === 'right'
+            ? pxToMmX(layout, rect.right)
+            : align === 'center'
+                ? pxToMmX(layout, rect.left + rect.width / 2)
+                : pxToMmX(layout, rect.left);
+        const y = pxToMmY(layout, rect.top);
+
+        doc.text(text, x, y, { baseline: 'top', align });
+    });
+}
+
 /**
  * Draw the colored header bar
  */
 function drawHeaderBar(doc, pageWidth, height, color) {
     doc.setFillColor(...color);
     doc.rect(0, 0, pageWidth, height, 'F');
 }

 /**
  * Draw company logo
  * CSS: top: 12mm, right: 15mm, width: 130px (~34mm), height: 65px (~17mm)
  */
 function drawLogo(doc, pageWidth) {
     const logoImg = getById('logoImg');
     if (logoImg && logoImg.src) {
         try {
             const logoWidth = 34;  // 130px ≈ 34mm
             const logoHeight = 17; // 65px ≈ 17mm
             const logoX = pageWidth - 15 - logoWidth; // right: 15mm
             const logoY = 12; // top: 12mm
             doc.addImage(logoImg.src, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');
         } catch (e) {
             console.warn('Logo could not be added to PDF:', e);
         }
     }
