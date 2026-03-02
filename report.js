// ============================================================================
// REPORT.JS  –  Full PR Report page logic
// Loaded by report.html (standalone extension page, no content-script modules)
// Architecture: static snapshot — reads storage ONCE, no onChanged listeners
// ============================================================================

(async function () {

  const UPGRADE_CHECKOUT_URL = 'https://prorisk.com/upgrade';

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  function formatDate(ts) {
    if (!ts) return 'Unknown';
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  function hide(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function append(id, html) {
    const el = document.getElementById(id);
    if (el) el.insertAdjacentHTML('beforeend', html);
  }

  async function getUpgradeCheckoutUrl() {
    try {
      const { appUserId } = await chrome.storage.local.get(['appUserId']);
      return appendCheckoutUserId(UPGRADE_CHECKOUT_URL, appUserId);
    } catch (error) {
      console.warn('[Report] Failed to load app user ID for checkout:', error);
      return UPGRADE_CHECKOUT_URL;
    }
  }

  function appendCheckoutUserId(baseUrl, appUserId) {
    try {
      const url = new URL(baseUrl);
      if (typeof appUserId === 'string' && appUserId.trim()) {
        url.searchParams.set('checkout[custom][user_id]', appUserId.trim());
      }
      return url.toString();
    } catch {
      return baseUrl;
    }
  }

  window.openUpgradeCheckout = async function openUpgradeCheckout() {
    const checkoutUrl = await getUpgradeCheckoutUrl();
    window.open(checkoutUrl, '_blank');
  };

  // ──────────────────────────────────────────────────────────────────────────
  // LICENSE CHECK  (inline — no dependency on licenseValidator module)
  // ──────────────────────────────────────────────────────────────────────────

  async function checkIsProUser() {
    try {
      const stored = await chrome.storage.local.get(['proLicense']);
      const raw = stored.proLicense;
      if (!raw || typeof raw !== 'string') return false;

      // Expect: PRORISK|email|lifetime|signature          (lifetime license)
      //    or:  PRORISK|email|expiryTimestamp|signature   (time-limited)
      const parts = raw.split('|');
      if (parts.length !== 4) return false;
      if (parts[0] !== 'PRORISK') return false;

      const validity = parts[2];

      // Lifetime license — valid indefinitely
      if (validity === 'lifetime') return true;

      // Time-limited license — check expiry
      const expiry = parseInt(validity, 10);
      if (isNaN(expiry)) return false;
      if (expiry < Date.now()) return false;

      return true;
    } catch (e) {
      console.warn('[Report] License check failed, defaulting FREE:', e);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LOAD DATA
  // ──────────────────────────────────────────────────────────────────────────

  async function loadReportData() {
    const stored = await chrome.storage.local.get(['latestReport']);
    return stored.latestReport || null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UPGRADE BANNER
  // ──────────────────────────────────────────────────────────────────────────

  function renderUpgradeBanner({ visibleCount, totalCount }) {
    const hidden = Math.max(0, totalCount - visibleCount);
    return `
      <div class="upgrade-banner">
        <div class="upgrade-banner-headline">🔒 ${hidden} more file${hidden !== 1 ? 's' : ''} locked</div>
        <div class="upgrade-banner-sub">Upgrade to Pro to see all ${totalCount} flagged files with full issue details.</div>
        <ul class="upgrade-benefits">
          <li>All file-level suggestions (unlimited)</li>
          <li>Security heatmap with CWE tags</li>
          <li>Breaking change deep analysis</li>
          <li>Test coverage gap report</li>
          <li>Export to PDF / Markdown</li>
        </ul>
        <button class="upgrade-cta-btn" onclick="window.openUpgradeCheckout()">
          🚀 Unlock Pro – Lifetime Access
        </button>
      </div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRO GATE PLACEHOLDER
  // ──────────────────────────────────────────────────────────────────────────

  function renderProGate(title, description) {
    return `
      <div class="pro-gate">
        <div class="pro-gate-left">
          <span class="pro-gate-title">${escapeHTML(title)}</span>
          <span class="pro-gate-desc">${escapeHTML(description)}</span>
        </div>
        <span class="pro-gate-lock">🔒 PRO</span>
      </div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SNAPSHOT BAR
  // ──────────────────────────────────────────────────────────────────────────

  function renderSnapshotBar(report) {
    const prUrl  = report.prUrl  || '#';
    const repo   = report.repo   || 'unknown/repo';
    const title  = report.prTitle || 'Untitled PR';
    const ts     = formatDate(report.generatedAt);
    const hash   = report.commitHash ? report.commitHash.slice(0, 7) : null;

    setHTML('snapshot-bar', `
      <span class="snapshot-meta-item">
        <span class="snapshot-meta-label">REPO</span>
        <a href="${escapeHTML(prUrl)}" target="_blank">${escapeHTML(repo)}</a>
      </span>
      <span class="snapshot-meta-item">
        <span class="snapshot-meta-label">PR</span>
        <a href="${escapeHTML(prUrl)}" target="_blank">${escapeHTML(title)}</a>
      </span>
      <span class="snapshot-meta-item">
        <span class="snapshot-meta-label">CAPTURED</span>
        ${escapeHTML(ts)}
      </span>
      ${hash ? `
      <span class="snapshot-meta-item">
        <span class="snapshot-meta-label">COMMIT</span>
        <span style="font-family:monospace">${escapeHTML(hash)}</span>
      </span>` : ''}
      <button class="reopen-btn" onclick="window.close()">✕ Close</button>
    `);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. RISK OVERVIEW
  // ──────────────────────────────────────────────────────────────────────────

  function renderRiskOverview(report) {
    const score = report.riskScore ?? 0;
    const level = (report.riskLevel || 'Low').toLowerCase();

    const scoreColor = level === 'high'   ? 'color-high'
                     : level === 'medium' ? 'color-medium'
                     :                      'color-low';

    const chipBg = level === 'high'   ? 'bg-high'
                 : level === 'medium' ? 'bg-medium'
                 :                      'bg-low';

    // Derive merge confidence from score  (invert: high risk → low confidence)
    const confidence = score >= 66 ? 'LOW' : score >= 26 ? 'MEDIUM' : 'HIGH';
    const confColor  = confidence === 'HIGH'   ? 'color-low'
                     : confidence === 'MEDIUM' ? 'color-medium'
                     :                           'color-high';

    // Release risk label
    const releaseRisk = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
    const releaseColor = releaseRisk === 'CRITICAL' || releaseRisk === 'HIGH' ? 'color-high'
                       : releaseRisk === 'MEDIUM' ? 'color-medium' : 'color-low';

    setHTML('risk-grid', `
      <div class="risk-card">
        <div class="risk-card-label">RISK SCORE</div>
        <div class="risk-score-value ${scoreColor}">${score}</div>
        <span class="risk-level-chip ${chipBg}">${escapeHTML(report.riskLevel || 'Low').toUpperCase()}</span>
      </div>
      <div class="risk-card">
        <div class="risk-card-label">MERGE CONFIDENCE</div>
        <div class="confidence-value ${confColor}">${confidence}</div>
        <div class="confidence-desc">${
          confidence === 'HIGH'   ? 'Safe to merge with review' :
          confidence === 'MEDIUM' ? 'Review recommended' :
                                    'Significant review needed'
        }</div>
      </div>
      <div class="risk-card">
        <div class="risk-card-label">RELEASE RISK</div>
        <div class="release-value ${releaseColor}">${releaseRisk}</div>
        <div class="release-desc">${
          releaseRisk === 'CRITICAL' ? 'Block release, fix critical issues' :
          releaseRisk === 'HIGH'     ? 'Address issues before releasing' :
          releaseRisk === 'MEDIUM'   ? 'Monitor after release' :
                                       'Low risk — proceed normally'
        }</div>
      </div>
    `);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SUMMARY STATS BAR
  // ──────────────────────────────────────────────────────────────────────────

  function renderSummaryStats(report) {
    const files    = report.filesChanged     ?? (report.files || []).length ?? 0;
    const security = (report.securityIssues  || []).length;
    const breaking = (report.breakingChanges || []).length;
    const total    = report.totalSuggestions ?? 0;

    setHTML('stats-bar', `
      <div class="stat-card">
        <div class="stat-number">${files}</div>
        <div class="stat-label">FILES CHANGED</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${security}</div>
        <div class="stat-label">SECURITY ISSUES</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${breaking}</div>
        <div class="stat-label">BREAKING CHANGES</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">TOTAL SUGGESTIONS</div>
      </div>
    `);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PRIORITY SUGGESTIONS  (always visible — free + pro)
  // ──────────────────────────────────────────────────────────────────────────

  function renderPrioritySuggestions(report) {
    const items = report.topIssues || [];
    if (items.length === 0) {
      setHTML('priority-list', '<p style="color:var(--text-muted);font-size:12px;">No priority issues identified.</p>');
      return;
    }

    // Assign severity from position (first items are highest priority)
    const severities = ['Critical', 'High', 'High', 'Medium', 'Medium'];
    const html = items.slice(0, 5).map((text, i) => {
      const sev = severities[i] || 'Low';
      return `
        <div class="suggestion-item">
          <span class="sev-badge sev-${escapeHTML(sev)}">${escapeHTML(sev)}</span>
          <span class="suggestion-text">${escapeHTML(text)}</span>
        </div>`;
    }).join('');

    setHTML('priority-list', html);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. FILE SUGGESTIONS  (gated: FREE → 5 files + banner; PRO → all)
  // ──────────────────────────────────────────────────────────────────────────

  function renderIssueBlock(issue) {
    // Support both old string format and new object format
    if (typeof issue === 'string') {
      return `
        <div class="issue-block">
          <div class="issue-description">${escapeHTML(issue)}</div>
        </div>`;
    }

    const desc       = escapeHTML(issue.description || '');
    const suggestion = escapeHTML(issue.suggestion   || '');
    const before     = issue.codeBefore || '';
    const after      = issue.codeAfter  || '';

    const codeBlocks = (before || after) ? `
      <div class="code-diff">
        ${before ? `
        <div class="code-diff-block code-diff-before">
          <div class="code-diff-label">Before</div>
          <pre class="code-pre"><code>${escapeHTML(before)}</code></pre>
        </div>` : ''}
        ${after ? `
        <div class="code-diff-block code-diff-after">
          <div class="code-diff-label">After</div>
          <pre class="code-pre"><code>${escapeHTML(after)}</code></pre>
        </div>` : ''}
      </div>` : '';

    return `
      <div class="issue-block">
        ${desc       ? `<div class="issue-description">${desc}</div>` : ''}
        ${suggestion ? `<div class="issue-suggestion">↳ ${suggestion}</div>` : ''}
        ${codeBlocks}
      </div>`;
  }

  function renderFileSuggestions(report, isProUser) {
    const all = report.fileSuggestions || [];
    const totalCount = all.length;

    if (totalCount === 0) {
      setHTML('file-list', '<p style="color:var(--text-muted);font-size:12px;">No file-level suggestions available.</p>');
      return;
    }

    const FREE_LIMIT  = 5;
    const visible     = isProUser ? all : all.slice(0, FREE_LIMIT);
    const lockedCount = isProUser ? 0 : Math.max(0, totalCount - FREE_LIMIT);

    const fileRows = visible.map(f => {
      const sev = f.severity || 'Medium';
      const issueBlocks = (f.issues || []).map(renderIssueBlock).join('');

      return `
        <div class="file-row">
          <div class="file-row-header">
            <span class="file-name">${escapeHTML(f.file || 'unknown')}</span>
            <span class="sev-badge sev-${escapeHTML(sev)}">${escapeHTML(sev)}</span>
          </div>
          <div class="file-issue-list">${issueBlocks}</div>
        </div>`;
    }).join('');

    // Blurred placeholder rows for FREE users
    let lockedRows = '';
    if (!isProUser && lockedCount > 0) {
      for (let i = 0; i < Math.min(lockedCount, 3); i++) {
        lockedRows += `
          <div class="file-row locked-row">
            <div class="file-row-header">
              <span class="file-name" style="filter:blur(6px);">████████████/█████████.js</span>
              <span class="locked-row-label">🔒 LOCKED</span>
            </div>
          </div>`;
      }
    }

    const banner = (!isProUser && lockedCount > 0)
      ? renderUpgradeBanner({ visibleCount: FREE_LIMIT, totalCount })
      : '';

    setHTML('file-list', fileRows + lockedRows + banner);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. SECURITY HEATMAP  (PRO only)
  // ──────────────────────────────────────────────────────────────────────────

  function renderSecurityHeatmap(report, isProUser) {
    const container = document.getElementById('security-heatmap-section');
    if (!container) return;

    if (!isProUser) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">🛡️ SECURITY HEATMAP</div>
          ${renderProGate('Security Heatmap', 'File-level vulnerability map with CWE tags')}
          ${renderUpgradeBanner({ visibleCount: 0, totalCount: 1 })}
        </div>`;
      return;
    }

    const issues = report.enhancedSecurityIssues || report.securityIssues || [];
    if (issues.length === 0) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">🛡️ SECURITY HEATMAP</div>
          <p style="color:var(--text-muted);font-size:12px;">No security issues detected.</p>
        </div>`;
      return;
    }

    const rows = issues.map(issue => {
      // issueObj may be a string or { file, type, description, severity, cwe }
      if (typeof issue === 'string') {
        return `
          <tr>
            <td>—</td>
            <td><span class="sev-badge sev-Medium">Medium</span></td>
            <td>${escapeHTML(issue)}</td>
            <td>—</td>
          </tr>`;
      }
      const cweTag = issue.cwe
        ? `<span class="cwe-tag">${escapeHTML(issue.cwe)}</span>` : '—';
      const sev = issue.severity || 'Medium';
      return `
        <tr>
          <td style="font-family:monospace;font-size:11px;color:var(--neon-cyan)">${escapeHTML(issue.file || '—')}</td>
          <td><span class="sev-badge sev-${escapeHTML(sev)}">${escapeHTML(sev)}</span></td>
          <td>${escapeHTML(issue.description || issue.type || String(issue))}</td>
          <td>${cweTag}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="section">
        <div class="section-title">🛡️ SECURITY HEATMAP</div>
        <table class="heatmap-table">
          <thead>
            <tr>
              <th>FILE</th>
              <th>SEV</th>
              <th>FINDING</th>
              <th>CWE</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. BREAKING CHANGES  (PRO only)
  // ──────────────────────────────────────────────────────────────────────────

  function renderBreakingChanges(report, isProUser) {
    const container = document.getElementById('breaking-section');
    if (!container) return;

    if (!isProUser) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">⚡ BREAKING CHANGES</div>
          ${renderProGate('Breaking Change Analysis', 'Semver impact, API surface changes, migration notes')}
        </div>`;
      return;
    }

    const changes = report.breakingChanges || [];
    if (changes.length === 0) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">⚡ BREAKING CHANGES</div>
          <p style="color:var(--text-muted);font-size:12px;">✓ No breaking changes detected.</p>
        </div>`;
      return;
    }

    const items = changes.map(c => {
      if (typeof c === 'string') {
        return `
          <div class="breaking-item">
            <div class="breaking-item-label">CHANGE</div>
            <div class="breaking-item-text">${escapeHTML(c)}</div>
          </div>`;
      }
      const cls = c.impact === 'major' ? 'major' : c.impact === 'minor' ? 'minor' : '';
      return `
        <div class="breaking-item ${cls}">
          <div class="breaking-item-label">${escapeHTML((c.impact || 'CHANGE').toUpperCase())}</div>
          <div class="breaking-item-text">${escapeHTML(c.description || String(c))}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="section">
        <div class="section-title">⚡ BREAKING CHANGES</div>
        ${items}
      </div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. TEST COVERAGE  (PRO only)
  // ──────────────────────────────────────────────────────────────────────────

  function renderTestCoverage(report, isProUser) {
    const container = document.getElementById('test-coverage-section');
    if (!container) return;

    if (!isProUser) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">🧪 TEST COVERAGE</div>
          ${renderProGate('Test Coverage Analysis', 'Coverage gaps, missing test files, recommendations')}
        </div>`;
      return;
    }

    const tc = report.testCoverage;
    if (!tc) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">🧪 TEST COVERAGE</div>
          <p style="color:var(--text-muted);font-size:12px;">No test coverage data available.</p>
        </div>`;
      return;
    }

    // tc may be a string label or an object
    const label  = typeof tc === 'string' ? tc : (tc.level || tc.label || 'Unknown');
    const cls    = `coverage-${label}`;
    const detail = typeof tc === 'object' && tc.detail ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:10px;">${escapeHTML(tc.detail)}</p>` : '';
    const recs   = (typeof tc === 'object' && Array.isArray(tc.recommendations))
      ? tc.recommendations.map(r => `<li>${escapeHTML(r)}</li>`).join('') : '';

    container.innerHTML = `
      <div class="section">
        <div class="section-title">🧪 TEST COVERAGE</div>
        <span class="coverage-badge ${escapeHTML(cls)}">${escapeHTML(label)}</span>
        ${detail}
        ${recs ? `<ul class="file-issues" style="margin-top:10px;">${recs}</ul>` : ''}
      </div>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. EXPORT ACTIONS  (PRO only)
  // ──────────────────────────────────────────────────────────────────────────

  function renderExportActions(report, isProUser) {
    const container = document.getElementById('export-section');
    if (!container) return;

    if (!isProUser) {
      container.innerHTML = `
        <div class="section">
          <div class="section-title">📤 EXPORT REPORT</div>
          ${renderProGate('Export Report', 'PDF, Markdown, and JSON export options')}
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="section">
        <div class="section-title">📤 EXPORT REPORT</div>
        <div class="export-bar">
          <button class="export-btn" id="export-pdf-btn">📄 Export PDF</button>
          <button class="export-btn" id="export-md-btn">📝 Export Markdown</button>
          <button class="export-btn" id="export-json-btn">{ } Copy JSON</button>
        </div>
      </div>`;

    // PDF
    document.getElementById('export-pdf-btn').addEventListener('click', () => {
      window.print();
    });

    // Markdown
    document.getElementById('export-md-btn').addEventListener('click', () => {
      const md = buildMarkdown(report);
      navigator.clipboard.writeText(md).then(() => {
        const btn = document.getElementById('export-md-btn');
        if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '📝 Export Markdown'; }, 2000); }
      });
    });

    // JSON
    document.getElementById('export-json-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
        const btn = document.getElementById('export-json-btn');
        if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '{ } Copy JSON'; }, 2000); }
      });
    });
  }

  function buildMarkdown(report) {
    const lines = [];
    lines.push(`# PR Audit Report`);
    lines.push(`**PR:** [${report.prTitle || 'Untitled'}](${report.prUrl || '#'})`);
    lines.push(`**Repo:** ${report.repo || '—'}`);
    lines.push(`**Snapshot:** ${formatDate(report.generatedAt)}`);
    lines.push(`\n## Risk Overview`);
    lines.push(`- Risk Score: **${report.riskScore ?? 0}** (${report.riskLevel || 'Low'})`);
    lines.push(`\n## Priority Actions`);
    (report.topIssues || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    lines.push(`\n## File Suggestions`);
    (report.fileSuggestions || []).forEach(f => {
      lines.push(`\n### ${f.file} (${f.severity})`);
      (f.issues || []).forEach(issue => {
        if (typeof issue === 'string') {
          lines.push(`- ${issue}`);
        } else {
          if (issue.description) lines.push(`- **Issue:** ${issue.description}`);
          if (issue.suggestion)  lines.push(`  **Fix:** ${issue.suggestion}`);
          if (issue.codeBefore)  lines.push(`\n  **Before:**\n\`\`\`\n${issue.codeBefore}\n\`\`\``);
          if (issue.codeAfter)   lines.push(`  **After:**\n\`\`\`\n${issue.codeAfter}\n\`\`\``);
        }
      });
    });
    if ((report.securityIssues || []).length > 0) {
      lines.push(`\n## Security Issues`);
      (report.securityIssues || []).forEach(i => lines.push(`- ${typeof i === 'string' ? i : (i.description || JSON.stringify(i))}`));
    }
    if ((report.breakingChanges || []).length > 0) {
      lines.push(`\n## Breaking Changes`);
      (report.breakingChanges || []).forEach(c => lines.push(`- ${typeof c === 'string' ? c : (c.description || JSON.stringify(c))}`));
    }
    return lines.join('\n');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN INIT
  // ──────────────────────────────────────────────────────────────────────────

  async function init() {
    try {
      const [report, isProUser] = await Promise.all([
        loadReportData(),
        checkIsProUser()
      ]);

      // No data state
      if (!report) {
        hide('state-loading');
        show('state-no-data');
        return;
      }

      // Compute gating stats for debug log
      const allFiles     = report.fileSuggestions || [];
      const totalFiles   = allFiles.length;
      const visibleFiles = isProUser ? totalFiles : Math.min(totalFiles, 5);
      const restrictedSections = isProUser ? [] : ['securityHeatmap', 'breakingChanges', 'testCoverage', 'exportActions'];
      const snapshotTimestamp  = report.generatedAt || null;

      // Required debug log
      console.log('[Report] Snapshot loaded', {
        isProUser,
        visibleFiles,
        totalFiles,
        restrictedSections,
        snapshotTimestamp
      });

      // Render all sections
      renderSnapshotBar(report);
      renderRiskOverview(report);
      renderSummaryStats(report);
      renderPrioritySuggestions(report);
      renderFileSuggestions(report, isProUser);
      renderSecurityHeatmap(report, isProUser);
      renderBreakingChanges(report, isProUser);
      renderTestCoverage(report, isProUser);
      renderExportActions(report, isProUser);

      // Show report
      hide('state-loading');
      show('report-content');

    } catch (err) {
      console.error('[Report] Initialization error:', err);
      hide('state-loading');
      show('state-no-data');
    }
  }

  // Kick off
  init();

})();
