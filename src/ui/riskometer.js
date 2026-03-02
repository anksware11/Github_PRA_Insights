// ============================================================================
// UI RISKOMETER MODULE
// Advanced riskometer rendering with gauge, breakdown, and trend
// ============================================================================

const UIRiskometer = (() => {
  /**
   * Render advanced riskometer with breakdown and trend
   * @param {object} breakdown - Risk breakdown from RiskEngine.calculateRiskBreakdown()
   * @param {object} trend - Trend data from RiskEngine.compareTrendToPreviousPR()
   * @param {number} totalRisk - Overall risk score (0-100)
   * @returns {HTMLElement} Advanced riskometer container
   */
  function renderAdvancedRiskometer(breakdown = {}, trend = {}, totalRisk = 0) {
    const container = document.createElement('div');
    container.className = 'prs-advanced-riskometer';

    // Main gauge
    const gaugeSection = document.createElement('div');
    gaugeSection.className = 'prs-riskometer-gauge-section';
    gaugeSection.innerHTML = `
      <div class="prs-main-gauge">
        <svg class="prs-risk-gauge" viewBox="0 0 120 120" width="120" height="120">
          <!-- Background circle -->
          <circle cx="60" cy="60" r="50" class="prs-gauge-bg"></circle>
          <!-- Progress circle -->
          <circle cx="60" cy="60" r="50" class="prs-gauge-fill"
            style="stroke-dashoffset: ${calculateStrokeDashOffset(totalRisk)}"></circle>
          <!-- Center text -->
          <text x="60" y="65" class="prs-gauge-text">${Math.round(totalRisk)}</text>
        </svg>
        <div class="prs-gauge-label">${getRiskLevelLabel(totalRisk)}</div>
      </div>
    `;
    container.appendChild(gaugeSection);

    // Breakdown chart
    const breakdownSection = document.createElement('div');
    breakdownSection.className = 'prs-breakdown-section';
    breakdownSection.innerHTML = `
      <div class="prs-breakdown-title">Risk Breakdown</div>
      <div class="prs-breakdown-chart">
        ${renderBreakdownDonut(breakdown)}
      </div>
      <div class="prs-breakdown-legend">
        <div class="prs-breakdown-item">
          <span class="prs-legend-color" style="background-color: #ff6b6b;"></span>
          <span>Security: ${breakdown.security || 0}%</span>
        </div>
        <div class="prs-breakdown-item">
          <span class="prs-legend-color" style="background-color: #ffa500;"></span>
          <span>Breaking: ${breakdown.breaking || 0}%</span>
        </div>
        <div class="prs-breakdown-item">
          <span class="prs-legend-color" style="background-color: #ffd700;"></span>
          <span>Quality: ${breakdown.quality || 0}%</span>
        </div>
      </div>
    `;
    container.appendChild(breakdownSection);

    // Trend indicator
    if (trend && trend.trendIndicator) {
      const trendSection = document.createElement('div');
      trendSection.className = 'prs-trend-section';
      trendSection.innerHTML = `
        <div class="prs-trend-label">vs Previous PR</div>
        <div class="prs-trend-indicator ${trend.trend}">
          ${trend.trendIndicator}
        </div>
        ${trend.previousScore !== undefined ? `
          <small>(Previous: ${Math.round(trend.previousScore)}, Now: ${Math.round(trend.currentScore)})</small>
        ` : ''}
      `;
      container.appendChild(trendSection);
    }

    return container;
  }

  /**
   * Render breakdown donut chart
   * @param {object} breakdown - Risk breakdown percentages
   * @returns {string} SVG HTML for donut chart
   */
  function renderBreakdownDonut(breakdown = {}) {
    const security = breakdown.security || 0;
    const breaking = breakdown.breaking || 0;
    const quality = breakdown.quality || 0;

    // Calculate arc paths
    const securityAngle = (security / 100) * 360;
    const breakingAngle = (breaking / 100) * 360;
    const qualityAngle = (quality / 100) * 360;

    return `
      <svg class="prs-donut-chart" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="40" class="prs-donut-segment prs-segment-security"
          style="stroke-dasharray: ${securityAngle} ${360 - securityAngle}; stroke-dashoffset: 0;"></circle>
        <circle cx="50" cy="50" r="40" class="prs-donut-segment prs-segment-breaking"
          style="stroke-dasharray: ${breakingAngle} ${360 - breakingAngle}; stroke-dashoffset: -${securityAngle};"></circle>
        <circle cx="50" cy="50" r="40" class="prs-donut-segment prs-segment-quality"
          style="stroke-dasharray: ${qualityAngle} ${360 - qualityAngle}; stroke-dashoffset: -${securityAngle + breakingAngle};"></circle>
        <circle cx="50" cy="50" r="27" class="prs-donut-hole"></circle>
      </svg>
    `;
  }

  /**
   * Calculate SVG stroke-dashoffset for circular progress
   * (delegated to HTMLUtils)
   * @param {number} percentage - Percentage (0-100)
   * @returns {number} Dash offset value
   */
  function calculateStrokeDashOffset(percentage) {
    return HTMLUtils.calculateStrokeDashOffset(percentage, 50); // radius = 50
  }

  /**
   * Get risk level label from score (delegated to UIColors)
   * @param {number} score - Risk score (0-100)
   * @returns {string} Risk label with emoji
   */
  function getRiskLevelLabel(score) {
    return UIColors.getRiskLevelLabel(score);
  }

  // Public API
  return {
    renderAdvancedRiskometer,
    renderBreakdownDonut,
    getRiskLevelLabel
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIRiskometer;
}
