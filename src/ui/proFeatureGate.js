// ============================================================================
// PRO FEATURE GATE COORDINATOR
// Manages lock state, coordinates between components, exposes global functions
// ============================================================================

const ProFeatureGate = (() => {
  let lockInstances = new Map();
  let isProUser = false;

  /**
   * Initialize the gate system
   * Exposes window.openUpgradeModal() globally
   */
  function init() {
    // Expose global function
    window.openUpgradeModal = () => {
      if (typeof UpgradeModal !== 'undefined') {
        UpgradeModal.open({
          onUnlock: () => {
            // Open popup with license tab
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage(
                { action: 'openLicenseTab' },
                (response) => {
                  // Handle any runtime errors from the message
                  if (chrome.runtime.lastError) {
                    console.warn('[ProFeatureGate] Error opening license tab:', chrome.runtime.lastError.message);
                  } else {
                    console.log('[ProFeatureGate] License tab opened');
                  }
                }
              );
            }
          }
        });
      }
    };

    console.log('[ProFeatureGate] Initialized – window.openUpgradeModal() available');
  }

  /**
   * Lock a section with overlay
   * @param {HTMLElement} element - Element to lock
   * @param {string} teaserText - Teaser text for overlay
   * @param {boolean} shouldLock - Whether to apply lock
   * @param {string} secondaryText - Optional secondary text
   * @returns {object} Lock instance with control methods
   */
  function lockSection(element, teaserText, shouldLock, secondaryText = '') {
    if (!element) {
      console.error('[ProFeatureGate] Invalid element for locking');
      return null;
    }

    const elementId = generateElementId(element);

    // Remove existing lock if any
    if (lockInstances.has(elementId)) {
      const existing = lockInstances.get(elementId);
      existing.destroy?.();
      lockInstances.delete(elementId);
    }

    // Create new lock wrapper
    if (shouldLock && typeof ProLockWrapper !== 'undefined') {
      const lockInstance = ProLockWrapper.create(
        element,
        true,
        teaserText,
        secondaryText,
        window.openUpgradeModal
      );

      if (lockInstance) {
        lockInstances.set(elementId, lockInstance);
        console.log('[ProFeatureGate] Section locked:', teaserText);
        return lockInstance;
      }
    }

    return null;
  }

  /**
   * Unlock all locked sections
   */
  function unlockAll() {
    console.log('[ProFeatureGate] Unlocking all sections');
    lockInstances.forEach((lock) => {
      lock.unlock?.();
    });
  }

  /**
   * Lock all sections
   */
  function lockAll() {
    console.log('[ProFeatureGate] Locking all sections');
    lockInstances.forEach((lock) => {
      lock.lock?.();
    });
  }

  /**
   * Update pro user status
   * Reactive: unlocks sections when user becomes pro
   */
  function setProUser(proStatus) {
    const wasProUser = isProUser;
    isProUser = proStatus;

    console.log('[ProFeatureGate] Pro status updated:', proStatus);

    // If user just became pro, unlock everything
    if (!wasProUser && proStatus) {
      unlockAll();
    }
    // If user just lost pro, lock everything
    else if (wasProUser && !proStatus) {
      lockAll();
    }
  }

  /**
   * Get pro user status
   */
  function isUserPro() {
    return isProUser;
  }

  /**
   * Clear all locks
   */
  function clear() {
    lockInstances.forEach((lock) => {
      lock.destroy?.();
    });
    lockInstances.clear();
    console.log('[ProFeatureGate] All locks cleared');
  }

  /**
   * Generate stable ID for element
   */
  function generateElementId(element) {
    // Use element's ID if available
    if (element.id) {
      return element.id;
    }

    // Otherwise create one from class names
    const className = element.className;
    if (className) {
      return className.split(/\s+/).slice(0, 3).join('-');
    }

    // Fallback: use object reference
    return Symbol.for(element);
  }

  // Public API — frozen to prevent monkey-patching from DevTools
  return Object.freeze({
    init,
    lockSection,
    unlockAll,
    lockAll,
    setProUser,
    isUserPro,
    clear,
    getLockCount: () => lockInstances.size
  });
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProFeatureGate;
}
