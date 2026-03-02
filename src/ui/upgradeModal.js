// ============================================================================
// UPGRADE MODAL COMPONENT
// Beautiful glassmorphic modal for displaying pro features and CTAs
// ============================================================================

const UpgradeModal = (() => {
  let currentInstance = null;
  let closeTimeoutId = null;

  const PRO_FEATURES = [
    'Full security audit (unlimited issues)',
    'Breaking change detection & analysis',
    'Test gap analysis & recommendations',
    'Commit message optimization',
    'Scan history & analytics dashboard',
    'Advanced risk trends & insights'
  ];

  /**
   * Open the upgrade modal
   * @param {object} options - Modal configuration
   * @param {string} options.title - Modal title (default: "Ship PRs With Confidence")
   * @param {array} options.features - Feature list (default: PRO_FEATURES)
   * @param {function} options.onUnlock - Callback for unlock button
   * @param {function} options.onClose - Callback for close/secondary button
   */
  function open(options = {}) {
    // Close existing instance
    if (currentInstance) {
      close();
    }
    // Clear pending close timeout if any
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }

    const config = {
      title: options.title || 'Ship PRs With Confidence',
      features: options.features || PRO_FEATURES,
      onUnlock: options.onUnlock || (() => {
        // Default: open popup with license input
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.openOptionsPage?.();
        }
      }),
      onClose: options.onClose || (() => close())
    };

    currentInstance = createModal(config);
    document.body.appendChild(currentInstance);

    // Add backdrop click handler
    const backdrop = currentInstance.querySelector('.prs-upgrade-modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          close();
        }
      });
    }

    return currentInstance;
  }

  /**
   * Close the upgrade modal
   */
  function close() {
    if (currentInstance) {
      // Fade out animation
      currentInstance.style.opacity = '0';
      // Clear any pending timeout first
      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
      }
      closeTimeoutId = setTimeout(() => {
        if (currentInstance && currentInstance.parentNode) {
          currentInstance.parentNode.removeChild(currentInstance);
        }
        currentInstance = null;
        closeTimeoutId = null;
      }, 300);
    }
  }

  /**
   * Create the modal DOM structure
   */
  function createModal(config) {
    const backdrop = document.createElement('div');
    backdrop.className = 'prs-upgrade-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'prs-upgrade-modal';

    // Header with title and close button
    const header = createHeader(config.title);
    modal.appendChild(header);

    // Content area with features list
    const content = createContent(config.features);
    modal.appendChild(content);

    // Action buttons
    const actions = createActions(config.onUnlock, config.onClose);
    modal.appendChild(actions);

    backdrop.appendChild(modal);

    // Add fade-in animation
    setTimeout(() => {
      backdrop.style.opacity = '1';
    }, 10);

    return backdrop;
  }

  /**
   * Create header with title and close button
   */
  function createHeader(title) {
    const header = document.createElement('div');
    header.className = 'prs-upgrade-modal-header';

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'prs-upgrade-modal-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', close);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Create content area with features list
   */
  function createContent(features) {
    const content = document.createElement('div');
    content.className = 'prs-upgrade-modal-content';

    // Features intro
    const intro = document.createElement('div');
    intro.style.fontSize = '13px';
    intro.style.color = 'var(--text-secondary)';
    intro.style.fontStyle = 'italic';
    intro.textContent = '✨ Unlock Pro Features:';

    content.appendChild(intro);

    // Features list
    const featuresList = document.createElement('div');
    featuresList.className = 'prs-upgrade-modal-features';

    features.forEach((feature) => {
      const item = document.createElement('div');
      item.className = 'prs-upgrade-modal-feature-item';
      item.textContent = feature;
      featuresList.appendChild(item);
    });

    content.appendChild(featuresList);

    return content;
  }

  /**
   * Create action buttons area
   */
  function createActions(onUnlock, onClose) {
    const actions = document.createElement('div');
    actions.className = 'prs-upgrade-modal-actions';

    // Primary unlock button
    const primaryBtn = document.createElement('button');
    primaryBtn.className = 'prs-upgrade-modal-primary-btn';
    primaryBtn.innerHTML = '🚀 UNLOCK PRO – GET LIFETIME ACCESS';
    primaryBtn.addEventListener('click', () => {
      onUnlock();
      close();
    });

    // Secondary link (continue with free)
    const secondaryLink = document.createElement('button');
    secondaryLink.className = 'prs-upgrade-modal-secondary-link';
    secondaryLink.textContent = 'Continue with Free Plan';
    secondaryLink.addEventListener('click', () => {
      onClose();
      close();
    });

    actions.appendChild(primaryBtn);
    actions.appendChild(secondaryLink);

    return actions;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────

  return {
    open,
    close,
    isOpen: () => currentInstance !== null,
    getInstance: () => currentInstance
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpgradeModal;
}
