// ============================================================================
// UI BADGES MODULE
// Badge rendering and color utilities
// Handles: Severity badges, Impact badges, Semver badges, Coverage badges
// ============================================================================

const UIBadges = (() => {
  /**
   * Render severity badge
   * @param {string} severity - Severity level: 'Critical', 'High', 'Medium', 'Low'
   * @returns {string} HTML badge string
   */
  function renderSeverityBadge(severity) {
    const color = getSeverityColor(severity);
    return `<span class="prs-severity-badge" style="background-color: ${color}20; border-color: ${color}; color: ${color}">${severity}</span>`;
  }

  /**
   * Render impact badge
   * @param {string} impact - Impact level: 'critical', 'high', 'medium', 'low'
   * @returns {string} HTML badge string
   */
  function renderImpactBadge(impact) {
    const color = getImpactColor(impact);
    return `<span class="prs-impact-badge" style="background-color: ${color}20; border-color: ${color}; color: ${color}">${impact}</span>`;
  }

  /**
   * Render semver badge
   * @param {string} semver - Semver bump: 'major', 'minor', 'patch'
   * @returns {string} HTML badge string
   */
  function renderSemverBadge(semver) {
    const color = getSemverColor(semver);
    return `<span class="prs-semver-badge" style="background-color: ${color}40; border-color: ${color}; color: ${color}">${semver.toUpperCase()}</span>`;
  }

  /**
   * Get severity color (delegated to UIColors)
   * @param {string} severity - Severity level
   * @returns {string} Hex color code
   */
  function getSeverityColor(severity) {
    return UIColors.getSeverityColor(severity);
  }

  /**
   * Get impact color (delegated to UIColors)
   * @param {string} impact - Impact level
   * @returns {string} Hex color code
   */
  function getImpactColor(impact) {
    return UIColors.getImpactColor(impact);
  }

  /**
   * Get semantic version color (delegated to UIColors)
   * @param {string} semver - 'major' | 'minor' | 'patch'
   * @returns {string} Hex color code
   */
  function getSemverColor(semver) {
    return UIColors.getSemverColor(semver);
  }

  /**
   * Get test coverage color (delegated to UIColors)
   * @param {number} percentage - Coverage percentage
   * @returns {string} Hex color code
   */
  function getCoverageColor(percentage) {
    return UIColors.getCoverageColor(percentage);
  }

  // Public API
  return {
    renderSeverityBadge,
    renderImpactBadge,
    renderSemverBadge,
    getSeverityColor,
    getImpactColor,
    getSemverColor,
    getCoverageColor
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIBadges;
}
