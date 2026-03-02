// ============================================================================
// COLOR PALETTE & UTILITIES
// Centralized color system for entire extension
// Single source of truth for all colors used in UI rendering
// ============================================================================

const UIColors = (() => {
  // ──────────────────────────────────────────────────────────────────────────
  // CORE COLOR PALETTE
  // ──────────────────────────────────────────────────────────────────────────

  const PALETTE = {
    // Risk/Severity levels
    CRITICAL: '#ff4444',      // Red - Highest risk
    HIGH: '#ff6b6b',          // Orange-red - High risk
    MEDIUM: '#ffa500',        // Orange - Medium risk
    LOW: '#ffb347',           // Light orange - Low risk
    MINIMAL: '#39FF14',       // Green - No risk

    // Semantic version bumps
    MAJOR: '#ff4444',         // Red - Breaking change
    MINOR: '#ffa500',         // Orange - New feature
    PATCH: '#90ee90',         // Light green - Bug fix

    // Coverage levels
    EXCELLENT: '#00cc00',     // Bright green - 90%+
    GOOD: '#90ee90',          // Light green - 75-89%
    FAIR: '#ffa500',          // Orange - 60-74%
    POOR: '#ff6b6b',          // Red - 40-59%
    CRITICAL_COVERAGE: '#ff4444' // Dark red - <40%
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SEVERITY MAPPINGS
  // ──────────────────────────────────────────────────────────────────────────

  const SEVERITY_MAP = {
    'Critical': PALETTE.CRITICAL,
    'High': PALETTE.HIGH,
    'Medium': PALETTE.MEDIUM,
    'Low': PALETTE.LOW
  };

  // ──────────────────────────────────────────────────────────────────────────
  // IMPACT MAPPINGS
  // ──────────────────────────────────────────────────────────────────────────

  const IMPACT_MAP = {
    'critical': PALETTE.CRITICAL,
    'high': PALETTE.HIGH,
    'medium': PALETTE.MEDIUM,
    'low': PALETTE.LOW
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SEMVER MAPPINGS
  // ──────────────────────────────────────────────────────────────────────────

  const SEMVER_MAP = {
    'major': PALETTE.MAJOR,
    'minor': PALETTE.MINOR,
    'patch': PALETTE.PATCH
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API - Color Getters
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get severity color by severity level
   * @param {string} severity - 'Critical', 'High', 'Medium', 'Low'
   * @returns {string} Hex color code
   */
  function getSeverityColor(severity) {
    return SEVERITY_MAP[severity] || PALETTE.LOW;
  }

  /**
   * Get impact color by impact level
   * @param {string} impact - 'critical', 'high', 'medium', 'low'
   * @returns {string} Hex color code
   */
  function getImpactColor(impact) {
    return IMPACT_MAP[impact] || PALETTE.LOW;
  }

  /**
   * Get semantic version color by semver bump
   * @param {string} semver - 'major', 'minor', 'patch'
   * @returns {string} Hex color code
   */
  function getSemverColor(semver) {
    return SEMVER_MAP[semver] || PALETTE.LOW;
  }

  /**
   * Get risk level color by score
   * @param {number} score - Risk score (0-100)
   * @returns {string} Hex color code
   */
  function getRiskColor(score) {
    if (score >= 80) return PALETTE.CRITICAL;      // Critical - red
    if (score >= 60) return PALETTE.HIGH;          // High - orange-red
    if (score >= 40) return PALETTE.MEDIUM;        // Medium - orange
    if (score >= 20) return PALETTE.LOW;           // Low - light orange
    return PALETTE.MINIMAL;                        // Minimal - green
  }

  /**
   * Get coverage quality color by percentage
   * @param {number} percentage - Coverage percentage (0-100)
   * @returns {string} Hex color code
   */
  function getCoverageColor(percentage) {
    if (percentage >= 90) return PALETTE.EXCELLENT;
    if (percentage >= 75) return PALETTE.GOOD;
    if (percentage >= 60) return PALETTE.FAIR;
    if (percentage >= 40) return PALETTE.POOR;
    return PALETTE.CRITICAL_COVERAGE;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API - Label Getters
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get risk level label from score with emoji
   * @param {number} score - Risk score (0-100)
   * @returns {string} Risk label with emoji
   */
  function getRiskLevelLabel(score) {
    if (score >= 80) return '🔴 Critical';
    if (score >= 60) return '🟠 High';
    if (score >= 40) return '🟡 Medium';
    if (score >= 20) return '🟢 Low';
    return '✅ Minimal';
  }

  /**
   * Get detailed risk label from score
   * @param {number} score - Risk score (0-100)
   * @returns {string} Detailed risk label
   */
  function getRiskLevelDetail(score) {
    if (score >= 80) return 'CRITICAL RISK';
    if (score >= 60) return 'HIGH RISK';
    if (score >= 40) return 'MEDIUM RISK';
    if (score >= 20) return 'LOW RISK';
    return 'MINIMAL RISK';
  }

  /**
   * Get coverage quality label from percentage
   * @param {number} percentage - Coverage percentage (0-100)
   * @returns {string} Coverage label
   */
  function getCoverageLabel(percentage) {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 75) return 'Good';
    if (percentage >= 60) return 'Fair';
    if (percentage >= 40) return 'Poor';
    return 'Critical';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API - Styling Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create inline style for colored element with opacity
   * @param {string} color - Hex color code
   * @param {number} opacity - Opacity percentage (20, 40, etc.)
   * @returns {string} Inline style string
   */
  function createColorStyle(color, opacity = 20) {
    return `background-color: ${color}${opacity}; border-color: ${color}; color: ${color}`;
  }

  /**
   * Create light background style for colored badge
   * @param {string} color - Hex color code
   * @returns {string} Inline style string
   */
  function createBadgeStyle(color) {
    return createColorStyle(color, 20);
  }

  /**
   * Create background gradient style for colored section
   * @param {string} color - Hex color code
   * @returns {string} Inline style string
   */
  function createSectionStyle(color) {
    return createColorStyle(color, 15);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API - Batch Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all palette colors
   * @returns {object} Color palette object
   */
  function getPalette() {
    return { ...PALETTE };
  }

  /**
   * Check if color is dark (needs light text)
   * @param {string} hexColor - Hex color code
   * @returns {boolean} True if color is dark
   */
  function isDarkColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Public API
  return {
    // Color palette
    PALETTE,
    getPalette,

    // Color getters
    getSeverityColor,
    getImpactColor,
    getSemverColor,
    getRiskColor,
    getCoverageColor,

    // Label getters
    getRiskLevelLabel,
    getRiskLevelDetail,
    getCoverageLabel,

    // Styling helpers
    createColorStyle,
    createBadgeStyle,
    createSectionStyle,
    isDarkColor
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIColors;
}
