diff --git a/js/modules/beta.js b/js/modules/beta.js
index f4c4a98479b352768ca1a9d39e70d6bedacc6a7d..e78733de1acf1c6b1530461ca8404a9b0194bb79 100644
--- a/js/modules/beta.js
+++ b/js/modules/beta.js
@@ -7,61 +7,55 @@ import { getById, queryAll, toast, formatCurrency, getNumericValue, getValue, cr
 import { loadState, saveState, getCurrentOffer, getTemplates, deleteTemplate } from './storage.js';

 // BETA feature flags
 const BETA_FEATURES = {
     datePicker: true,
     currencyFormatting: true,
     dropdowns: true,
     zoomControls: true,
     offersDashboard: true,
     whatsappShare: true,
     pricePerSqft: true,
     calculators: true,
     enhancedExport: true,
     tooltips: true
 };

 let isBetaEnabled = false;

 // AbortController for cleaning up event listeners when BETA is disabled
 let betaAbortController = null;

 /**
  * Initialize BETA module
  */
 export function initBeta() {
-    // Load saved BETA state
     const state = loadState();
-    isBetaEnabled = state.betaEnabled || false;
-
-    // Create BETA toggle in header
-    createBetaToggle();
-
-    // Apply BETA state
-    if (isBetaEnabled) {
-        enableBetaFeatures();
-    }
+    isBetaEnabled = true;
+    state.betaEnabled = true;
+    saveState(state);
+    enableBetaFeatures();
 }

 /**
  * Initialize BETA toggle switch (toggle is now in HTML, just add event listener)
  */
 function createBetaToggle() {
     const toggle = getById('betaToggle');
     if (!toggle) return;

     // Set initial state from saved preference
     toggle.checked = isBetaEnabled;

     // Add event listener
     toggle.addEventListener('change', (e) => {
         isBetaEnabled = e.target.checked;
         saveBetaState();
         if (isBetaEnabled) {
             enableBetaFeatures();
             toast('BETA features enabled!', 'success');
         } else {
             disableBetaFeatures();
             toast('BETA features disabled', 'info');
         }
     });
 }
