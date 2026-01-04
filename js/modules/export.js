diff --git a/js/modules/export.js b/js/modules/export.js
index 91b609cdb14647f8c79c06251dd3710eda1e0d36..afde4da890c6f0da302bd8ecdd7326ec02b5bb9f 100644
--- a/js/modules/export.js
+++ b/js/modules/export.js
@@ -1,124 +1,157 @@
 /**
  * Export Module
  * PDF, PNG, and JSON export functionality
  */

 import { getById, toast, getValue } from '../utils/helpers.js';
 import { exportOfferAsJSON } from './storage.js';
 import { getCurrentTemplate } from './templates.js';
 import { generateTextPDF } from './pdfGenerator.js';

 /**
  * Initialize export functionality
  */
 export function initExport() {
     // Export button opens modal
     const exportBtn = getById('exportBtn');
     if (exportBtn) {
         exportBtn.addEventListener('click', openExportModal);
     }

+    const exportEditableBtn = getById('exportEditableBtn');
+    if (exportEditableBtn) {
+        exportEditableBtn.addEventListener('click', async () => {
+            const filename = getDefaultFilename();
+            await exportPDF(filename);
+        });
+    }
+
+    const exportHybridBtn = getById('exportHybridBtn');
+    if (exportHybridBtn) {
+        exportHybridBtn.addEventListener('click', async () => {
+            const filename = getDefaultFilename();
+            await exportHybridPDF(filename);
+        });
+    }
+
     // Do export button in modal
     const doExportBtn = getById('doExportBtn');
     if (doExportBtn) {
         doExportBtn.addEventListener('click', handleExport);
     }

     // Print button
     const printBtn = getById('printBtn');
     if (printBtn) {
         printBtn.addEventListener('click', () => {
             window.print();
         });
     }
 }

 /**
  * Open export modal
  */
 function openExportModal() {
     const modal = getById('exportModal');
     if (modal) {
         modal.classList.remove('hidden');

         // Set default filename
-        const projectName = getValue('input-project-name') || 'sales-offer';
         const filename = getById('exportFilename');
         if (filename) {
-            filename.value = projectName.toLowerCase().replace(/\s+/g, '-');
+            filename.value = getDefaultFilename();
         }
     }
 }

 /**
  * Handle export based on selected format
  */
 async function handleExport() {
     const format = document.querySelector('input[name="exportFormat"]:checked')?.value;
-    const filename = getValue('exportFilename') || 'sales-offer';
+    const filename = getValue('exportFilename') || getDefaultFilename();

     switch (format) {
         case 'pdf':
             await exportPDF(filename);
             break;
+        case 'hybrid':
+            await exportHybridPDF(filename);
+            break;
         case 'pdf_preview':
             await exportPreviewPDF(filename);
             break;
         case 'png':
             await exportImage(filename, 'png');
             break;
         case 'jpg':
             await exportImage(filename, 'jpg');
             break;
         case 'json':
             exportJSON(filename);
             break;
         default:
             toast('Please select an export format', 'error');
     }

     // Close modal
     closeExportModal();
 }

 /**
  * Export as text-based PDF using jsPDF (selectable text)
  * Uses separate pdfGenerator module for layout
  * @param {string} filename - Filename without extension
  */
 async function exportPDF(filename) {
     toast('Generating PDF...', 'info');

     try {
         await generateTextPDF(filename);
         toast('PDF exported successfully', 'success');
     } catch (error) {
         toast('PDF export failed: ' + error.message, 'error');
     }
 }

+/**
+ * Export hybrid PDFs: editable text + visual match
+ * @param {string} filename - Base filename without extension
+ */
+async function exportHybridPDF(filename) {
+    toast('Generating hybrid PDFs...', 'info');
+    try {
+        await exportPDF(filename);
+        await exportPreviewPDF(`${filename}-visual`);
+        toast('Hybrid PDFs exported successfully', 'success');
+    } catch (error) {
+        toast('Hybrid PDF export failed: ' + error.message, 'error');
+    }
+}
+
 /**
  * Export as visual PDF matching the live preview (non-selectable text)
  * @param {string} filename - Filename without extension
  */
 async function exportPreviewPDF(filename) {
     const element = getById('a4Page');
     if (!element) {
         toast('Document not found', 'error');
         return;
     }

     toast('Generating preview PDF...', 'info');

     try {
         const template = getCurrentTemplate();
         const isPortrait = template === 'portrait';

         await html2pdf()
             .set({
                 margin: 0,
                 filename: `${filename}.pdf`,
                 image: { type: 'jpeg', quality: 1.0 },
                 html2canvas: {
                     scale: 3,
                     useCORS: true,
@@ -214,43 +247,48 @@ function exportJSON(filename) {
         const link = document.createElement('a');
         link.href = url;
         link.download = `${filename}.json`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url);

         toast('JSON exported successfully', 'success');
     } catch (error) {
         console.error('JSON export failed:', error);
         toast('JSON export failed', 'error');
     }
 }

 /**
  * Close export modal
  */
 function closeExportModal() {
     const modal = getById('exportModal');
     if (modal) {
         modal.classList.add('hidden');
     }
 }

+function getDefaultFilename() {
+    const projectName = getValue('input-project-name') || 'saleshub-offer';
+    return projectName.toLowerCase().replace(/\s+/g, '-');
+}
+
 /**
  * Download helper
  * @param {string} content - File content
  * @param {string} filename - Filename
  * @param {string} mimeType - MIME type
  */
 export function downloadFile(content, filename, mimeType) {
     const blob = new Blob([content], { type: mimeType });
     const url = URL.createObjectURL(blob);

     const link = document.createElement('a');
     link.href = url;
     link.download = filename;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
 }
