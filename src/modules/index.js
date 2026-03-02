// ============================================================================
// MODULES INDEX - Centralized exports for all module layer APIs
// Single source of truth for module imports across the extension
// ============================================================================

// Business logic modules - all depend on Storage utility
// Extend these as needed - they're all in this layer
//
// Included modules:
// - LicenseManager: License validation and plan detection
// - UsageLimiter: 5-scan/24h limit for FREE users
// - FeatureFlags: Plan-based feature gating (FREE vs PRO)
// - PRHistory: Local PR analysis history (max 50 items)
// - PlanManager: Centralized FREE vs PRO logic (unified entry point)

// Public API
return {
  LicenseManager,
  UsageLimiter,
  FeatureFlags,
  PRHistory,
  PlanManager
};
