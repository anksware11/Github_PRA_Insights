// ============================================================================
// PRO LOCK WRAPPER COMPONENT
// Reusable overlay for locking premium content sections
// Applies blur, opacity reduction, and shows unlock teaser panel
// ============================================================================

const ProLockWrapper = (() => {
  /**
   * Create a locked wrapper around existing content
   * @param {HTMLElement} element - The element to wrap
   * @param {boolean} isLocked - Whether to apply lock
   * @param {string} teaserText - Main teaser text (e.g., "4 more issues hidden")
   * @param {string} secondaryText - Secondary info text (optional)
   * @param {function} onUnlockClick - Callback when unlock button clicked
   */
  function create(element, isLocked, teaserText = '', secondaryText = '', onUnlockClick = null) {
    if (!element) {
      console.error('[ProLockWrapper] Invalid element provided');
      return null;
    }

    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'prs-locked-container';

    // Store click handler reference for cleanup
    let clickHandler = null;

    // Move element's content into wrapper
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);

    const lockInstance = {
      unlock: () => {
        updateLockState(wrapper, element, false, '', '', null, lockInstance);
      },
      lock: () => {
        updateLockState(wrapper, element, true, teaserText, secondaryText, onUnlockClick, lockInstance);
      },
      setTeaser: (text) => {
        teaserText = text;
        if (isLocked) {
          updateLockState(wrapper, element, true, teaserText, secondaryText, onUnlockClick, lockInstance);
        }
      },
      destroy: () => {
        // Remove click handler if it exists
        if (clickHandler) {
          wrapper.removeEventListener('click', clickHandler);
          clickHandler = null;
        }
        const parent = wrapper.parentNode;
        if (parent) {
          parent.replaceChild(element, wrapper);
        }
      },
      _setClickHandler: (handler) => {
        // Remove old handler if it exists
        if (clickHandler) {
          wrapper.removeEventListener('click', clickHandler);
        }
        // Store and add new handler
        clickHandler = handler;
      }
    };

    // Set initial state based on isLocked
    updateLockState(wrapper, element, isLocked, teaserText, secondaryText, onUnlockClick, lockInstance);

    return lockInstance;
  }

  /**
   * Update lock state (apply or remove lock)
   */
  function updateLockState(wrapper, element, isLocked, teaserText, secondaryText, onUnlockClick, lockInstance) {
    // Remove existing overlay if present
    const existingOverlay = wrapper.querySelector('.prs-lock-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    if (isLocked) {
      // Apply locked styles
      element.classList.add('prs-locked-content');
      element.classList.remove('unlocking');

      // Create overlay panel
      const overlay = createOverlayPanel(teaserText, secondaryText, onUnlockClick);
      wrapper.appendChild(overlay);

      // Add click handler to trigger gentle shake (prevents accidental clicks)
      const clickHandler = (e) => {
        // Only shake if clicking on the locked content area (not the CTA button)
        if (e.target.className && !e.target.className.includes('prs-lock-cta-button')) {
          triggerShake(overlay);
        }
      };

      wrapper.addEventListener('click', clickHandler);

      // Store handler reference for cleanup
      if (lockInstance) {
        lockInstance._setClickHandler(clickHandler);
      }
    } else {
      // Remove locked styles with transition
      element.classList.add('unlocking');
      element.classList.remove('prs-locked-content');
    }
  }

  /**
   * Trigger gentle shake animation on overlay
   */
  function triggerShake(overlay) {
    overlay.classList.remove('shaking');
    // Force reflow to restart animation
    void overlay.offsetWidth;
    overlay.classList.add('shaking');

    // Remove shake class after animation completes
    setTimeout(() => {
      overlay.classList.remove('shaking');
    }, 500);
  }

  /**
   * Create the lock overlay panel
   */
  function createOverlayPanel(teaserText, secondaryText, onUnlockClick) {
    const overlay = document.createElement('div');
    overlay.className = 'prs-lock-overlay';

    const content = document.createElement('div');
    content.className = 'prs-lock-overlay-content';

    // Lock icon
    const icon = document.createElement('div');
    icon.className = 'prs-lock-icon';
    icon.textContent = '🔒';

    // Teaser text
    const teaser = document.createElement('div');
    teaser.className = 'prs-lock-teaser';
    teaser.textContent = teaserText || 'Premium Feature Locked';

    // CTA Button
    const button = document.createElement('button');
    button.className = 'prs-lock-cta-button';
    button.innerHTML = '🚀 Unlock Pro – Lifetime Access';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onUnlockClick) {
        onUnlockClick();
      } else if (typeof window.openUpgradeModal === 'function') {
        window.openUpgradeModal();
      }
    });

    content.appendChild(icon);
    content.appendChild(teaser);
    content.appendChild(button);

    // Add microcopy under CTA
    const microcopy = document.createElement('div');
    microcopy.className = 'prs-lock-cta-microcopy';
    microcopy.textContent = 'One-time payment. No subscription.';
    content.appendChild(microcopy);

    // Secondary text (optional)
    if (secondaryText) {
      const secondary = document.createElement('div');
      secondary.className = 'prs-lock-secondary-text';
      secondary.textContent = secondaryText;
      content.appendChild(secondary);
    }

    overlay.appendChild(content);
    return overlay;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────

  return {
    create
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProLockWrapper;
}
