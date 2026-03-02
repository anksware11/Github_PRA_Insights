// ============================================================================
// UI INDEX - Centralized exports for all UI rendering components
// Display-only functions that depend on core and modules layers
// ============================================================================

// UI rendering modules (pure presentation, no logic)
// These depend on: core modules for data, RiskEngine for analysis
//
// Included components:
// - UIPanels: Security audit, breaking changes, test coverage, critical issues
// - UIRiskometer: Risk gauge, breakdown donut, trend indicator
// - UIBadges: Severity, impact, semver badges and color utilities

// Public API
return {
  UIPanels,
  UIRiskometer,
  UIBadges
};
