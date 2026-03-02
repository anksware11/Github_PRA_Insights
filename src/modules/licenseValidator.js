// ============================================================================
// LICENSE VALIDATOR MODULE
// HMAC-SHA256 Client-Side License Validation with Device Binding
// Format: PRORISK|email|expiryTimestamp|signature
// Signature = HMAC_SHA256(secretKey, email + expiryTimestamp + deviceId)
// Device binding ensures each license works on only one device
//
// SECURITY MODEL:
//   1. Local HMAC check — catches format errors, typos, and expired licenses
//   2. Server verification  — authoritative gate; rejects forged/revoked licenses
//      Server check fails-open on network error (offline mode) for UX,
//      and fails-closed on explicit rejection (HTTP 200 valid=false).
//      Set REQUIRE_SERVER_VERIFICATION=true in production to fail-closed always.
// ============================================================================

const LicenseValidator = (() => {
  // ──────────────────────────────────────────────────────────────────────────
  // SERVER VERIFICATION
  // Client-side HMAC provides format integrity only — not a security boundary.
  // The server endpoint is the only trustworthy validation gate.
  // Replace SERVER_VERIFICATION_URL with your actual endpoint before launch.
  // ──────────────────────────────────────────────────────────────────────────

  const SERVER_VERIFICATION_URL = 'https://api.prorisk.com/v1/licenses/verify';
  // Set to true in production to reject licenses when server is unreachable
  const REQUIRE_SERVER_VERIFICATION = false;

  // ──────────────────────────────────────────────────────────────────────────
  // HMAC VERIFICATION
  // NOTE: This secret is visible in client source. HMAC here provides format
  // integrity (catches typos/corruption) NOT security. Server verification is
  // the real gate. Do not treat this key as a secret.
  // ──────────────────────────────────────────────────────────────────────────

  function getSecretKey() {
    return 'prorisk-hmac-validation-key-2024-secure-hash';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SERVER VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verify license token with the authoritative server endpoint.
   * - Returns { valid: true }  — server confirms the license
   * - Returns { valid: false, reason } — server explicitly rejects (forge/revoke)
   * - Returns { valid: true, serverUnavailable: true } — network failure, fail-open
   * @param {string} licenseToken - Raw license string
   * @param {string} deviceId - Current device fingerprint
   * @returns {Promise<{valid: boolean, serverUnavailable?: boolean, reason?: string}>}
   */
  async function serverVerify(licenseToken, deviceId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(SERVER_VERIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: licenseToken, deviceId: deviceId || '' }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // HTTP error from server (5xx = server problem, treat as unavailable)
        if (response.status >= 500) {
          console.warn('[LicenseValidator] Server error during verification:', response.status);
          return { valid: true, serverUnavailable: true };
        }
        // 4xx = explicit rejection (invalid/revoked)
        return { valid: false, reason: `Server rejected license (HTTP ${response.status})` };
      }

      const data = await response.json();
      return {
        valid: data.valid === true,
        reason: data.reason || null
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('[LicenseValidator] Server verification timed out — offline mode');
      } else {
        console.warn('[LicenseValidator] Server verification unavailable:', error.message);
      }
      // Network failure: fail-open in beta, fail-closed in production
      if (REQUIRE_SERVER_VERIFICATION) {
        return { valid: false, reason: 'Could not reach license server' };
      }
      return { valid: true, serverUnavailable: true };
    }
  }

  /**
   * Generate HMAC-SHA256 signature (includes device binding)
   * @param {string} email - Email address
   * @param {number} expiryTimestamp - Expiry timestamp
   * @param {string} deviceId - Device fingerprint (optional for backward compatibility)
   * @returns {Promise<string>} HMAC signature (hex)
   */
  async function generateSignature(email, expiryTimestamp, deviceId = '') {
    const secretKey = getSecretKey();
    // Message includes deviceId to bind license to specific device
    const message = email + expiryTimestamp + deviceId;

    try {
      // Import the key using SubtleCrypto API
      const keyData = new TextEncoder().encode(secretKey);
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // Sign the message
      const messageData = new TextEncoder().encode(message);
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        messageData
      );

      // Convert to hex string
      const hexSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return hexSignature;
    } catch (error) {
      console.error('[LicenseValidator] Signature generation error:', error);
      throw new Error('Failed to generate HMAC signature');
    }
  }

  /**
   * Verify HMAC-SHA256 signature (device-specific)
   * @param {string} email - Email address
   * @param {number} expiryTimestamp - Expiry timestamp
   * @param {string} providedSignature - Provided signature to verify
   * @param {string} deviceId - Device fingerprint (optional for backward compatibility)
   * @returns {Promise<boolean>} True if signature is valid
   */
  async function verifySignature(email, expiryTimestamp, providedSignature, deviceId = '') {
    try {
      // Generate expected signature with device binding
      const expectedSignature = await generateSignature(email, expiryTimestamp, deviceId);

      // Constant-time comparison to prevent timing attacks
      const provided = providedSignature.toLowerCase();
      const expected = expectedSignature.toLowerCase();

      if (provided.length !== expected.length) {
        return false;
      }

      let match = true;
      for (let i = 0; i < expected.length; i++) {
        if (provided[i] !== expected[i]) {
          match = false;
        }
      }

      return match;
    } catch (error) {
      console.error('[LicenseValidator] Signature verification error:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LICENSE PARSING & VALIDATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Parse license string
   * Format: PRORISK|email|expiryTimestamp|signature
   * @param {string} licenseString - Raw license string
   * @returns {object|null} Parsed license or null if invalid format
   */
  function parseLicense(licenseString) {
    if (!licenseString || typeof licenseString !== 'string') {
      return null;
    }

    const parts = licenseString.trim().split('|');

    if (parts.length !== 4) {
      console.error('[LicenseValidator] Invalid license format: expected 4 parts, got', parts.length);
      return null;
    }

    const [prefix, email, expiryStr, signature] = parts;

    // Validate prefix
    if (prefix !== 'PRORISK') {
      console.error('[LicenseValidator] Invalid license prefix:', prefix);
      return null;
    }

    // Validate email format (basic check)
    if (!email || !email.includes('@')) {
      console.error('[LicenseValidator] Invalid email format:', email);
      return null;
    }

    // Parse expiry timestamp
    const expiryTimestamp = parseInt(expiryStr, 10);
    if (isNaN(expiryTimestamp) || expiryTimestamp <= 0) {
      console.error('[LicenseValidator] Invalid expiry timestamp:', expiryStr);
      return null;
    }

    // Validate signature format (should be hex, 64 chars for SHA256)
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      console.error('[LicenseValidator] Invalid signature format');
      return null;
    }

    return {
      prefix,
      email,
      expiryTimestamp,
      signature,
      raw: licenseString
    };
  }

  /**
   * Check if license is expired
   * @param {number} expiryTimestamp - License expiry timestamp
   * @returns {object} Expiry status
   */
  function checkExpiry(expiryTimestamp) {
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    const expiresInSeconds = expiryTimestamp - nowSeconds;
    const expiresInDays = Math.floor(expiresInSeconds / 86400);

    return {
      isExpired: expiresInSeconds <= 0,
      expiresAt: new Date(expiryTimestamp * 1000),
      expiresInSeconds,
      expiresInDays,
      daysUntilExpiry: Math.max(0, expiresInDays)
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN VALIDATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Validate complete license (with device binding)
   * @param {string} licenseString - Raw license string
   * @param {string} deviceId - Current device fingerprint (optional, obtained from DeviceFingerprint)
   * @returns {Promise<object>} Validation result
   */
  async function validateLicense(licenseString, deviceId = null) {
    const result = {
      isValid: false,
      email: null,
      deviceId: null,
      expiresAt: null,
      expiresInDays: null,
      errors: [],
      warnings: []
    };

    try {
      // Get current device fingerprint if not provided
      if (!deviceId && typeof DeviceFingerprint !== 'undefined') {
        try {
          deviceId = await DeviceFingerprint.getCachedFingerprint();
          console.log('[LicenseValidator] Using device fingerprint for validation');
        } catch (error) {
          console.warn('[LicenseValidator] Could not get device fingerprint:', error);
          result.warnings.push('Device fingerprint unavailable for binding verification');
          // Continue with empty deviceId for backward compatibility
          deviceId = '';
        }
      }

      result.deviceId = deviceId || null;

      // Step 1: Parse license
      const parsed = parseLicense(licenseString);
      if (!parsed) {
        result.errors.push('Invalid license format');
        return result;
      }

      result.email = parsed.email;

      // Step 2: Check expiry
      const expiry = checkExpiry(parsed.expiryTimestamp);
      result.expiresAt = expiry.expiresAt;
      result.expiresInDays = expiry.daysUntilExpiry;

      if (expiry.isExpired) {
        result.errors.push(`License expired on ${expiry.expiresAt.toISOString()}`);
        return result;
      }

      // Step 3: Warn if expiring soon
      if (expiry.expiresInDays <= 7) {
        result.warnings.push(`License expires in ${expiry.expiresInDays} days`);
      }

      // Step 4: Verify signature (with device binding)
      const signatureValid = await verifySignature(
        parsed.email,
        parsed.expiryTimestamp,
        parsed.signature,
        deviceId || ''
      );

      if (!signatureValid) {
        result.errors.push('License signature verification failed');
        // Check if it might be a device mismatch
        if (deviceId) {
          result.errors.push('(This may be due to different device or tampered license)');
        }
        return result;
      }

      // All validations passed

      // Step 5: Server-side authoritative verification
      // Server is the only gate that can catch forged/revoked licenses.
      // Fails-open on network error (offline mode); fails-closed on explicit rejection.
      const serverCheck = await serverVerify(licenseString, deviceId || '');
      if (!serverCheck.valid) {
        result.errors.push(serverCheck.reason || 'License rejected by server');
        return result;
      }
      if (serverCheck.serverUnavailable) {
        result.warnings.push('License server unreachable — running in offline mode');
      }

      result.isValid = true;
      return result;
    } catch (error) {
      console.error('[LicenseValidator] Validation error:', error);
      result.errors.push(`Validation error: ${error.message}`);
      return result;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STORAGE MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Store validated license securely (with device binding info)
   * @param {object} validationResult - Result from validateLicense
   * @param {string} licenseString - Raw license string
   * @returns {Promise<boolean>} Success status
   */
  async function storeLicense(validationResult, licenseString) {
    if (!validationResult.isValid) {
      console.error('[LicenseValidator] Cannot store invalid license');
      return false;
    }

    try {
      const licenseData = {
        raw: licenseString,
        email: validationResult.email,
        deviceId: validationResult.deviceId, // Store device fingerprint with license
        expiresAt: validationResult.expiresAt.toISOString(),
        expiresInDays: validationResult.expiresInDays,
        validatedAt: new Date().toISOString(),
        isValid: true
      };

      await chrome.storage.local.set({
        proLicense: licenseData,
        isProUser: true
      });

      console.log('[LicenseValidator] License stored securely:', {
        email: validationResult.email,
        deviceId: validationResult.deviceId,
        expiresAt: validationResult.expiresAt.toISOString()
      });

      return true;
    } catch (error) {
      console.error('[LicenseValidator] Storage error:', error);
      return false;
    }
  }

  /**
   * Retrieve stored license
   * @returns {Promise<object|null>} Stored license or null
   */
  async function getStoredLicense() {
    try {
      const result = await chrome.storage.local.get(['proLicense']);
      return result.proLicense || null;
    } catch (error) {
      console.error('[LicenseValidator] Storage retrieval error:', error);
      return null;
    }
  }

  /**
   * Clear stored license
   * @returns {Promise<boolean>} Success status
   */
  async function clearLicense() {
    try {
      await chrome.storage.local.set({
        proLicense: null,
        isProUser: false
      });
      console.log('[LicenseValidator] License cleared');
      return true;
    } catch (error) {
      console.error('[LicenseValidator] Clear error:', error);
      return false;
    }
  }

  /**
   * Check if stored license is still valid (includes device verification)
   * @returns {Promise<boolean>} True if stored license is valid, not expired, and on correct device
   */
  async function isStoredLicenseValid() {
    try {
      const stored = await getStoredLicense();
      if (!stored) {
        return false;
      }

      const expiresAt = new Date(stored.expiresAt);
      const now = new Date();

      // Check expiry
      if (!(now < expiresAt && stored.isValid === true)) {
        return false;
      }

      // Check device binding if deviceId is stored
      if (stored.deviceId && typeof DeviceFingerprint !== 'undefined') {
        try {
          const currentDeviceId = await DeviceFingerprint.getCachedFingerprint();
          if (currentDeviceId !== stored.deviceId) {
            console.warn('[LicenseValidator] Device mismatch: License bound to different device');
            return false;
          }
        } catch (error) {
          console.warn('[LicenseValidator] Could not verify device binding:', error);
          // If we can't verify device but it's stored, be lenient
        }
      }

      return true;
    } catch (error) {
      console.error('[LicenseValidator] Validity check error:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate a test license (for development/testing only)
   * Includes device binding to current device
   * @param {string} email - Email to use
   * @param {number} daysValid - Days until expiry
   * @returns {Promise<string>} Test license string
   */
  async function generateTestLicense(email, daysValid = 30) {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (daysValid * 86400);

    // Get current device ID for binding
    let deviceId = '';
    if (typeof DeviceFingerprint !== 'undefined') {
      try {
        deviceId = await DeviceFingerprint.getCachedFingerprint();
      } catch (error) {
        console.warn('[LicenseValidator] Could not get device ID for test license:', error);
      }
    }

    const signature = await generateSignature(email, expiryTimestamp, deviceId);
    return `PRORISK|${email}|${expiryTimestamp}|${signature}`;
  }

  /**
   * Get license status (including device binding info)
   * @returns {Promise<object>} Complete license status
   */
  async function getLicenseStatus() {
    const stored = await getStoredLicense();
    const isValid = await isStoredLicenseValid();

    // Get current device info if available
    let currentDevice = null;
    if (typeof DeviceFingerprint !== 'undefined') {
      try {
        const deviceName = DeviceFingerprint.getDeviceName();
        currentDevice = deviceName;
      } catch (error) {
        // Ignore
      }
    }

    return {
      hasLicense: stored !== null,
      isValid,
      email: stored?.email || null,
      deviceId: stored?.deviceId || null,
      currentDevice,
      deviceBound: stored?.deviceId ? true : false,
      expiresAt: stored?.expiresAt || null,
      expiresInDays: stored?.expiresInDays || null,
      validatedAt: stored?.validatedAt || null,
      requiresRevalidation: stored && !isValid
    };
  }

  /**
   * Verify if current device matches stored license device binding
   * @returns {Promise<boolean>} True if device matches or no device binding
   */
  async function verifyDeviceBinding() {
    if (typeof DeviceFingerprint === 'undefined') {
      console.warn('[LicenseValidator] DeviceFingerprint module not available');
      return true; // Can't verify, assume it's ok
    }

    try {
      const stored = await getStoredLicense();
      if (!stored || !stored.deviceId) {
        return true; // No device binding stored
      }

      const currentDeviceId = await DeviceFingerprint.getCachedFingerprint();
      return currentDeviceId === stored.deviceId;
    } catch (error) {
      console.error('[LicenseValidator] Device verification error:', error);
      return false;
    }
  }

  // Public API — frozen to prevent monkey-patching from DevTools
  // generateTestLicense intentionally not exported (internal use only)
  return Object.freeze({
    // Validation (with device binding)
    validateLicense,
    parseLicense,
    checkExpiry,
    verifySignature,
    generateSignature,

    // Device Binding
    verifyDeviceBinding,

    // Storage
    storeLicense,
    getStoredLicense,
    clearLicense,
    isStoredLicenseValid,

    // Status
    getLicenseStatus
  });
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LicenseValidator;
}
