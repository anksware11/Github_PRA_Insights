// ============================================================================
// USAGE LIMITER MODULE
// Enforces FREE plan limits (5 scans/day)
// Uses Storage utility for abstracted chrome.storage access
// ============================================================================

const UsageLimiter = (() => {
  const STORAGE_KEY = 'usageData';
  const DAILY_LIMIT_FREE = 5;
  const DAILY_LIMIT_PRO = 999;

  /**
   * Get usage data for today
   * @returns {Promise<object>} Usage data: { count, resetTime, plan }
   */
  async function getUsageData() {
    try {
      let data = await Storage.getValue(STORAGE_KEY, {
        count: 0,
        resetTime: Date.now() + 24 * 60 * 60 * 1000,
        plan: 'FREE'
      });

      // Check if 24 hours have passed
      if (Date.now() >= data.resetTime) {
        // Reset usage counter
        data.count = 0;
        data.resetTime = Date.now() + 24 * 60 * 60 * 1000;
        await Storage.setValue(STORAGE_KEY, data);
      }

      return data;
    } catch (error) {
      console.error('[UsageLimiter] Error getting usage data:', error);
      return {
        count: 0,
        resetTime: Date.now() + 24 * 60 * 60 * 1000,
        plan: 'FREE'
      };
    }
  }

  /**
   * Check if user can perform analysis
   * @param {string} plan - 'FREE' or 'PRO'
   * @returns {Promise<object>} { canAnalyze: boolean, remaining: number, limit: number }
   */
  async function canAnalyze(plan = 'FREE') {
    try {
      const usageData = await getUsageData();
      const limit = plan === 'PRO' ? DAILY_LIMIT_PRO : DAILY_LIMIT_FREE;
      const remaining = Math.max(0, limit - usageData.count);
      const canAnalyze = remaining > 0;

      return {
        canAnalyze,
        remaining,
        limit,
        used: usageData.count,
        resetTime: usageData.resetTime,
        plan
      };
    } catch (error) {
      console.error('[UsageLimiter] Error checking usage:', error);
      return {
        canAnalyze: true,
        remaining: 999,
        limit: 999,
        used: 0,
        resetTime: Date.now() + 24 * 60 * 60 * 1000,
        plan: 'FREE'
      };
    }
  }

  /**
   * Increment usage counter
   * @param {string} plan - 'FREE' or 'PRO'
   * @returns {Promise<object>} Updated usage data
   */
  async function incrementUsage(plan = 'FREE') {
    try {
      const usageData = await getUsageData();
      usageData.count += 1;
      usageData.plan = plan;

      await Storage.setValue(STORAGE_KEY, usageData);
      console.log(`[UsageLimiter] Usage incremented. Count: ${usageData.count}/${plan === 'PRO' ? DAILY_LIMIT_PRO : DAILY_LIMIT_FREE}`);

      return usageData;
    } catch (error) {
      console.error('[UsageLimiter] Error incrementing usage:', error);
      throw error;
    }
  }

  /**
   * Get time remaining until reset (in milliseconds)
   * @returns {Promise<number>} Milliseconds until next reset
   */
  async function getTimeUntilReset() {
    try {
      const usageData = await getUsageData();
      const now = Date.now();
      const timeRemaining = Math.max(0, usageData.resetTime - now);
      return timeRemaining;
    } catch (error) {
      console.error('[UsageLimiter] Error getting time until reset:', error);
      return 0;
    }
  }

  /**
   * Format time remaining as human-readable string
   * @param {number} milliseconds - Time in ms
   * @returns {string} Formatted string (e.g., "2h 30m")
   */
  function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return 'Now';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Reset usage immediately (for testing or manual reset)
   * @returns {Promise<void>}
   */
  async function resetUsage() {
    try {
      await Storage.setValue(STORAGE_KEY, {
        count: 0,
        resetTime: Date.now() + 24 * 60 * 60 * 1000,
        plan: 'FREE'
      });
      console.log('[UsageLimiter] Usage reset');
    } catch (error) {
      console.error('[UsageLimiter] Error resetting usage:', error);
      throw error;
    }
  }

  /**
   * Get usage message for display
   * @returns {Promise<string>} Usage message
   */
  async function getUsageMessage(plan = 'FREE') {
    try {
      const usage = await canAnalyze(plan);
      const timeRemaining = await getTimeUntilReset();
      const timeStr = formatTimeRemaining(timeRemaining);

      if (usage.canAnalyze) {
        return `${usage.remaining} scans remaining today (resets in ${timeStr})`;
      } else {
        return `Daily limit reached. Resets in ${timeStr}. Upgrade to Pro for unlimited analysis.`;
      }
    } catch (error) {
      console.error('[UsageLimiter] Error getting usage message:', error);
      return 'Usage tracking unavailable';
    }
  }

  // Public API
  return {
    DAILY_LIMIT_FREE,
    DAILY_LIMIT_PRO,
    getUsageData,
    canAnalyze,
    incrementUsage,
    getTimeUntilReset,
    formatTimeRemaining,
    resetUsage,
    getUsageMessage
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UsageLimiter;
}
