// ============================================================================
// LICENSE MANAGER MODULE
// Handles license key validation, storage, and plan detection
// Uses Storage utility for abstracted chrome.storage access
// ============================================================================

const LicenseManager = (() => {
  // License key pattern: PRORISK-XXXX-XXXX (alphanumeric)
  const LICENSE_PATTERN = /^PRORISK-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
  const STORAGE_KEY = 'licenseKey';
  const PLAN_STORAGE_KEY = 'currentPlan';
  const NETWORK_SIMULATION_DELAY = 500; // ms - simulated network latency for API calls

  /**
   * Validate license key format
   * @param {string} key - License key to validate
   * @returns {boolean}
   */
  function validateKeyFormat(key) {
    if (!key || typeof key !== 'string') return false;
    return LICENSE_PATTERN.test(key.trim());
  }

  /**
   * Generate a mock license key for testing (not for production)
   * @returns {string} Valid license key
   */
  function generateMockLicense() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `PRORISK-${part1}-${part2}`;
  }

  /**
   * Save license key to Chrome storage
   * @param {string} key - License key to save
   * @returns {Promise<boolean>} Success status
   */
  async function saveLicense(key) {
    // Legacy PRORISK-XXXX-XXXX format is deprecated.
    // New activations must use the HMAC-signed format (PRORISK|email|expiry|sig)
    // issued by the license server. This path exists only for backward compatibility
    // with keys issued before the HMAC system was deployed.
    throw new Error(
      'Legacy license format is no longer accepted for new activations. ' +
      'Please use the license key issued from your account dashboard.'
    );
  }

  /**
   * Remove license key from storage
   * @returns {Promise<boolean>}
   */
  async function removeLicense() {
    try {
      await Storage.remove([STORAGE_KEY, PLAN_STORAGE_KEY]);
      console.log('[LicenseManager] License removed');
      return true;
    } catch (error) {
      console.error('[LicenseManager] Error removing license:', error);
      throw error;
    }
  }

  /**
   * Get current license key
   * @returns {Promise<string|null>}
   */
  async function getLicense() {
    try {
      return await Storage.getValue(STORAGE_KEY, null);
    } catch (error) {
      console.error('[LicenseManager] Error retrieving license:', error);
      return null;
    }
  }

  /**
   * Get current plan
   * Primary path: HMAC-signed proLicense (LicenseValidator format)
   * Fallback:     legacy PRORISK-XXXX-XXXX key (format-only, backward compat)
   * @returns {Promise<string>} 'FREE' or 'PRO'
   */
  async function getCurrentPlan() {
    try {
      // ── Primary: HMAC-validated license ──────────────────────────────────
      if (typeof LicenseValidator !== 'undefined') {
        const stored = await LicenseValidator.getStoredLicense();
        if (stored && stored.raw) {
          const validation = await LicenseValidator.validateLicense(stored.raw);
          if (validation.isValid) return 'PRO';
          // Expired or tampered — remove it so the stale entry doesn't linger
          await LicenseValidator.clearLicense();
          console.warn('[LicenseManager] Stored HMAC license invalid/expired — cleared');
        }
      }

      // ── Fallback: legacy key — read-only backward compat, deprecated ─────
      // Keys in this format were issued before the HMAC system.
      // No new keys can be activated in this format (saveLicense() rejects them).
      // This path will be removed in the next major version.
      const license = await getLicense();
      if (!license) return 'FREE';

      if (!validateKeyFormat(license)) {
        await removeLicense();
        return 'FREE';
      }

      console.warn(
        '[LicenseManager] DEPRECATION: Legacy PRORISK-XXXX-XXXX key is active. ' +
        'These keys have no cryptographic verification and will stop working in a future update. ' +
        'Please obtain a new license key from your account dashboard.'
      );
      return 'PRO';
    } catch (error) {
      console.error('[LicenseManager] Error getting plan:', error);
      return 'FREE';
    }
  }

  /**
   * Check if user is pro
   * @returns {Promise<boolean>}
   */
  async function isProUser() {
    const plan = await getCurrentPlan();
    return plan === 'PRO';
  }

  /**
   * Get license info for display
   * @returns {Promise<object>}
   */
  async function getLicenseInfo() {
    try {
      const license = await getLicense();
      const plan = await getCurrentPlan();

      return {
        isActive: license !== null,
        license: license ? maskLicense(license) : null,
        plan: plan,
        isPro: plan === 'PRO'
      };
    } catch (error) {
      console.error('[LicenseManager] Error getting license info:', error);
      return {
        isActive: false,
        license: null,
        plan: 'FREE',
        isPro: false
      };
    }
  }

  /**
   * Mask license key for display (show first and last 4 chars)
   * @param {string} key
   * @returns {string}
   */
  function maskLicense(key) {
    if (!key || key.length < 8) return '****';
    return key.substring(0, 10) + '****' + key.substring(key.length - 4);
  }

  /**
   * Validate license with simulated backend check
   * In production, this would call an actual verification endpoint
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async function validateLicense(key) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, NETWORK_SIMULATION_DELAY));

    // For now, just validate format
    // In production: POST to https://api.prorisk.com/validate-license
    if (!validateKeyFormat(key)) {
      return false;
    }

    // TODO: Add revocation list check
    // TODO: Add expiration check if keys are time-limited
    // TODO: Call actual license server

    return true;
  }

  // Public API — frozen to prevent monkey-patching from DevTools
  return Object.freeze({
    validateKeyFormat,
    generateMockLicense,
    saveLicense,
    removeLicense,
    getLicense,
    getCurrentPlan,
    isProUser,
    getLicenseInfo,
    maskLicense,
    validateLicense
  });
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LicenseManager;
}
