// ============================================================================
// UI PANELS MODULE
// Rendering functions for major content panels
// Includes: Security Audit, Breaking Changes, Test Coverage, Critical Issues
// ============================================================================

const UIPanels = (() => {
  /**
   * Render full security audit section
   * @param {Array} securityIssues - Array of issues from RiskEngine.calculateSecurityRisk()
   * @returns {HTMLElement} Container with security audit
   */
  function renderSecurityAudit(securityIssues = []) {
    const container = document.createElement('div');
    container.className = 'prs-pro-security-audit';

    const header = document.createElement('div');
    header.className = 'prs-audit-header';
    header.innerHTML = `
      <h3>🔐 Full Security Audit</h3>
      <span class="prs-issue-count">${securityIssues.length} issues detected</span>
    `;
    container.appendChild(header);

    if (securityIssues.length === 0) {
      const noIssues = document.createElement('div');
      noIssues.className = 'prs-no-issues';
      noIssues.innerHTML = '<p>✓ No security issues detected</p>';
      container.appendChild(noIssues);
      return container;
    }

    const issuesList = document.createElement('div');
    issuesList.className = 'prs-security-issues-list';

    securityIssues.forEach((issue, index) => {
      const issueCard = renderSecurityIssueCard(issue, index);
      issuesList.appendChild(issueCard);
    });

    container.appendChild(issuesList);
    return container;
  }

  /**
   * Render individual security issue card
   * @param {object} issue - Issue object with severity, CWE, fix, etc.
   * @param {number} index - Issue index for numbering
   * @returns {HTMLElement} Security issue card
   */
  function renderSecurityIssueCard(issue, index) {
    const card = document.createElement('div');
    card.className = `prs-security-issue-card prs-severity-${issue.severity.toLowerCase()}`;

    const severityBadge = UIBadges.renderSeverityBadge(issue.severity);
    const severityColor = UIColors.getSeverityColor(issue.severity);

    card.innerHTML = `
      <div class="prs-issue-header">
        <div class="prs-issue-number">${index + 1}</div>
        <span class="prs-severity-badge prs-severity-${issue.severity.toLowerCase()}" style="background-color: ${severityColor}20; border-color: ${severityColor}; color: ${severityColor}">
          ${issue.severity}
        </span>
        ${issue.cweTag ? `<span class="prs-cwe-tag">${issue.cweTag}</span>` : ''}
      </div>
      <div class="prs-issue-content">
        <p class="prs-issue-description">${escapeHTML(issue.issue)}</p>
      </div>
      <div class="prs-issue-fix">
        <strong>Suggested Fix:</strong>
        <p>${escapeHTML(issue.suggestedFix)}</p>
      </div>
      ${issue.codeSnippet ? `
        <div class="prs-code-snippet">
          <pre><code>${escapeHTML(issue.codeSnippet)}</code></pre>
        </div>
      ` : ''}
    `;

    return card;
  }

  /**
   * Render breaking changes panel
   * @param {Array} breakingChanges - Array from RiskEngine.detectBreakingChanges()
   * @returns {HTMLElement} Breaking changes panel
   */
  function renderBreakingChangesPanel(breakingChanges = []) {
    const container = document.createElement('div');
    container.className = 'prs-breaking-changes-panel';

    const header = document.createElement('div');
    header.className = 'prs-breaking-header';
    header.innerHTML = `
      <h3>⚠️ Breaking Changes Detected</h3>
      <span class="prs-breaking-count">${breakingChanges.length} change${breakingChanges.length !== 1 ? 's' : ''}</span>
    `;
    container.appendChild(header);

    if (breakingChanges.length === 0) {
      const noChanges = document.createElement('div');
      noChanges.className = 'prs-no-breaking-changes';
      noChanges.innerHTML = '<p>✓ No breaking changes detected</p>';
      container.appendChild(noChanges);
      return container;
    }

    const changesList = document.createElement('div');
    changesList.className = 'prs-breaking-changes-list';

    breakingChanges.forEach((change, index) => {
      const changeCard = renderBreakingChangeCard(change, index);
      changesList.appendChild(changeCard);
    });

    container.appendChild(changesList);
    return container;
  }

  /**
   * Render individual breaking change card
   * @param {object} change - Change object with type, semver, impact
   * @param {number} index - Change index
   * @returns {HTMLElement} Breaking change card
   */
  function renderBreakingChangeCard(change, index) {
    const card = document.createElement('div');
    card.className = `prs-breaking-change-card prs-impact-${change.impact.toLowerCase()}`;

    const impactColor = UIColors.getImpactColor(change.impact);
    const semverColor = UIColors.getSemverColor(change.semverBump);

    card.innerHTML = `
      <div class="prs-change-header">
        <div class="prs-change-number">${index + 1}</div>
        <span class="prs-semver-badge" style="background-color: ${semverColor}40; border-color: ${semverColor}; color: ${semverColor}">
          ${change.semverBump.toUpperCase()}
        </span>
        <span class="prs-impact-badge" style="background-color: ${impactColor}20; border-color: ${impactColor}; color: ${impactColor}">
          ${change.impact}
        </span>
      </div>
      <div class="prs-change-content">
        <p class="prs-change-description">${escapeHTML(change.change)}</p>
        <small class="prs-change-type">Type: ${change.type.replace('-', ' ').toUpperCase()}</small>
      </div>
      <div class="prs-migration-hint">
        <strong>Migration Path:</strong>
        <p>${getMigrationHint(change.type, change.semverBump)}</p>
      </div>
    `;

    return card;
  }

  /**
   * Render test coverage analysis panel
   * @param {object} coverage - Coverage object from RiskEngine.analyzeTestCoverage()
   * @returns {HTMLElement} Test coverage panel
   */
  function renderTestCoveragePanel(coverage = {}) {
    const container = document.createElement('div');
    container.className = 'prs-test-coverage-panel';

    const coveragePercentage = coverage.coverage || 0;
    const coverageColor = UIColors.getCoverageColor(coveragePercentage);

    const header = document.createElement('div');
    header.className = 'prs-coverage-header';
    header.innerHTML = `
      <h3>📊 Test Coverage Analysis</h3>
      <div class="prs-coverage-badge" style="background-color: ${coverageColor}40; color: ${coverageColor}; border-color: ${coverageColor}">
        ${Math.round(coveragePercentage)}%
      </div>
    `;
    container.appendChild(header);

    const recommendation = document.createElement('div');
    recommendation.className = 'prs-coverage-recommendation';
    recommendation.innerHTML = `<p>${coverage.recommendation || 'Test coverage recommendation'}</p>`;
    container.appendChild(recommendation);

    if (coverage.uncoveredBlocks && coverage.uncoveredBlocks.length > 0) {
      const uncoveredSection = document.createElement('div');
      uncoveredSection.className = 'prs-uncovered-blocks';
      uncoveredSection.innerHTML = `
        <strong>Uncovered Logic Blocks:</strong>
        <ul>
          ${coverage.uncoveredBlocks.map(block => `<li>${escapeHTML(block)}</li>`).join('')}
        </ul>
      `;
      container.appendChild(uncoveredSection);
    }

    if (coverage.testSkeleton) {
      const skeletonSection = document.createElement('div');
      skeletonSection.className = 'prs-test-skeleton';
      skeletonSection.innerHTML = `
        <strong>Suggested Test Template:</strong>
        <pre><code>${escapeHTML(coverage.testSkeleton)}</code></pre>
        <button class="prs-copy-btn" data-copy="${coverage.testSkeleton}">Copy Test Template</button>
      `;
      container.appendChild(skeletonSection);
    }

    return container;
  }

  /**
   * Render critical issues panel (top 5-10 issues)
   * @param {Array} allIssues - All issues from security audit
   * @param {number} limit - Max issues to show (default 5)
   * @returns {HTMLElement} Critical issues panel
   */
  function renderCriticalIssuesPanel(allIssues = [], limit = 5) {
    const container = document.createElement('div');
    container.className = 'prs-critical-issues-panel';

    // Sort by risk score and limit
    const criticalIssues = allIssues
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);

    const header = document.createElement('div');
    header.className = 'prs-critical-header';
    header.innerHTML = `
      <h3>🚨 Top ${Math.min(limit, criticalIssues.length)} Critical Issues</h3>
      ${allIssues.length > limit ? `<small>${allIssues.length} total issues detected</small>` : ''}
    `;
    container.appendChild(header);

    if (criticalIssues.length === 0) {
      const noIssues = document.createElement('div');
      noIssues.className = 'prs-no-critical-issues';
      noIssues.innerHTML = '<p>✓ No critical issues in top tier</p>';
      container.appendChild(noIssues);
      return container;
    }

    const issuesList = document.createElement('ol');
    issuesList.className = 'prs-critical-issues-list';

    criticalIssues.forEach((issue) => {
      const li = document.createElement('li');
      li.className = `prs-critical-issue-item prs-severity-${issue.severity.toLowerCase()}`;
      li.innerHTML = `
        <div class="prs-critical-issue-title">${escapeHTML(issue.issue)}</div>
        <div class="prs-critical-issue-meta">
          <span class="prs-severity-badge" style="color: ${UIBadges.getSeverityColor(issue.severity)}">
            ${issue.severity}
          </span>
          ${issue.cweTag ? `<span class="prs-cwe-tag">${issue.cweTag}</span>` : ''}
        </div>
      `;
      issuesList.appendChild(li);
    });

    container.appendChild(issuesList);
    return container;
  }

  /**
   * Get migration hint for breaking changes (delegated to HTMLUtils)
   * @param {string} changeType - Type of change
   * @param {string} semver - Semantic version bump
   * @returns {string} Migration guidance
   */
  function getMigrationHint(changeType, semver) {
    return HTMLUtils.getMigrationHint(changeType, semver);
  }

  /**
   * Escape HTML special characters (delegated to HTMLUtils)
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHTML(text) {
    return HTMLUtils.escapeHTML(text);
  }

  // Public API
  return {
    renderSecurityAudit,
    renderSecurityIssueCard,
    renderBreakingChangesPanel,
    renderBreakingChangeCard,
    renderTestCoveragePanel,
    renderCriticalIssuesPanel
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIPanels;
}
