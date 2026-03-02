// ============================================================================
// PR HISTORY MODULE
// Stores and manages last 50 analyzed PR summaries for PRO users
// No backend required - uses chrome.storage.local only
// Uses Storage utility for abstracted chrome.storage access
// ============================================================================

const PRHistory = (() => {
  const STORAGE_KEY = 'prAnalysisHistory';
  const MAX_HISTORY_ITEMS = 50;

  /**
   * Save PR analysis to history
   * @param {object} prData - PR metadata (title, description, files, repo)
   * @param {object} analysis - OpenAI analysis result
   * @returns {Promise<object>} Saved history item with ID
   */
  async function saveToHistory(prData = {}, analysis = {}) {
    try {
      // Create history entry
      const historyItem = {
        id: generateId(),
        timestamp: Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        pr: {
          title: prData.title || 'Unknown PR',
          repo: extractRepoFromUrl(window.location.href),
          url: window.location.href,
          description: prData.description?.substring(0, 100) || '',
          files: prData.filesChanged || 0,
          additions: prData.additions || 0,
          deletions: prData.deletions || 0
        },
        analysis: {
          riskScore: analysis.riskScore || 0,
          riskLevel: analysis.riskLevel || 'Unknown',
          summary: (analysis.summary || []).slice(0, 3), // Store first 3 points
          securityIssuesCount: (analysis.securityIssues || []).length,
          breakingChangesCount: (analysis.breakingChanges || []).length,
          testCoverage: analysis.testCoverage || '0%',
          commitQuality: analysis.commitMessageQuality || '-'
        }
      };

      // Get existing history using Storage utility
      let history = await Storage.getValue(STORAGE_KEY, []);

      // Add new item to beginning (most recent first)
      history.unshift(historyItem);

      // Keep only last 50 items (FIFO when exceeding limit)
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
      }

      // Save updated history using Storage utility
      await Storage.setValue(STORAGE_KEY, history);

      console.log(`[PRHistory] Saved PR to history. Total items: ${history.length}`);
      return historyItem;
    } catch (error) {
      console.error('[PRHistory] Error saving to history:', error);
      throw error;
    }
  }

  /**
   * Get all PR history (sorted by most recent first)
   * @returns {Promise<Array>} Array of history items
   */
  async function getHistory() {
    try {
      const history = await Storage.getValue(STORAGE_KEY, []);
      return history;
    } catch (error) {
      console.error('[PRHistory] Error retrieving history:', error);
      return [];
    }
  }

  /**
   * Get specific history item by ID
   * @param {string} id - History item ID
   * @returns {Promise<object|null>} History item or null if not found
   */
  async function getHistoryItem(id) {
    try {
      const history = await getHistory();
      return history.find(item => item.id === id) || null;
    } catch (error) {
      console.error('[PRHistory] Error retrieving history item:', error);
      return null;
    }
  }

  /**
   * Delete history item by ID
   * @param {string} id - History item ID
   * @returns {Promise<boolean>} Success status
   */
  async function deleteHistoryItem(id) {
    try {
      let history = await Storage.getValue(STORAGE_KEY, []);

      history = history.filter(item => item.id !== id);

      await Storage.setValue(STORAGE_KEY, history);
      console.log(`[PRHistory] Deleted history item: ${id}`);
      return true;
    } catch (error) {
      console.error('[PRHistory] Error deleting history item:', error);
      return false;
    }
  }

  /**
   * Clear all history
   * @returns {Promise<boolean>} Success status
   */
  async function clearHistory() {
    try {
      await Storage.remove([STORAGE_KEY]);
      console.log('[PRHistory] Cleared all history');
      return true;
    } catch (error) {
      console.error('[PRHistory] Error clearing history:', error);
      return false;
    }
  }

  /**
   * Generate structured report for export
   * @param {object} historyItem - History item from getHistory()
   * @returns {string} Formatted report text
   */
  function generateStructuredReport(historyItem) {
    if (!historyItem) return '';

    const { pr, analysis, date, time } = historyItem;

    const report = `
═══════════════════════════════════════════════════════════════════════════════
PR QUICK INSIGHT - ANALYSIS REPORT
═══════════════════════════════════════════════════════════════════════════════

REPORT DATE: ${date} ${time}

─── PR DETAILS ───────────────────────────────────────────────────────────────
Title:        ${pr.title}
Repository:   ${pr.repo}
URL:          ${pr.url}
Files Changed: ${pr.files}
Additions:     ${pr.additions}
Deletions:     ${pr.deletions}

─── ANALYSIS SUMMARY ──────────────────────────────────────────────────────────
Risk Score:       ${analysis.riskScore}/100
Risk Level:       ${analysis.riskLevel.toUpperCase()}
Test Coverage:    ${analysis.testCoverage}
Commit Quality:   ${analysis.commitQuality}

─── KEY FINDINGS ──────────────────────────────────────────────────────────────
${analysis.summary.map((point, idx) => `${idx + 1}. ${point}`).join('\n')}

─── SECURITY ASSESSMENT ───────────────────────────────────────────────────────
Security Issues:  ${analysis.securityIssuesCount} detected
Breaking Changes: ${analysis.breakingChangesCount} detected

═══════════════════════════════════════════════════════════════════════════════
Generated by PR Quick Insight - https://github.com/anthropics/pr-analyzer
═══════════════════════════════════════════════════════════════════════════════
    `.trim();

    return report;
  }

  /**
   * Generate JSON report for export
   * @param {object} historyItem - History item
   * @returns {string} JSON formatted report
   */
  function generateJsonReport(historyItem) {
    return JSON.stringify(historyItem, null, 2);
  }

  /**
   * Generate HTML report for print/PDF
   * @param {object} historyItem - History item
   * @returns {string} HTML formatted report
   */
  function generateHtmlReport(historyItem) {
    if (!historyItem) return '';

    const { pr, analysis, date, time } = historyItem;

    const riskColor = getRiskColor(analysis.riskScore);
    const riskLabel = getRiskLabel(analysis.riskScore);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${pr.title} - PR Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }

    .report-container {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #39FF14;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      margin: 0;
      color: #0f0f1a;
      font-size: 28px;
    }

    .header p {
      margin: 8px 0 0 0;
      color: #666;
      font-size: 14px;
    }

    .report-date {
      color: #999;
      font-size: 12px;
      margin-top: 10px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f0f1a;
      border-left: 4px solid #39FF14;
      padding-left: 12px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-content {
      background: #f9f9f9;
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 15px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      font-weight: 600;
      color: #666;
      min-width: 150px;
    }

    .detail-value {
      color: #0f0f1a;
      text-align: right;
      flex: 1;
    }

    .risk-score-box {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 15px;
      background: ${riskColor}15;
      border: 2px solid ${riskColor};
      border-radius: 6px;
      margin-bottom: 15px;
    }

    .risk-gauge {
      font-size: 48px;
      font-weight: 700;
      color: ${riskColor};
      min-width: 60px;
      text-align: center;
    }

    .risk-info h3 {
      margin: 0;
      color: ${riskColor};
      font-size: 18px;
    }

    .risk-info p {
      margin: 4px 0 0 0;
      color: #666;
      font-size: 13px;
    }

    .findings-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .findings-list li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
      color: #333;
    }

    .findings-list li:before {
      content: "›";
      position: absolute;
      left: 0;
      font-weight: 700;
      color: #39FF14;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .stat-card {
      background: white;
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #39FF14;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .footer {
      text-align: center;
      border-top: 1px solid #eee;
      padding-top: 20px;
      margin-top: 30px;
      font-size: 12px;
      color: #999;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      .report-container {
        padding: 0;
        box-shadow: none;
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <h1>📊 PR Analysis Report</h1>
      <p>${pr.title}</p>
      <p class="report-date">${date} ${time}</p>
    </div>

    <div class="section">
      <div class="section-title">Risk Assessment</div>
      <div class="section-content">
        <div class="risk-score-box">
          <div class="risk-gauge">${analysis.riskScore}</div>
          <div class="risk-info">
            <h3>${riskLabel}</h3>
            <p>Overall risk level for this PR</p>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">PR Details</div>
      <div class="section-content">
        <div class="detail-row">
          <div class="detail-label">Repository</div>
          <div class="detail-value">${pr.repo}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Files Changed</div>
          <div class="detail-value">${pr.files}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Additions</div>
          <div class="detail-value text-success" style="color: #28a745;">+${pr.additions}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Deletions</div>
          <div class="detail-value text-danger" style="color: #dc3545;">-${pr.deletions}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Quality Metrics</div>
      <div class="section-content">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${analysis.testCoverage}</div>
            <div class="stat-label">Test Coverage</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${analysis.commitQuality}</div>
            <div class="stat-label">Commit Quality</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${analysis.securityIssuesCount}</div>
            <div class="stat-label">Security Issues</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${analysis.breakingChangesCount}</div>
            <div class="stat-label">Breaking Changes</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Key Findings</div>
      <div class="section-content">
        <ul class="findings-list">
          ${analysis.summary.map(point => `<li>${point}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="footer">
      <p>Generated by PR Quick Insight</p>
      <p>Report URL: <a href="${pr.url}">${pr.url}</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Get statistics from history
   * @returns {Promise<object>} Statistics object
   */
  async function getStatistics() {
    try {
      const history = await getHistory();

      const stats = {
        totalAnalyzed: history.length,
        averageRisk: history.length > 0
          ? Math.round(history.reduce((sum, item) => sum + item.analysis.riskScore, 0) / history.length)
          : 0,
        highRiskCount: history.filter(item => item.analysis.riskScore >= 60).length,
        securityIssuesTotal: history.reduce((sum, item) => sum + item.analysis.securityIssuesCount, 0),
        breakingChangesTotal: history.reduce((sum, item) => sum + item.analysis.breakingChangesCount, 0),
        lastAnalyzed: history.length > 0 ? history[0].date : 'Never',
        uniqueRepos: new Set(history.map(item => item.pr.repo)).size
      };

      return stats;
    } catch (error) {
      console.error('[PRHistory] Error calculating statistics:', error);
      return {};
    }
  }

  /**
   * Generate unique ID for history item
   * @returns {string} Unique identifier
   */
  function generateId() {
    return `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract repository name from GitHub URL
   * @param {string} url - GitHub URL
   * @returns {string} Repository name
   */
  function extractRepoFromUrl(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\//);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return 'unknown';
  }

  /**
   * Get color for risk score
   * @param {number} score - Risk score (0-100)
   * @returns {string} Hex color
   */
  function getRiskColor(score) {
    if (score >= 80) return '#FF1744';  // Critical - red
    if (score >= 60) return '#FF6B6B';  // High - orange-red
    if (score >= 40) return '#FFD600';  // Medium - yellow
    if (score >= 20) return '#FFA500';  // Low - orange
    return '#39FF14'; // Minimal - green
  }

  /**
   * Get label for risk score
   * @param {number} score - Risk score
   * @returns {string} Risk label
   */
  function getRiskLabel(score) {
    if (score >= 80) return 'CRITICAL RISK';
    if (score >= 60) return 'HIGH RISK';
    if (score >= 40) return 'MEDIUM RISK';
    if (score >= 20) return 'LOW RISK';
    return 'MINIMAL RISK';
  }

  // Public API
  return {
    saveToHistory,
    getHistory,
    getHistoryItem,
    deleteHistoryItem,
    clearHistory,
    generateStructuredReport,
    generateJsonReport,
    generateHtmlReport,
    getStatistics
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRHistory;
}
