// ============================================================================
// UI RENDERER MODULE (WRAPPER)
// Backward-compatible wrapper around UIPanels and UIRiskometer
// Maintained for backward compatibility with existing code
// All implementations delegated to primary modules (Phase 3)
// ============================================================================

const UIRenderer = (() => {
  /**
   * DELEGATED: Render full security audit section
   * @param {Array} securityIssues - Array of issues from RiskEngine.calculateSecurityRisk()
   * @returns {HTMLElement} Container with security audit
   */
  function renderSecurityAudit(securityIssues = []) {
    return UIPanels.renderSecurityAudit(securityIssues);
  }

  /**
   * DELEGATED: Render individual security issue card
   * @param {object} issue - Issue object with severity, CWE, fix, etc.
   * @param {number} index - Issue index for numbering
   * @returns {HTMLElement} Security issue card
   */
  function renderSecurityIssueCard(issue, index) {
    return UIPanels.renderSecurityIssueCard(issue, index);
  }

  /**
   * DELEGATED: Render breaking changes panel
   * @param {Array} breakingChanges - Array from RiskEngine.detectBreakingChanges()
   * @returns {HTMLElement} Breaking changes panel
   */
  function renderBreakingChangesPanel(breakingChanges = []) {
    return UIPanels.renderBreakingChangesPanel(breakingChanges);
  }

  /**
   * DELEGATED: Render individual breaking change card
   * @param {object} change - Change object with type, semver, impact
   * @param {number} index - Change index
   * @returns {HTMLElement} Breaking change card
   */
  function renderBreakingChangeCard(change, index) {
    return UIPanels.renderBreakingChangeCard(change, index);
  }

  /**
   * DELEGATED: Render test coverage analysis panel
   * @param {object} coverage - Coverage object from RiskEngine.analyzeTestCoverage()
   * @returns {HTMLElement} Test coverage panel
   */
  function renderTestCoveragePanel(coverage = {}) {
    return UIPanels.renderTestCoveragePanel(coverage);
  }

  /**
   * DELEGATED: Render critical issues panel (top 5-10 issues)
   * @param {Array} allIssues - All issues from security audit
   * @param {number} limit - Max issues to show (default 5)
   * @returns {HTMLElement} Critical issues panel
   */
  function renderCriticalIssuesPanel(allIssues = [], limit = 5) {
    return UIPanels.renderCriticalIssuesPanel(allIssues, limit);
  }

  /**
   * DELEGATED: Render advanced riskometer with breakdown and trend
   * @param {object} breakdown - Risk breakdown from RiskEngine.calculateRiskBreakdown()
   * @param {object} trend - Trend data from RiskEngine.compareTrendToPreviousPR()
   * @param {number} totalRisk - Overall risk score (0-100)
   * @returns {HTMLElement} Advanced riskometer container
   */
  function renderAdvancedRiskometer(breakdown = {}, trend = {}, totalRisk = 0) {
    return UIRiskometer.renderAdvancedRiskometer(breakdown, trend, totalRisk);
  }

  /**
   * DELEGATED: Render breakdown donut chart
   * @param {object} breakdown - Risk breakdown percentages
   * @returns {string} SVG HTML for donut chart
   */
  function renderBreakdownDonut(breakdown = {}) {
    return UIRiskometer.renderBreakdownDonut(breakdown);
  }

  /**
   * DELEGATED: Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHTML(text) {
    return HTMLUtils.escapeHTML(text);
  }

  /**
   * DELEGATED: Get severity color
   * @param {string} severity - Severity level
   * @returns {string} Hex color code
   */
  function getSeverityColor(severity) {
    return UIColors.getSeverityColor(severity);
  }

  /**
   * DELEGATED: Get impact color
   * @param {string} impact - Impact level
   * @returns {string} Hex color code
   */
  function getImpactColor(impact) {
    return UIColors.getImpactColor(impact);
  }

  /**
   * DELEGATED: Get semantic version color
   * @param {string} semver - 'major' | 'minor' | 'patch'
   * @returns {string} Hex color code
   */
  function getSemverColor(semver) {
    return UIColors.getSemverColor(semver);
  }

  /**
   * DELEGATED: Get test coverage color
   * @param {number} percentage - Coverage percentage
   * @returns {string} Hex color code
   */
  function getCoverageColor(percentage) {
    return UIColors.getCoverageColor(percentage);
  }

  // Public API (backward compatible with original UIRenderer)
  return {
    renderSecurityAudit,
    renderSecurityIssueCard,
    renderBreakingChangesPanel,
    renderBreakingChangeCard,
    renderTestCoveragePanel,
    renderCriticalIssuesPanel,
    renderAdvancedRiskometer,
    renderBreakdownDonut,
    escapeHTML,
    getSeverityColor,
    getImpactColor,
    getSemverColor,
    getCoverageColor
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIRenderer;
}
