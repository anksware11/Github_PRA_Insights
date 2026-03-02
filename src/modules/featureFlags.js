// ============================================================================
// FEATURE FLAGS SYSTEM
// Centralized feature gating for Free and Pro plans
// ============================================================================

/**
 * Feature flag definitions for Free and Pro plans
 * Controls which features are available to each tier
 */
const FEATURE_TIERS = {
  // Free plan features
  FREE: {
    name: 'Free Plan',
    color: '#808090',
    features: {
      // Core UI
      canScanPR: true,
      canViewRiskScore: true,
      canViewSummary: true,

      // Basic analysis
      canDetectSecurityIssues: true,
      canDetectBreakingChanges: true,
      canAnalyzeTestCoverage: true,
      canReviewCommitMessage: true,

      // UI components
      canShowRiskometer: true,
      canShowQualityMetrics: true,
      canShowCriticalIssues: true,

      // Limitations
      maxScansPerDay: 5,
      showWatermark: true
    }
  },

  // Pro plan features
  PRO: {
    name: 'Pro Unlocked',
    color: '#39FF14',
    features: {
      // All free features
      canScanPR: true,
      canViewRiskScore: true,
      canViewSummary: true,

      // Enhanced analysis
      canDetectSecurityIssues: true,
      canDetectBreakingChanges: true,
      canAnalyzeTestCoverage: true,
      canReviewCommitMessage: true,

      // Premium UI
      canShowRiskometer: true,
      canShowQualityMetrics: true,
      canShowCriticalIssues: true,

      // Pro-exclusive features
      canSuggestCommitMessage: true,      // Auto-generate improved commit messages
      canExportAnalysis: true,             // Export results as JSON/PDF
      canAccessAnalyticsHistory: true,     // View past scan history
      canSetCustomRules: true,             // Configure analysis rules
      canIntegrateSlack: true,             // Send results to Slack

      // Pro limits
      maxScansPerDay: 999,
      showWatermark: false
    }
  }
};

/**
 * Get feature flags for a specific plan
 * @param {string} plan - 'FREE' or 'PRO'
 * @returns {object} Feature flags object
 */
function getFeatureFlags(plan = 'FREE') {
  return FEATURE_TIERS[plan]?.features || FEATURE_TIERS.FREE.features;
}

/**
 * Check if a specific feature is enabled for a plan
 * @param {string} featureName - Name of the feature to check
 * @param {string} plan - 'FREE' or 'PRO'
 * @returns {boolean}
 */
function isFeatureEnabled(featureName, plan = 'FREE') {
  const features = getFeatureFlags(plan);
  return features[featureName] === true;
}

/**
 * Get plan info (name, color, etc.)
 * @param {string} plan - 'FREE' or 'PRO'
 * @returns {object} Plan metadata
 */
function getPlanInfo(plan = 'FREE') {
  const tierInfo = FEATURE_TIERS[plan];
  if (!tierInfo) return FEATURE_TIERS.FREE;

  return {
    name: tierInfo.name,
    color: tierInfo.color,
    maxScansPerDay: tierInfo.features.maxScansPerDay,
    showWatermark: tierInfo.features.showWatermark
  };
}

/**
 * Get all plan names
 * @returns {array} Array of plan names
 */
function getAllPlans() {
  return Object.keys(FEATURE_TIERS);
}

// Freeze to prevent runtime mutation from DevTools
Object.freeze(FEATURE_TIERS.FREE.features);
Object.freeze(FEATURE_TIERS.FREE);
Object.freeze(FEATURE_TIERS.PRO.features);
Object.freeze(FEATURE_TIERS.PRO);
Object.freeze(FEATURE_TIERS);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FEATURE_TIERS,
    getFeatureFlags,
    isFeatureEnabled,
    getPlanInfo,
    getAllPlans
  };
}
