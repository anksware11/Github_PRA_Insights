// ============================================================================
// FEATURE GATING IMPLEMENTATION GUIDE
// ============================================================================
//
// This guide explains how the Free/Pro feature gating system works and how
// to add new gated features to the PR Quick Insight extension.
//
// ============================================================================
// QUICK START
// ============================================================================
//
// 1. Define the feature in featureFlags.js
// 2. Check the feature in your code using isFeatureEnabled()
// 3. The LicenseManager automatically handles plan detection
//
// ============================================================================
// ARCHITECTURE OVERVIEW
// ============================================================================
//
// Three main components work together:
//
// ┌─────────────────────────────────────┐
// │    featureFlags.js                  │
// │  Defines which features are in      │
// │  each plan tier (FREE/PRO)          │
// └────────────┬────────────────────────┘
//              │
// ┌────────────▼────────────────────────┐
// │    licenseManager.js                │
// │  Handles license key validation     │
// │  and plan detection                 │
// └────────────┬────────────────────────┘
//              │
// ┌────────────▼────────────────────────┐
// │    content.js & popup.js            │
// │  Calls isFeatureEnabled() to check   │
// │  if features are available          │
// └─────────────────────────────────────┘
//
// ============================================================================
// ADDING A NEW FEATURE
// ============================================================================
//
// Step 1: Add to featureFlags.js
// ─────────────────────────────────
//
//   PRO: {
//     features: {
//       // ... existing features ...
//       canNewAwesomeFeature: true,      // Only in PRO
//     }
//   }
//
//   FREE: {
//     features: {
//       // ... existing features ...
//       canNewAwesomeFeature: false,     // Not in FREE
//     }
//   }
//
// Step 2: Gate the feature in your code
// ─────────────────────────────────────
//
//   In content.js or popup.js:
//
//   if (isFeatureEnabled('canNewAwesomeFeature', state.currentPlan)) {
//     // Show/enable the feature
//     showAwesomeFeature();
//   } else {
//     // Hide feature or show "Pro only" message
//     hideAwesomeFeature();
//   }
//
// Step 3: Add UI hint for locked features (optional)
// ───────────────────────────────────────────────────
//
//   Add a lock icon or "🔒 Pro Feature" label to communicate that
//   the feature requires a Pro license.
//
// ============================================================================
// COMMON PATTERNS
// ============================================================================
//
// Pattern 1: Hide entire section if feature not enabled
// ────────────────────────────────────────────────────
//
//   const container = document.getElementById('pro-analytics-section');
//   if (isFeatureEnabled('canAccessAnalyticsHistory', state.currentPlan)) {
//     container.style.display = 'block';
//   } else {
//     container.style.display = 'none';
//   }
//
// Pattern 2: Disable button with message
// ──────────────────────────────────────
//
//   const exportBtn = document.getElementById('export-btn');
//   if (!isFeatureEnabled('canExportAnalysis', state.currentPlan)) {
//     exportBtn.disabled = true;
//     exportBtn.title = '🔒 Pro Feature: Export analysis results';
//   }
//
// Pattern 3: Show different UI based on plan
// ──────────────────────────────────────────
//
//   const scanLimitText = document.getElementById('scan-limit-text');
//   const planInfo = getPlanInfo(state.currentPlan);
//   scanLimitText.textContent = `${planInfo.maxScansPerDay} scans/day`;
//
// ============================================================================
// LICENSE KEY FORMAT
// ============================================================================
//
// Format: PRORISK-XXXX-XXXX
// Examples:
//   - PRORISK-TEST-1234
//   - PRORISK-ABCD-5678
//   - PRORISK-XYZ9-LMNO
//
// To generate a test key:
//   In browser console or popup:
//   LicenseManager.generateMockLicense()
//
// ============================================================================
// CHECKING PLAN STATUS
// ============================================================================
//
// In content.js:
//   console.log(state.currentPlan);   // 'FREE' or 'PRO'
//   console.log(state.isProUser);     // true or false
//
// In popup.js:
//   const licenseInfo = await LicenseManager.getLicenseInfo();
//   console.log(licenseInfo.isPro);   // true or false
//   console.log(licenseInfo.plan);    // 'FREE' or 'PRO'
//   console.log(licenseInfo.license); // Masked key (if Pro)
//
// ============================================================================
// CURRENT FEATURE MATRIX
// ============================================================================
//
// Feature Name                 | FREE  | PRO
// ─────────────────────────────┼───────┼────
// canScanPR                    | ✓     | ✓
// canViewRiskScore             | ✓     | ✓
// canViewSummary               | ✓     | ✓
// canDetectSecurityIssues      | ✓     | ✓
// canDetectBreakingChanges     | ✓     | ✓
// canAnalyzeTestCoverage       | ✓     | ✓
// canReviewCommitMessage       | ✓     | ✓
// canShowRiskometer            | ✓     | ✓
// canShowQualityMetrics        | ✓     | ✓
// canShowCriticalIssues        | ✓     | ✓
// canSuggestCommitMessage      | ✗     | ✓
// canExportAnalysis            | ✗     | ✓
// canAccessAnalyticsHistory    | ✗     | ✓
// canSetCustomRules            | ✗     | ✓
// canIntegrateSlack            | ✗     | ✓
// maxScansPerDay               | 5     | 999
// showWatermark                | Yes   | No
//
// ============================================================================
// HOW LICENSING WORKS
// ============================================================================
//
// 1. User enters license key in popup → License tab
// 2. LicenseManager validates format: PRORISK-XXXX-XXXX
// 3. Key stored in chrome.storage.local
// 4. Content script loads plan on page load
// 5. state.currentPlan updated automatically
// 6. Features are gated based on state.currentPlan
//
// Storage Keys used by chrome.storage.local:
//   - licenseKey: The Pro license key
//   - currentPlan: Either 'FREE' or 'PRO'
//   - apiKey: OpenAI API key (existing)
//
// ============================================================================
// FUTURE ENHANCEMENTS
// ============================================================================
//
// Stage 1 (Current): Client-side validation only
// Stage 2: Backend validation endpoint
// Stage 3: License expiration dates
// Stage 4: Revocation list checking
// Stage 5: Per-team/organization licenses
// Stage 6: Usage analytics tracking
//
// ============================================================================
// TESTING THE FEATURE GATING
// ============================================================================
//
// Test Free Plan (default):
//   1. Open popup
//   2. Clear license (if any exists)
//   3. Confirm plan badge shows "📦 Free Plan"
//   4. Pro features should be hidden
//
// Test Pro Plan:
//   1. Open popup → License tab
//   2. Click "Generate Test Key"
//   3. Click "Activate License"
//   4. Confirm plan badge shows "⭐ Pro Unlocked"
//   5. Pro features should be visible
//
// Test License Removal:
//   1. While on Pro plan
//   2. Click "Remove License"
//   3. Confirm deletion in popup
//   4. Plan badge should revert to "📦 Free Plan"
//   5. Pro features should hide again
//
// ============================================================================
