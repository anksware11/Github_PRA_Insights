// ============================================================================
// PLAN MANAGER
// Centralized single source of truth for FREE vs PRO logic
// Integrates LicenseManager, FeatureFlags, and UsageLimiter
// ============================================================================

const PlanManager = (() => {
  // ──────────────────────────────────────────────────────────────────────────
  // PLAN CONFIGURATION - Single source of truth
  // ──────────────────────────────────────────────────────────────────────────

  const PLANS = {
    FREE: {
      name: 'Free Plan',
      color: '#808090',
      dailyLimit: 5,
      features: {
        // Core features (available to all)
        canScanPR: true,
        canViewRiskScore: true,
        canViewSummary: true,
        canDetectSecurityIssues: true,
        canDetectBreakingChanges: true,
        canAnalyzeTestCoverage: true,
        canReviewCommitMessage: true,

        // UI components
        canShowRiskometer: true,
        canShowQualityMetrics: true,
        canShowCriticalIssues: true,

        // PRO features (disabled for FREE)
        canShowFullSecurityAudit: false,      // Limited to 1 of N
        canShowAllBreakingChanges: false,     // Limited to basic info
        canAccessAnalyticsHistory: false,     // No history access
        canExportAnalysis: false,             // No export
        canSuggestCommitMessage: false,       // No commit suggestions
        canSetCustomRules: false,             // No rule customization

        // Limitations
        showWatermark: true,
        maxScansPerDay: 5
      }
    },

    PRO: {
      name: 'Pro Unlocked',
      color: '#39FF14',
      dailyLimit: 999,
      features: {
        // All core features
        canScanPR: true,
        canViewRiskScore: true,
        canViewSummary: true,
        canDetectSecurityIssues: true,
        canDetectBreakingChanges: true,
        canAnalyzeTestCoverage: true,
        canReviewCommitMessage: true,

        // All UI components
        canShowRiskometer: true,
        canShowQualityMetrics: true,
        canShowCriticalIssues: true,

        // PRO-exclusive features
        canShowFullSecurityAudit: true,       // All security issues
        canShowAllBreakingChanges: true,      // Detailed breaking changes
        canAccessAnalyticsHistory: true,      // Full history with stats
        canExportAnalysis: true,              // JSON, PDF, text export
        canSuggestCommitMessage: true,        // AI commit suggestions
        canSetCustomRules: true,              // Custom analysis rules

        // No limitations
        showWatermark: false,
        maxScansPerDay: 999
      }
    }
  };

  // Freeze plan config to prevent runtime mutation from DevTools
  Object.freeze(PLANS.FREE.features);
  Object.freeze(PLANS.FREE);
  Object.freeze(PLANS.PRO.features);
  Object.freeze(PLANS.PRO);
  Object.freeze(PLANS);

  // ──────────────────────────────────────────────────────────────────────────
  // STATE TRACKING
  // ──────────────────────────────────────────────────────────────────────────

  let currentPlan = 'FREE';
  let planChangeCallbacks = [];
  const MAX_CALLBACKS_WARNING_THRESHOLD = 10; // Warn if more callbacks registered (indicates possible memory leak)

  // ──────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initialize PlanManager with current user plan
   * Should be called once during extension startup
   * @returns {Promise<string>} Current plan name
   */
  async function initialize() {
    try {
      // Determine plan: License > Storage > Default
      if (LicenseManager) {
        const plan = await LicenseManager.getCurrentPlan();
        currentPlan = plan;
      }
      return currentPlan;
    } catch (error) {
      console.error('[PlanManager] Initialization error:', error);
      // Fail open - assume FREE if error
      currentPlan = 'FREE';
      return 'FREE';
    }
  }

  /**
   * Re-validate license and refresh plan state.
   * Safe public path for updating plan — always re-runs LicenseManager validation.
   * Called by content.js when chrome.storage changes (e.g. popup applies a license).
   * @returns {Promise<string>} Refreshed plan name
   */
  async function refresh() {
    try {
      if (typeof LicenseManager !== 'undefined') {
        const plan = await LicenseManager.getCurrentPlan();
        setPlan(plan); // internal — not in public API
      }
      return currentPlan;
    } catch (error) {
      console.error('[PlanManager] Refresh error:', error);
      return currentPlan;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PLAN INFORMATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get current active plan
   * @returns {string} Plan name ('FREE' or 'PRO')
   */
  function getCurrentPlan() {
    return currentPlan;
  }

  /**
   * Get plan configuration
   * @param {string} plan - Plan name (defaults to current)
   * @returns {object} Plan configuration
   */
  function getPlanConfig(plan = null) {
    plan = plan || currentPlan;
    return PLANS[plan] || PLANS.FREE;
  }

  /**
   * Get plan daily analysis limit
   * @returns {number} Daily limit
   */
  function getDailyLimit() {
    return PLANS[currentPlan].dailyLimit;
  }

  /**
   * Get all available plans
   * @returns {Array} Array of plan names
   */
  function getAvailablePlans() {
    return Object.keys(PLANS);
  }

  /**
   * Get plan info for display
   * @returns {object} { name, color, dailyLimit }
   */
  function getPlanInfo() {
    const plan = PLANS[currentPlan];
    return {
      name: plan.name,
      color: plan.color,
      dailyLimit: plan.dailyLimit,
      isPro: currentPlan === 'PRO'
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE CHECKING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Check if a feature is enabled for current plan
   * @param {string} featureName - Feature name (e.g., 'canShowFullSecurityAudit')
   * @returns {boolean} True if feature is enabled
   */
  function isFeatureEnabled(featureName) {
    const plan = PLANS[currentPlan];
    if (!plan) return false;
    return plan.features[featureName] === true;
  }

  /**
   * Check if a feature is enabled for specific plan
   * @param {string} featureName - Feature name
   * @param {string} plan - Plan name (overrides current)
   * @returns {boolean} True if feature is enabled
   */
  function isFeatureEnabledFor(featureName, plan = null) {
    plan = plan || currentPlan;
    const planConfig = PLANS[plan];
    if (!planConfig) return false;
    return planConfig.features[featureName] === true;
  }

  /**
   * Get all enabled features for current plan
   * @returns {Array} Array of enabled feature names
   */
  function getEnabledFeatures() {
    const plan = PLANS[currentPlan];
    return Object.entries(plan.features)
      .filter(([_, enabled]) => enabled === true)
      .map(([name, _]) => name);
  }

  /**
   * Get all PRO-only features not available in current plan
   * @returns {Array} Array of unavailable feature names
   */
  function getLockedFeatures() {
    const currentFeatures = PLANS[currentPlan].features;
    const proFeatures = PLANS.PRO.features;

    return Object.keys(proFeatures)
      .filter(feature => !currentFeatures[feature]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PLAN CHANGES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Update current plan and notify subscribers
   * Called when license is activated/deactivated
   * @param {string} newPlan - New plan name ('FREE' or 'PRO')
   */
  function setPlan(newPlan) {
    if (newPlan === currentPlan) return;

    const oldPlan = currentPlan;
    currentPlan = newPlan;

    console.log(`[PlanManager] Plan changed: ${oldPlan} → ${newPlan}`);

    // Notify callbacks
    planChangeCallbacks.forEach(callback => {
      try {
        callback({ from: oldPlan, to: newPlan });
      } catch (error) {
        console.error('[PlanManager] Callback error:', error);
      }
    });
  }

  /**
   * Subscribe to plan change events
   * @param {Function} callback - Called with { from, to } when plan changes
   * @returns {Function} Unsubscribe function
   */
  function onPlanChange(callback) {
    planChangeCallbacks.push(callback);

    // Warn if too many callbacks registered (possible memory leak if not unsubscribing)
    if (planChangeCallbacks.length > MAX_CALLBACKS_WARNING_THRESHOLD) {
      console.warn(
        `[PlanManager] High number of callbacks (${planChangeCallbacks.length}). ` +
        'Ensure all onPlanChange() subscriptions are being unsubscribed to prevent memory leaks.'
      );
    }

    // Return unsubscribe function
    return () => {
      planChangeCallbacks = planChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE GUARDS & MIDDLEWARE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Guard function: Require feature, show lock-up notice on failure
   * @param {string} featureName - Feature to check
   * @param {string} actionName - Action description (for logging)
   * @returns {boolean} True if allowed, false if denied
   */
  function requireFeature(featureName, actionName = 'Action') {
    if (!isFeatureEnabled(featureName)) {
      console.warn(`[PlanManager] ${actionName} requires ${featureName}. Upgrade to PRO to unlock.`);
      return false;
    }
    return true;
  }

  /**
   * Conditionally execute function if feature is enabled
   * @param {string} featureName - Feature to check
   * @param {Function} executeIfEnabled - Function to execute if allowed
   * @param {Function} executeIfDisabled - Function to execute if denied (optional)
   * @returns {*} Result of executed function
   */
  function ifFeatureEnabled(featureName, executeIfEnabled, executeIfDisabled = null) {
    if (isFeatureEnabled(featureName)) {
      return executeIfEnabled();
    } else if (executeIfDisabled) {
      return executeIfDisabled();
    }
    return null;
  }

  /**
   * Wrap rendering function to check feature gate
   * @param {string} featureName - Feature to check
   * @param {Function} renderFunction - Rendering function
   * @returns {Function} Wrapped render function
   */
  function gateRenderFunction(featureName, renderFunction) {
    return (...args) => {
      if (!isFeatureEnabled(featureName)) {
        return HTMLUtils.createEmptyState('This feature is only available in PRO. Upgrade to unlock.', '🔒');
      }
      return renderFunction(...args);
    };
  }

  /**
   * Get feature unlock information
   * @param {string| featureName - Feature that is locked
   * @returns {object} { featureName, requiredPlan, unlockUrl }
   */
  function getUnlockInfo(featureName) {
    return {
      featureName: featureName,
      requiredPlan: 'PRO',
      currentPlan: currentPlan,
      isLocked: !isFeatureEnabled(featureName),
      unlockMessage: `Upgrade to PRO to unlock ${featureName}`
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UTILITY CHECKS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Check if current plan is PRO
   * @returns {boolean} True if PRO plan
   */
  function isPro() {
    return currentPlan === 'PRO';
  }

  /**
   * Check if current plan is FREE
   * @returns {boolean} True if FREE plan
   */
  function isFree() {
    return currentPlan === 'FREE';
  }

  /**
   * Get plan difference (what's available in PRO vs current)
   * @returns {object} Difference report
   */
  function getUpgradeInfo() {
    const freeFeatures = PLANS.FREE.features;
    const proFeatures = PLANS.PRO.features;

    const newInPro = Object.entries(proFeatures)
      .filter(([key, val]) => val && !freeFeatures[key])
      .map(([key]) => key);

    return {
      currentPlan: currentPlan,
      unlockedFeatures: newInPro.length,
      features: newInPro,
      dailyLimitIncrease: PLANS.PRO.dailyLimit - PLANS.FREE.dailyLimit
    };
  }

  // Public API — frozen to prevent monkey-patching from DevTools
  // setPlan intentionally not exported; use refresh() to update plan via re-validation
  return Object.freeze({
    // Initialization
    initialize,
    refresh,

    // Plan information
    getCurrentPlan,
    getPlanConfig,
    getPlanInfo,
    getDailyLimit,
    getAvailablePlans,

    // Feature checking
    isFeatureEnabled,
    isFeatureEnabledFor,
    getEnabledFeatures,
    getLockedFeatures,

    // Plan change subscription
    onPlanChange,

    // Feature guards
    requireFeature,
    ifFeatureEnabled,
    gateRenderFunction,
    getUnlockInfo,

    // Utility checks
    isPro,
    isFree,
    getUpgradeInfo
  });
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlanManager;
}
