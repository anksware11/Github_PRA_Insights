// ============================================================================
// USAGE TRACKING & RATE LIMITING MODULE
// Monitors API usage, prevents rate limiting, warns about costs
// Phase 3 Security Enhancement
// ============================================================================

const UsageTracker = (() => {
  // ──────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ──────────────────────────────────────────────────────────────────────────

  const CONFIG = {
    // Tracking keys
    STORAGE_KEY_USAGE: 'usageTracker',
    STORAGE_KEY_WARNINGS: 'usageWarnings',
    STORAGE_KEY_RATE_LIMIT: 'rateLimitStatus',

    // Rate limiting (per minute)
    RATE_LIMIT: {
      CALLS_PER_MINUTE: 5,      // Max 5 API calls per minute
      CALLS_PER_HOUR: 50,       // Max 50 API calls per hour
      CALLS_PER_DAY: 100        // Max 100 API calls per day
    },

    // Cost tracking (estimated)
    COST: {
      PER_INPUT_TOKEN: 0.0005,  // $0.0005 per 1K input tokens
      PER_OUTPUT_TOKEN: 0.0015, // $0.0015 per 1K output tokens
      MINIMUM_COST_PER_CALL: 0.001  // ~$0.001 per call (minimum estimate)
    },

    // Warning thresholds
    WARNINGS: {
      USAGE_60_PERCENT: 0.6,
      USAGE_80_PERCENT: 0.8,
      USAGE_90_PERCENT: 0.9,
      COST_WARNING_DOLLARS: 5.0,  // Warn at $5/day
      COST_ALERT_DOLLARS: 10.0    // Alert at $10/day
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // INTERNAL STATE
  // ──────────────────────────────────────────────────────────────────────────

  let usageData = {
    calls: [],           // Array of call timestamps
    totalTokens: 0,      // Total tokens used
    estimatedCost: 0,    // Estimated cost in dollars
    lastReset: Date.now(),
    warnings: []
  };

  let isInitialized = false;
  let dailyResetIntervalId = null;  // Store interval ID for cleanup

  // ──────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ──────────────────────────────────────────────────────────────────────────

  async function initialize() {
    try {
      const stored = await chrome.storage.local.get(CONFIG.STORAGE_KEY_USAGE);
      if (stored[CONFIG.STORAGE_KEY_USAGE]) {
        usageData = stored[CONFIG.STORAGE_KEY_USAGE];
        // Clean up old entries (>24 hours)
        cleanupOldEntries();
      }
      isInitialized = true;
      console.log('[UsageTracker] Initialized with usage data:', usageData);
      return true;
    } catch (error) {
      console.error('[UsageTracker] Initialization error:', error);
      isInitialized = true;
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CORE TRACKING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Record an API call
   * @param {object} options - Call details
   * @param {number} options.inputTokens - Tokens sent
   * @param {number} options.outputTokens - Tokens received
   * @param {boolean} options.success - Was call successful
   * @returns {object} Updated usage status
   */
  async function recordApiCall(options = {}) {
    const {
      inputTokens = 150,   // Default ~150 tokens per call
      outputTokens = 200,  // Default ~200 tokens output
      success = true
    } = options;

    // Add timestamp of call
    usageData.calls.push({
      timestamp: Date.now(),
      inputTokens,
      outputTokens,
      success
    });

    // Update token counts
    usageData.totalTokens += (inputTokens + outputTokens);

    // Calculate estimated cost
    const costIn = (inputTokens / 1000) * CONFIG.COST.PER_INPUT_TOKEN;
    const costOut = (outputTokens / 1000) * CONFIG.COST.PER_OUTPUT_TOKEN;
    const callCost = Math.max(costIn + costOut, CONFIG.COST.MINIMUM_COST_PER_CALL);
    usageData.estimatedCost += callCost;

    // Check for warnings
    await checkWarnings();

    // Save to storage
    await saveUsageData();

    console.log('[UsageTracker] API call recorded', {
      totalCalls: usageData.calls.length,
      estimatedCost: usageData.estimatedCost.toFixed(4),
      tokens: usageData.totalTokens
    });

    return getUsageStatus();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RATE LIMITING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Check if rate limit is exceeded
   * @returns {object} Rate limit status
   */
  function checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Single-pass: count calls in each window simultaneously
    let callsLastMinute = 0, callsLastHour = 0, callsLastDay = 0;
    for (const c of usageData.calls) {
      if (c.timestamp > oneDayAgo) {
        callsLastDay++;
        if (c.timestamp > oneHourAgo) {
          callsLastHour++;
          if (c.timestamp > oneMinuteAgo) callsLastMinute++;
        }
      }
    }

    const status = {
      isLimited: false,
      reason: null,
      perMinute: {
        current: callsLastMinute,
        limit: CONFIG.RATE_LIMIT.CALLS_PER_MINUTE,
        exceeded: callsLastMinute > CONFIG.RATE_LIMIT.CALLS_PER_MINUTE
      },
      perHour: {
        current: callsLastHour,
        limit: CONFIG.RATE_LIMIT.CALLS_PER_HOUR,
        exceeded: callsLastHour > CONFIG.RATE_LIMIT.CALLS_PER_HOUR
      },
      perDay: {
        current: callsLastDay,
        limit: CONFIG.RATE_LIMIT.CALLS_PER_DAY,
        exceeded: callsLastDay > CONFIG.RATE_LIMIT.CALLS_PER_DAY
      }
    };

    // Determine if rate limited
    if (status.perMinute.exceeded) {
      status.isLimited = true;
      status.reason = `Rate limited: ${callsLastMinute}/${CONFIG.RATE_LIMIT.CALLS_PER_MINUTE} calls per minute`;
    } else if (status.perHour.exceeded) {
      status.isLimited = true;
      status.reason = `Rate limited: ${callsLastHour}/${CONFIG.RATE_LIMIT.CALLS_PER_HOUR} calls per hour`;
    } else if (status.perDay.exceeded) {
      status.isLimited = true;
      status.reason = `Rate limited: ${callsLastDay}/${CONFIG.RATE_LIMIT.CALLS_PER_DAY} calls per day`;
    }

    return status;
  }

  /**
   * Check if we can make an API call
   * @returns {object} Permission status with wait time if needed
   */
  function canMakeApiCall() {
    const rateStatus = checkRateLimit();

    if (!rateStatus.isLimited) {
      return { allowed: true, waitMs: 0, reason: 'No rate limit' };
    }

    // Calculate wait time for the most restrictive limit
    if (rateStatus.perMinute.exceeded) {
      const minuteAgoIndex = usageData.calls.length - CONFIG.RATE_LIMIT.CALLS_PER_MINUTE;
      if (minuteAgoIndex >= 0 && usageData.calls[minuteAgoIndex]) {
        const oldestCall = usageData.calls[minuteAgoIndex];
        const waitMs = Math.max(0, (oldestCall.timestamp + 60000) - Date.now());
        return { allowed: false, waitMs, reason: 'Per-minute limit reached' };
      }
    }

    if (rateStatus.perHour.exceeded) {
      const hourAgoIndex = usageData.calls.length - CONFIG.RATE_LIMIT.CALLS_PER_HOUR;
      if (hourAgoIndex >= 0 && usageData.calls[hourAgoIndex]) {
        const oldestCall = usageData.calls[hourAgoIndex];
        const waitMs = Math.max(0, (oldestCall.timestamp + 3600000) - Date.now());
        return { allowed: false, waitMs, reason: 'Per-hour limit reached' };
      }
    }

    if (rateStatus.perDay.exceeded) {
      console.warn('[UsageTracker] Daily API limit reached for today');
      return { allowed: false, waitMs: Infinity, reason: 'Daily limit reached - try again tomorrow' };
    }

    return { allowed: true, waitMs: 0, reason: 'Within limits' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // WARNINGS & ALERTS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Check usage and generate warnings
   * @returns {Promise<array>} Array of active warnings
   */
  async function checkWarnings() {
    const currentWarnings = [];

    // Get daily limit for current plan using safe API call
    let daysAnalysesLimit = 5;  // FREE plan default
    try {
      // Use optional chaining and safer method calls to avoid platform-specific errors
      if (typeof PlanManager !== 'undefined' && typeof PlanManager.isPro === 'function' && PlanManager.isPro()) {
        daysAnalysesLimit = 999; // PRO has no limit
      }
    } catch (e) {
      console.warn('[UsageTracker] Error checking plan status:', e);
      // Default to FREE plan limit on error
      daysAnalysesLimit = 5;
    }

    // Calculate usage percent
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const callsToday = usageData.calls.filter(c => c.timestamp > dayAgo).length;
    const usagePercent = callsToday / daysAnalysesLimit;

    // Usage percentage warnings
    if (usagePercent >= CONFIG.WARNINGS.USAGE_90_PERCENT && daysAnalysesLimit < 999) {
      currentWarnings.push({
        type: 'usage_critical',
        level: 'critical',
        message: `90% of daily analysis limit reached (${callsToday}/${daysAnalysesLimit})`,
        icon: '🚨'
      });
    } else if (usagePercent >= CONFIG.WARNINGS.USAGE_80_PERCENT && daysAnalysesLimit < 999) {
      currentWarnings.push({
        type: 'usage_warning',
        level: 'warning',
        message: `80% of daily analysis limit reached (${callsToday}/${daysAnalysesLimit})`,
        icon: '⚠️'
      });
    } else if (usagePercent >= CONFIG.WARNINGS.USAGE_60_PERCENT && daysAnalysesLimit < 999) {
      currentWarnings.push({
        type: 'usage_notice',
        level: 'notice',
        message: `60% of daily analysis limit reached (${callsToday}/${daysAnalysesLimit})`,
        icon: 'ℹ️'
      });
    }

    // Cost warnings
    if (usageData.estimatedCost >= CONFIG.WARNINGS.COST_ALERT_DOLLARS) {
      currentWarnings.push({
        type: 'cost_alert',
        level: 'critical',
        message: `Alert: Estimated $${usageData.estimatedCost.toFixed(2)} in API costs today`,
        icon: '💰'
      });
    } else if (usageData.estimatedCost >= CONFIG.WARNINGS.COST_WARNING_DOLLARS) {
      currentWarnings.push({
        type: 'cost_warning',
        level: 'warning',
        message: `Warning: Estimated $${usageData.estimatedCost.toFixed(2)} in API costs today`,
        icon: '💸'
      });
    }

    usageData.warnings = currentWarnings;
    // NOTE: Caller (recordApiCall) is responsible for persisting — do NOT save here
    // to avoid the double-write that occurred on every API call.

    return currentWarnings;
  }

  /**
   * Get all active warnings
   * @returns {array} List of current warnings
   */
  function getWarnings() {
    return usageData.warnings || [];
  }

  /**
   * Get warning message for UI display
   * @returns {string|null} Single formatted warning or null
   */
  function getWarningMessage() {
    const warnings = getWarnings();
    if (warnings.length === 0) return null;

    // Return most critical warning
    const critical = warnings.find(w => w.level === 'critical');
    const warning = warnings.find(w => w.level === 'warning');
    const notice = warnings.find(w => w.level === 'notice');

    const selected = critical || warning || notice;
    return selected ? `${selected.icon} ${selected.message}` : null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STATISTICS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get current usage status
   * @returns {object} Usage statistics
   */
  function getUsageStatus() {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const hourAgo = now - (60 * 60 * 1000);
    const minuteAgo = now - (60 * 1000);

    // Single-pass: accumulate all window counts and cost data simultaneously
    let callsLastMinute = 0, callsLastHour = 0, callsLastDay = 0;
    let inputsToday = 0, outputsToday = 0;
    for (const c of usageData.calls) {
      const ts = c.timestamp;
      if (ts > dayAgo) {
        callsLastDay++;
        inputsToday += (c.inputTokens || 0);
        outputsToday += (c.outputTokens || 0);
        if (ts > hourAgo) {
          callsLastHour++;
          if (ts > minuteAgo) callsLastMinute++;
        }
      }
    }
    const estimatedCostToday =
      (inputsToday / 1000) * CONFIG.COST.PER_INPUT_TOKEN +
      (outputsToday / 1000) * CONFIG.COST.PER_OUTPUT_TOKEN;

    return {
      totalCalls: usageData.calls.length,
      callsLastMinute,
      callsLastHour,
      callsLastDay,
      totalTokens: usageData.totalTokens,
      estimatedCostToday,
      lastCall: usageData.calls.length > 0 ? usageData.calls[usageData.calls.length - 1].timestamp : null
    };
  }

  /**
   * Get usage report for user
   * @returns {string} Formatted usage report
   */
  function getUsageReport() {
    const status = getUsageStatus();
    const rateStatus = checkRateLimit();

    return `
📊 API Usage Report
─────────────────────────
Total API Calls: ${status.totalCalls}
  Last Minute: ${status.callsLastMinute}/${CONFIG.RATE_LIMIT.CALLS_PER_MINUTE}
  Last Hour: ${status.callsLastHour}/${CONFIG.RATE_LIMIT.CALLS_PER_HOUR}
  Last Day: ${status.callsLastDay}/${CONFIG.RATE_LIMIT.CALLS_PER_DAY}

📈 Data Usage:
  Total Tokens: ${status.totalTokens.toLocaleString()}
  Estimated Cost (Today): $${status.estimatedCostToday.toFixed(4)}

${rateStatus.isLimited ? `⚠️ RATE LIMITED: ${rateStatus.reason}` : '✅ No rate limiting active'}

${getWarnings().length > 0 ? `⚠️ Active Warnings: ${getWarnings().length}` : '✅ No warnings'}
    `.trim();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STORAGE & CLEANUP
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Save usage data to chrome storage
   * @returns {Promise}
   */
  async function saveUsageData() {
    try {
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEY_USAGE]: usageData
      });
    } catch (error) {
      console.error('[UsageTracker] Save error:', error);
    }
  }

  /**
   * Clean up entries older than 24 hours
   */
  function cleanupOldEntries() {
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    usageData.calls = usageData.calls.filter(call => call.timestamp > dayAgo);
  }

  /**
   * Reset daily usage (typically called at midnight)
   * @returns {Promise}
   */
  async function resetDailyUsage() {
    usageData.calls = [];
    usageData.estimatedCost = 0;
    usageData.lastReset = Date.now();
    usageData.warnings = [];
    await saveUsageData();
    console.log('[UsageTracker] Daily usage reset');
  }

  /**
   * Reset all usage data (admin function)
   * @returns {Promise}
   */
  async function resetAllUsage() {
    usageData = {
      calls: [],
      totalTokens: 0,
      estimatedCost: 0,
      lastReset: Date.now(),
      warnings: []
    };
    await saveUsageData();
    console.log('[UsageTracker] All usage data reset');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCHEDULE DAILY RESET
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initialize daily reset timer (checks every hour if reset needed)
   */
  function initializeDailyReset() {
    // Clear any existing interval first
    if (dailyResetIntervalId !== null) {
      clearInterval(dailyResetIntervalId);
      dailyResetIntervalId = null;
    }

    // Check every hour if we need to reset
    dailyResetIntervalId = setInterval(async () => {
      const lastResetDate = new Date(usageData.lastReset).toDateString();
      const today = new Date().toDateString();

      if (lastResetDate !== today) {
        await resetDailyUsage();
      }
    }, 60 * 60 * 1000); // Every hour

    console.log('[UsageTracker] Daily reset timer initialized');
  }

  /**
   * Cleanup function to stop the daily reset timer
   */
  function stopDailyReset() {
    if (dailyResetIntervalId !== null) {
      clearInterval(dailyResetIntervalId);
      dailyResetIntervalId = null;
      console.log('[UsageTracker] Daily reset timer stopped');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────

  return {
    // Initialization
    initialize,
    initializeDailyReset,
    stopDailyReset,

    // Tracking
    recordApiCall,

    // Rate limiting
    checkRateLimit,
    canMakeApiCall,

    // Warnings
    checkWarnings,
    getWarnings,
    getWarningMessage,

    // Statistics
    getUsageStatus,
    getUsageReport,

    // Management
    resetDailyUsage,
    resetAllUsage,

    // Debug
    _config: CONFIG,
    _isInitialized: () => isInitialized
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UsageTracker;
}
