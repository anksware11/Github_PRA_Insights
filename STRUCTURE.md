// ============================================================================
// EXTENSION STRUCTURE REORGANIZATION GUIDE
// ============================================================================
//
// OLD STRUCTURE (Flat):
// ├── content.js
// ├── popup.js
// ├── popup.html
// ├── featureFlags.js
// ├── licenseManager.js
// ├── usageLimiter.js
// ├── riskEngine.js
// ├── uiRenderer.js
// ├── prHistory.js
// ├── premium-styles.css
// ├── styles.css
// ├── background.js
// └── manifest.json
//
// NEW STRUCTURE (Organized):
// ├── manifest.json
// ├── background.js
// ├── content.js (imported path updated)
// │
// ├── src/
// │   ├── core/
// │   │   ├── analysisEngine.js (extracted PR extraction logic)
// │   │   └── riskEngine.js (moved from root)
// │   │
// │   ├── modules/
// │   │   ├── featureFlags.js (moved from root)
// │   │   ├── licenseManager.js (refactored to use Storage)
// │   │   ├── usageLimiter.js (refactored to use Storage)
// │   │   ├── prHistory.js (moved from root)
// │   │   └── index.js (centralized exports)
// │   │
// │   ├── ui/
// │   │   ├── panel.js (panel HTML & creation logic)
// │   │   ├── riskometer.js (riskometer rendering)
// │   │   ├── badges.js (badge components)
// │   │   ├── history.js (history panel rendering)
// │   │   └── index.js (centralized UI exports)
// │   │
// │   ├── utils/
// │   │   ├── storage.js (chrome.storage wrapper)
// │   │   ├── helpers.js (shared utilities)
// │   │   └── index.js (centralized utils exports)
// │   │
// │   └── styles/
// │       ├── premium-styles.css
// │       ├── popup-styles.css
// │       └── variables.css
// │
// ├── pages/
// │   ├── popup.html
// │   └── popup.js (refactored to use modules)
// │
// └── STRUCTURE.md (this file)
//
// ============================================================================
// IMPORT MAPS / MODULE DEPENDENCIES
// ============================================================================
//
// Storage (Base Layer - No Dependencies)
//   └── Wrapper around chrome.storage.local
//
// Modules (Depend on Storage)
//   ├── LicenseManager (uses: Storage)
//   ├── UsageLimiter (uses: Storage)
//   ├── FeatureFlags (uses: Storage via LicenseManager)
//   └── PRHistory (uses: Storage)
//
// Core Logic (Independent)
//   ├── RiskEngine (pure logic, no dependencies)
//   └── AnalysisEngine (pure logic, no dependencies)
//
// UI Components (Depend on modules and core)
//   ├── Panel (uses: AnalysisEngine, modules)
//   ├── Riskometer (uses: RiskEngine)
//   ├── Badges (uses: RiskEngine, FeatureFlags)
//   └── History (uses: PRHistory)
//
// Entry Points
//   ├── content.js (uses: all modules + core + ui)
//   ├── popup.js (uses: modules, popup-specific logic)
//   └── background.js (service worker)
//
// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================
//
// [x] Create /src/utils/storage.js (abstraction layer)
// [x] Move & refactor /src/modules/licenseManager.js (uses Storage)
// [x] Move & refactor /src/modules/usageLimiter.js (uses Storage)
// [ ] Move & refactor /src/modules/featureFlags.js
// [ ] Move & refactor /src/modules/prHistory.js
// [ ] Create /src/modules/index.js (centralized exports)
// [ ] Move /src/core/riskEngine.js
// [ ] Extract /src/core/analysisEngine.js (from content.js)
// [ ] Create /src/core/index.js
// [ ] Create /src/ui/panel.js (split from content.js)
// [ ] Create /src/ui/riskometer.js
// [ ] Create /src/ui/badges.js
// [ ] Create /src/ui/history.js
// [ ] Create /src/ui/index.js
// [ ] Create /src/utils/helpers.js
// [ ] Create /src/utils/index.js
// [ ] Create /src/styles/variables.css
// [ ] Update manifest.json paths
// [ ] Update content.js imports
// [ ] Update popup.js imports
// [ ] Test all functionality
//
// ============================================================================
// KEY PRINCIPLES
// ============================================================================
//
// 1. SEPARATION OF CONCERNS
//    - Core: Pure analysis logic (no DOM, no storage)
//    - Modules: State management & business logic
//    - UI: Display & interaction logic
//    - Utils: Shared helpers & wrappers
//
// 2. NO CIRCULAR DEPENDENCIES
//    - Storage has no dependencies
//    - Modules depend only on Storage
//    - Core modules have no external dependencies
//    - UI depends on modules + core
//    - Entry points import everything they need
//
// 3. CENTRALIZED EXPORTS
//    - Each folder has index.js with all public APIs
//    - Easy to see what's exported from each layer
//    - Single source of truth for imports
//
// 4. MINIMAL FILE SIZE
//    - Keep files focused on single responsibility
//    - Extract duplicate logic to shared utils
//    - Remove dead code
//
// ============================================================================
// REMAINING WORK (AUTOMATED PATH)
// ============================================================================
//
// Run these operations to complete migration:
//
// 1. Copy all module files to new locations
// 2. Update manifest.json to point to new paths
// 3. Create index files for centralized imports
// 4. Update content.js to import from /src folders
// 5. Run quick test to verify loading
//
// ============================================================================
