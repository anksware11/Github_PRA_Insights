// ============================================================================
// DEVICE FINGERPRINT MODULE
// Generates and manages unique device identifiers for license binding
// Device ID = hash(userAgent + chrome.runtime.id + randomSalt)
// ============================================================================

const DeviceFingerprint = (() => {
  const STORAGE_KEY = 'deviceFingerprint';
  const SALT_KEY = 'deviceFingerprintSalt';

  // ──────────────────────────────────────────────────────────────────────────
  // DEVICE ID GENERATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate random salt for device fingerprint
   * @returns {string} Random hex string (32 chars)
   */
  function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate device fingerprint
   * Combines:
   * - navigator.userAgent (browser/OS identifier)
   * - chrome.runtime.id (extension-specific ID)
   * - randomSalt (prevents identical devices having same ID)
   * @returns {Promise<string>} Device fingerprint (64 hex chars)
   */
  async function generateDeviceFingerprint() {
    try {
      // Get or create salt
      let salt = await getSalt();
      if (!salt) {
        salt = generateSalt();
        await setSalt(salt);
        console.log('[DeviceFingerprint] New device salt generated');
      }

      // Get extension ID (immutable identifier)
      const extensionId = chrome.runtime.id;

      // Get manifest version (harder to spoof than userAgent)
      let manifestVersion = '';
      try {
        const manifest = chrome.runtime.getManifest();
        manifestVersion = manifest.version || '';
      } catch (e) {
        // Fallback if manifest access fails
        manifestVersion = '';
      }

      // Combine components
      // NOTE: userAgent is spoofable in DevTools - server-side validation required for security
      const userAgent = navigator.userAgent;
      const combined = userAgent + extensionId + manifestVersion + salt;

      // Hash with SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);

      // Convert to hex
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const deviceId = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return deviceId;
    } catch (error) {
      console.error('[DeviceFingerprint] Generation error:', error);
      throw new Error('Failed to generate device fingerprint');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SALT MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get stored salt from Chrome storage
   * @returns {Promise<string|null>} Stored salt or null if not found
   */
  async function getSalt() {
    try {
      const result = await chrome.storage.local.get(SALT_KEY);
      return result[SALT_KEY] || null;
    } catch (error) {
      console.error('[DeviceFingerprint] Salt retrieval error:', error);
      return null;
    }
  }

  /**
   * Store salt in Chrome storage
   * @param {string} salt - Salt to store
   * @returns {Promise<boolean>} Success status
   */
  async function setSalt(salt) {
    try {
      await chrome.storage.local.set({ [SALT_KEY]: salt });
      return true;
    } catch (error) {
      console.error('[DeviceFingerprint] Salt storage error:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FINGERPRINT CACHING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get or create cached device fingerprint
   * Fingerprint is stable across sessions (uses stored salt)
   * @returns {Promise<string>} Device fingerprint
   */
  async function getCachedFingerprint() {
    try {
      // Check if we have it cached
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        return result[STORAGE_KEY];
      }

      // Generate and cache it
      const fingerprint = await generateDeviceFingerprint();
      await chrome.storage.local.set({ [STORAGE_KEY]: fingerprint });
      console.log('[DeviceFingerprint] Cached new fingerprint');

      return fingerprint;
    } catch (error) {
      console.error('[DeviceFingerprint] Cache error:', error);
      // Fall back to generating without caching
      return generateDeviceFingerprint();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DEVICE INFO
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get device information (for display/logging)
   * @returns {object} Device info
   */
  function getDeviceInfo() {
    const ua = navigator.userAgent;

    // Simple OS detection
    let os = 'Unknown';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('X11') || ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    // Simple browser detection
    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    return {
      os,
      browser,
      userAgent: ua,
      extensionId: chrome.runtime.id,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get user-friendly device name
   * @returns {string} Device name (e.g., "Chrome on macOS")
   */
  function getDeviceName() {
    const info = getDeviceInfo();
    return `${info.browser} on ${info.os}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DEVICE VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verify fingerprint matches current device
   * Used to ensure license is bound to correct device
   * @param {string} storedFingerprint - Previously stored fingerprint
   * @returns {Promise<boolean>} True if fingerprints match
   */
  async function verifyFingerprint(storedFingerprint) {
    try {
      const currentFingerprint = await getCachedFingerprint();
      return currentFingerprint === storedFingerprint;
    } catch (error) {
      console.error('[DeviceFingerprint] Verification error:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FACTORY RESET / MIGRATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reset device fingerprint (for testing or factory reset)
   * @returns {Promise<boolean>} Success status
   */
  async function resetFingerprint() {
    try {
      await chrome.storage.local.remove([STORAGE_KEY, SALT_KEY]);
      console.log('[DeviceFingerprint] Fingerprint reset');
      return true;
    } catch (error) {
      console.error('[DeviceFingerprint] Reset error:', error);
      return false;
    }
  }

  /**
   * Migrate fingerprint to new device
   * Used when user installs extension on new device with same license
   * @returns {Promise<string>} New device fingerprint
   */
  async function migrateToNewDevice() {
    try {
      await resetFingerprint();
      const newFingerprint = await getCachedFingerprint();
      console.log('[DeviceFingerprint] Migrated to new device');
      return newFingerprint;
    } catch (error) {
      console.error('[DeviceFingerprint] Migration error:', error);
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // Salt management and resetFingerprint are intentionally NOT exported.
  // Exposing resetFingerprint() lets any caller destroy device binding.
  // Exposing getSalt/setSalt/generateSalt exposes the binding mechanism.
  // migrateToNewDevice() is the only legitimate reset path (calls reset internally).
  // ──────────────────────────────────────────────────────────────────────────

  return Object.freeze({
    // Generation & Caching
    generateDeviceFingerprint,
    getCachedFingerprint,

    // Verification
    verifyFingerprint,

    // Info
    getDeviceInfo,
    getDeviceName,

    // Migration only — not a general reset
    migrateToNewDevice
  });
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceFingerprint;
}
