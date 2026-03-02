// ============================================================================
// HTML UTILITIES & DOM HELPERS
// Centralized HTML generation, DOM creation, and formatting utilities
// Reduces duplication across panels.js, riskometer.js, badges.js
// ============================================================================

const HTMLUtils = (() => {
  // ──────────────────────────────────────────────────────────────────────────
  // HTML ESCAPING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DOM CREATION HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a generic DOM element with attributes
   * @param {string} tag - HTML tag name
   * @param {string} className - CSS class name(s)
   * @param {string|HTMLElement|Array} content - Text, HTML, or elements
   * @param {object} attributes - Additional attributes (id, data-*, etc)
   * @returns {HTMLElement} Created element
   */
  function createElement(tag, className, content = '', attributes = {}) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('data-')) {
        element.dataset[key.substring(5)] = value;
      } else {
        element.setAttribute(key, value);
      }
    });

    // Add content
    if (typeof content === 'string') {
      if (content.includes('<')) {
        element.innerHTML = content;
      } else {
        element.textContent = content;
      }
    } else if (content instanceof HTMLElement) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(child => {
        if (child) element.appendChild(child);
      });
    }

    return element;
  }

  /**
   * Create a section container
   * @param {string} className - Class name for container
   * @param {HTMLElement|Array} children - Child elements
   * @returns {HTMLElement} Section container
   */
  function createSection(className, ...children) {
    return createElement('div', className, children.flat());
  }

  /**
   * Create a header with title and badge/count
   * @param {string} title - Header title with emoji
   * @param {string|number} badge - Badge text or count
   * @param {string} className - Optional class name
   * @returns {HTMLElement} Header element
   */
  function createHeader(title, badge, className = 'prs-header') {
    const header = createElement('div', className);
    header.innerHTML = `
      <h3>${escapeHTML(title)}</h3>
      ${badge !== undefined ? `<span class="prs-badge">${escapeHTML(badge.toString())}</span>` : ''}
    `;
    return header;
  }

  /**
   * Create a card/panel container
   * @param {string} className - Card class name
   * @param {HTMLElement|Array} children - Child elements
   * @returns {HTMLElement} Card element
   */
  function createCard(className, ...children) {
    return createElement('div', className, children.flat());
  }

  /**
   * Create a list item
   * @param {string} content - Item content (text or HTML)
   * @param {string} className - Optional class name
   * @returns {HTMLElement} List item
   */
  function createListItem(content, className = 'prs-list-item') {
    const li = createElement('li', className);
    if (content.includes('<')) {
      li.innerHTML = content;
    } else {
      li.textContent = escapeHTML(content);
    }
    return li;
  }

  /**
   * Create an unordered list
   * @param {Array} items - Array of items (text or HTML)
   * @param {string} className - Optional list class name
   * @returns {HTMLElement} List element
   */
  function createList(items, className = 'prs-list') {
    const ul = createElement('ul', className);
    items.forEach(item => {
      ul.appendChild(createListItem(item));
    });
    return ul;
  }

  /**
   * Create an ordered list
   * @param {Array} items - Array of items (text or HTML)
   * @param {string} className - Optional list class name
   * @returns {HTMLElement} List element
   */
  function createOrderedList(items, className = 'prs-ordered-list') {
    const ol = createElement('ol', className);
    items.forEach(item => {
      ol.appendChild(createListItem(item));
    });
    return ol;
  }

  /**
   * Create a badge element
   * @param {string} text - Badge text
   * @param {string} style - Inline style string
   * @param {string} className - Optional additional classes
   * @returns {HTMLElement} Badge element
   */
  function createBadge(text, style, className = 'prs-badge') {
    const badge = createElement('span', className, escapeHTML(text));
    if (style) {
      badge.setAttribute('style', style);
    }
    return badge;
  }

  /**
   * Create a row with label and value
   * @param {string} label - Row label
   * @param {string} value - Row value
   * @param {string} className - Optional class name
   * @returns {HTMLElement} Row element
   */
  function createRow(label, value, className = 'prs-detail-row') {
    const row = createElement('div', className);
    row.innerHTML = `
      <div class="prs-label">${escapeHTML(label)}</div>
      <div class="prs-value">${escapeHTML(value)}</div>
    `;
    return row;
  }

  /**
   * Create a code block
   * @param {string} code - Code text
   * @param {string} language - Language identifier (for CSS class)
   * @returns {HTMLElement} Code block
   */
  function createCodeBlock(code, language = '') {
    const pre = createElement('pre', `prs-code ${language}`);
    const codeEl = createElement('code');
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    return pre;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BADGE CREATION HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create severity badge
   * @param {string} severity - Severity level
   * @returns {HTMLElement} Badge element
   */
  function createSeverityBadge(severity) {
    const color = UIColors.getSeverityColor(severity);
    const style = UIColors.createBadgeStyle(color);
    return createBadge(severity, style, `prs-severity-badge prs-severity-${severity.toLowerCase()}`);
  }

  /**
   * Create impact badge
   * @param {string} impact - Impact level
   * @returns {HTMLElement} Badge element
   */
  function createImpactBadge(impact) {
    const color = UIColors.getImpactColor(impact);
    const style = UIColors.createBadgeStyle(color);
    return createBadge(impact, style, `prs-impact-badge prs-impact-${impact.toLowerCase()}`);
  }

  /**
   * Create semver badge
   * @param {string} semver - Semver bump (major, minor, patch)
   * @returns {HTMLElement} Badge element
   */
  function createSemverBadge(semver) {
    const color = UIColors.getSemverColor(semver);
    const style = UIColors.createBadgeStyle(color);
    return createBadge(semver.toUpperCase(), style, `prs-semver-badge`);
  }

  /**
   * Create CWE tag badge
   * @param {string} cweTag - CWE identifier (e.g., 'CWE-89')
   * @returns {HTMLElement} Badge element
   */
  function createCWEBadge(cweTag) {
    return createBadge(cweTag, '', 'prs-cwe-tag');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FORMATTING HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get migration hint for breaking changes
   * @param {string} changeType - Type of change
   * @param {string} semver - Semantic version bump
   * @returns {string} Migration guidance
   */
  function getMigrationHint(changeType, semver) {
    const hints = {
      'function-removal': 'This function has been removed. Migrate to the new API or use a polyfill if needed.',
      'api-change': 'This API endpoint has changed. Update all client code to use the new format.',
      'signature-change': 'The function signature has changed. Update all call sites with the new parameter format.',
      'other': 'Review this change carefully and update dependent code accordingly.'
    };
    return hints[changeType] || hints['other'];
  }

  /**
   * Pluralize word based on count
   * @param {string} word - Word to pluralize
   * @param {number} count - Count
   * @returns {string} Singular or plural form
   */
  function pluralize(word, count) {
    return count === 1 ? word : word + 's';
  }

  /**
   * Format large numbers with commas
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SVG HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculate SVG stroke-dashoffset for circular progress
   * @param {number} percentage - Percentage (0-100)
   * @param {number} radius - Circle radius
   * @returns {number} Dash offset value
   */
  function calculateStrokeDashOffset(percentage, radius = 50) {
    const circumference = 2 * Math.PI * radius;
    return circumference - (percentage / 100) * circumference;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // NO-CONTENT STATES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a "no content" placeholder
   * @param {string} message - Message to display
   * @param {string} emoji - Emoji prefix
   * @returns {HTMLElement} Placeholder element
   */
  function createEmptyState(message, emoji = '✓') {
    const div = createElement('div', 'prs-empty-state');
    div.innerHTML = `<p>${emoji} ${escapeHTML(message)}</p>`;
    return div;
  }

  // Public API
  return {
    // HTML escaping
    escapeHTML,

    // DOM creation
    createElement,
    createSection,
    createCard,
    createHeader,
    createList,
    createOrderedList,
    createListItem,
    createCodeBlock,
    createRow,
    createBadge,

    // Badge creation
    createSeverityBadge,
    createImpactBadge,
    createSemverBadge,
    createCWEBadge,

    // Formatting
    getMigrationHint,
    pluralize,
    formatNumber,

    // SVG
    calculateStrokeDashOffset,

    // States
    createEmptyState
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HTMLUtils;
}
