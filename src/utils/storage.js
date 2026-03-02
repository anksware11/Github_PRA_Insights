// ============================================================================
// STORAGE UTILITY - Wrapper for chrome.storage.local
// Provides consistent API for all storage operations across the extension
// ============================================================================

if (!globalThis.__PRQI_LOG_GATED__) {
  const __prqiOriginalLog = console.log.bind(console);
  console.log = (...args) => {
    if (globalThis.PRQI_DEBUG === true) {
      __prqiOriginalLog(...args);
    }
  };
  globalThis.__PRQI_LOG_GATED__ = true;
}

const Storage = (() => {
  /**
   * Get value from storage
   * @param {string|Array<string>} keys - Key or array of keys
   * @returns {Promise<object>} Storage data
   */
  async function get(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('[Storage] Error getting data:', error);
      throw error;
    }
  }

  /**
   * Set value in storage
   * @param {object} data - Key-value pairs to store
   * @returns {Promise<void>}
   */
  async function set(data) {
    try {
      return await chrome.storage.local.set(data);
    } catch (error) {
      console.error('[Storage] Error setting data:', error);
      throw error;
    }
  }

  /**
   * Remove value from storage
   * @param {string|Array<string>} keys - Key or array of keys
   * @returns {Promise<void>}
   */
  async function remove(keys) {
    try {
      return await chrome.storage.local.remove(keys);
    } catch (error) {
      console.error('[Storage] Error removing data:', error);
      throw error;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  async function clear() {
    try {
      return await chrome.storage.local.clear();
    } catch (error) {
      console.error('[Storage] Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Get single value with type safety
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default if not found
   * @returns {Promise<*>} Stored value or default
   */
  async function getValue(key, defaultValue = null) {
    try {
      const result = await get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error(`[Storage] Error getting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set single value
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  async function setValue(key, value) {
    try {
      return await set({ [key]: value });
    } catch (error) {
      console.error(`[Storage] Error setting ${key}:`, error);
      throw error;
    }
  }

  // Public API
  return {
    get,
    set,
    remove,
    clear,
    getValue,
    setValue
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
