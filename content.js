// ============================================================================
// CONTENT.JS - Runs on GitHub PR pages
// Responsible for:
// 1. Injecting the floating panel UI
// 2. Extracting PR data (title, description, files, diff)
// 3. Handling user interactions
// 4. Communicating with OpenAI API
// ============================================================================

// State management
// Proxy enforces valid values on security-critical fields, making DevTools
// console mutations of currentPlan and isProUser throw TypeError on invalid input.
const state = new Proxy({
  isAnalyzing: false,
  panelCreated: false,
  currentPlan: 'FREE',
  isProUser: false,
  currentHistoryItem: null
}, {
  set(target, key, value) {
    if (key === 'currentPlan') {
      if (value !== 'FREE' && value !== 'PRO') {
        throw new TypeError(`[State] currentPlan must be "FREE" or "PRO" — got: ${String(value)}`);
      }
    }
    if (key === 'isProUser') {
      if (typeof value !== 'boolean') {
        throw new TypeError(`[State] isProUser must be a boolean — got: ${typeof value}`);
      }
    }
    target[key] = value;
    return true;
  }
});

// Initialize when DOM is fully loaded
// Content scripts may inject after DOMContentLoaded fires, so check document.readyState
if (document.readyState === 'loading') {
  // DOM still loading, wait for DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    initializeExtension();
  });
} else {
  // DOM already loaded, initialize immediately
  initializeExtension();
}

async function initializeExtension() {
  // Check if we're on a GitHub PR page
  const isPRPage = window.location.href.includes('/pull/');

  if (!isPRPage) {
    console.log('Not a GitHub PR page');
    return;
  }

  console.log('Initializing PR Quick Insight...');

  await captureAndStoreAppUserId();

  // Check for storage version and perform migration if needed
  try {
    const stored = await chrome.storage.local.get('storageVersion');
    const currentVersion = '1.1'; // Bumped from 1.0 to 1.1 for migration

    if (!stored.storageVersion || stored.storageVersion !== currentVersion) {
      console.log(`[Content] Storage version mismatch. Current: ${stored.storageVersion || 'legacy'}, Expected: ${currentVersion}`);
      await performStorageMigration(stored.storageVersion || 'legacy', currentVersion);
    }
  } catch (error) {
    console.warn('[Content] Error checking storage version:', error);
    // Don't block initialization if version check fails
  }

  // Load current plan from license manager and check for expiry warnings
  try {
    state.currentPlan = await LicenseManager.getCurrentPlan();
    state.isProUser = await LicenseManager.isProUser();
    console.log(`[Content] Current plan: ${state.currentPlan}, Pro user: ${state.isProUser}`);

    // Check for expiring licenses (if user is PRO)
    if (state.isProUser && typeof LicenseValidator !== 'undefined') {
      try {
        const licenseStatus = await LicenseValidator.getLicenseStatus();

        // Warn if license expires within 7 days
        if (licenseStatus.isValid && licenseStatus.expiresInDays !== null) {
          if (licenseStatus.expiresInDays < 7 && licenseStatus.expiresInDays >= 0) {
            const daysLeft = Math.ceil(licenseStatus.expiresInDays);
            const message = daysLeft === 0
              ? `⚠️ Pro license expires TODAY! Renew now to continue using advanced features.`
              : `⚠️ Pro license expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew now to avoid losing access.`;

            showWarning(message);
            console.warn(`[Content] License expires in ${daysLeft} days`);
          }
        }
      } catch (error) {
        console.warn('[Content] Error checking license expiry:', error);
        // Don't block extension if expiry check fails
      }
    }
  } catch (error) {
    console.error('[Content] Error loading license info:', error);
    state.currentPlan = 'FREE';
    state.isProUser = false;
  }

  // Initialize UsageTracker for API monitoring
  if (UsageTracker) {
    try {
      await UsageTracker.initialize();
      UsageTracker.initializeDailyReset();
      console.log('[Content] UsageTracker initialized for API monitoring');
    } catch (error) {
      console.warn('[Content] Error initializing UsageTracker:', error);
      // Don't block extension if tracker fails to initialize
    }
  }

  // Initialize ProFeatureGate for pro feature locking
  if (ProFeatureGate) {
    try {
      ProFeatureGate.init();
      ProFeatureGate.setProUser(state.isProUser);
      console.log('[Content] ProFeatureGate initialized for feature locking');
    } catch (error) {
      console.warn('[Content] Error initializing ProFeatureGate:', error);
      // Don't block extension if gate fails to initialize
    }
  }

  // Runtime diagnostics are gated by PRQI_DEBUG
  // Extract PR metadata (title, description, files, stats, diff)
  const prMetadata = extractPRMetadata();

  // Log metadata with diff length (not full text to avoid console spam)
  const metadataLog = {
    title: prMetadata.title,
    description: prMetadata.description,
    files: prMetadata.files,
    filesChanged: prMetadata.filesChanged,
    additions: prMetadata.additions,
    deletions: prMetadata.deletions,
    diffLength: prMetadata.diff.length // Only show length, not content
  };
  console.log('PR Metadata:', metadataLog);

  // Check for large PR and display warning if applicable
  if (prMetadata.isLargePR) {
    const largeMessage = `⚠️ Large PR Detected (${prMetadata.totalChanges} lines). Analysis based on available data. Some changes may not be fully analyzed.`;
    console.warn(`[Content] ${largeMessage}`);
    // Store in state so we can display warning in panel
    state.largepr_warning = largeMessage;
  }

  // Create the floating panel
  createFloatingPanel();

  // Display large PR warning if applicable
  if (state.largepr_warning) {
    showWarning(state.largepr_warning);
  }

  // Set up event listeners
  setupEventListeners();
}

async function captureAndStoreAppUserId() {
  try {
    const appUserId = extractGitHubUserId();
    if (!appUserId) {
      return;
    }

    await chrome.storage.local.set({ appUserId });
    console.log('[Content] Stored app user ID for checkout:', appUserId);
  } catch (error) {
    console.warn('[Content] Failed to store app user ID:', error);
  }
}

function extractGitHubUserId() {
  const candidates = [
    document.querySelector('meta[name="user-login"]')?.getAttribute('content'),
    document.documentElement?.getAttribute('data-login')
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (/^[a-zA-Z0-9-]{1,39}$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

// ============================================================================
// STORAGE MIGRATION
// ============================================================================

/**
 * Handle storage version migration for extension updates
 * Converts old data formats to new formats when extension version changes
 * @param {string} fromVersion - Previous storage version (or 'legacy' if new)
 * @param {string} toVersion - Target storage version
 */
async function performStorageMigration(fromVersion, toVersion) {
  try {
    console.log(`[Content] Migrating storage from version ${fromVersion} to ${toVersion}`);

    // Handle migration from legacy (pre-versioning) or 1.0 to 1.1
    if (fromVersion === 'legacy' || fromVersion === '1.0') {
      const allData = await chrome.storage.local.get(null);

      // Migration 1: Convert old licenseKey format to new LicenseValidator format (if applicable)
      // Old format: simple alphanumeric key stored as 'licenseKey'
      // New format: PRORISK|email|timestamp|signature stored as 'proLicense'
      if (allData.licenseKey && !allData.proLicense) {
        console.log('[Content] Migrating license key format');
        // Note: Full conversion would require re-validating with LicenseValidator
        // For now, we'll clear the old format since the new format has different structure
        await chrome.storage.local.remove('licenseKey');
        console.log('[Content] Removed legacy license key format');
      }

      // Migration 2: Ensure usage tracker data has correct structure
      if (allData.usageData) {
        try {
          const usageData = allData.usageData;
          // Validate it has required fields
          if (!Array.isArray(usageData.calls) || typeof usageData.totalTokens !== 'number') {
            console.warn('[Content] Usage tracker data malformed, will be reset on next use');
          }
        } catch (error) {
          console.warn('[Content] Error validating usage data:', error);
          await chrome.storage.local.remove('usageData');
        }
      }

      // Migration 3: Validate history data structure
      if (allData.prAnalysisHistory && !Array.isArray(allData.prAnalysisHistory)) {
        console.warn('[Content] History data not an array, removing corrupted data');
        await chrome.storage.local.remove('prAnalysisHistory');
      }

      // Successfully migrated
      await chrome.storage.local.set({ storageVersion: toVersion });
      console.log(`[Content] Storage migration complete to version ${toVersion}`);
    }

    // Add more migration paths as needed for future versions
    // if (fromVersion === '1.1') { ... migrate to 1.2 ... }

  } catch (error) {
    console.error('[Content] Error during storage migration:', error);
    // Don't block extension if migration fails - it will continue with current data
    // and attempt migration again on next load
  }
}

// ============================================================================

function extractPRMetadata() {
  // Extract PR title using GitHub's data-testid attribute
  // Selector: [data-testid="pull-request-title"] is the primary way GitHub marks PR titles
  // Fallback to 'h1' if the data-testid changes (compatibility with older GitHub versions)
  const titleElement = document.querySelector('[data-testid="pull-request-title"]')
    || document.querySelector('h1');
  const title = titleElement?.textContent.trim() || 'Unknown Title';

  // Extract PR description/body using GitHub's data-testid attribute
  // Selector: [data-testid="pull-request-body"] is where the main PR description lives
  // Fallback to '.js-comment-container' if structure changes
  // Also check for '.timeline-comment-header-text' for alternative DOM structures
  const descriptionElement = document.querySelector('[data-testid="pull-request-body"]')
    || document.querySelector('.js-comment-container')
    || document.querySelector('[id^="issue_comment_"] .timeline-comment');

  // Get description text and handle empty/missing descriptions gracefully
  let description = descriptionElement?.textContent.trim() || '';

  // If description is empty, provide a helpful placeholder
  if (!description) {
    description = '(No description provided)';
  }

  // Extract list of changed files
  const files = extractChangedFilesList();

  // Extract additions and deletions statistics
  const stats = extractAdditionsDeletions();

  // Extract visible diff content
  const diff = extractDiffContent();

  // Detect if this is a large PR (>5000 lines of changes)
  const totalChanges = stats.additions + stats.deletions;
  const isLargePR = totalChanges > 5000;

  // Return structured object for logging and further processing
  return {
    title,
    description,
    files,
    filesChanged: files.length,
    additions: stats.additions,
    deletions: stats.deletions,
    totalChanges,
    isLargePR,
    diff
  };
}

// ============================================================================
// EXTRACT CHANGED FILES LIST
// ============================================================================

function extractChangedFilesList() {
  const files = [];

  // Method 1: GitHub production DOM uses [data-path] attribute on file headers
  const pathElements = document.querySelectorAll('[data-path]');
  if (pathElements.length > 0) {
    pathElements.forEach((el) => {
      const path = el.getAttribute('data-path');
      if (path && !files.includes(path)) {
        files.push(path);
      }
    });
  }

  // Method 2: File header links inside .file-header (stable GitHub class)
  if (files.length === 0) {
    const fileLinks = document.querySelectorAll('.file-header .file-info a, .file-header [title]');
    fileLinks.forEach((el) => {
      const path = el.getAttribute('title') || el.textContent.trim();
      if (path && !files.includes(path)) {
        files.push(path);
      }
    });
  }

  // Method 3: JS file tree sidebar
  if (files.length === 0) {
    const treeItems = document.querySelectorAll('.js-tree-browser .js-tree-item [data-name]');
    treeItems.forEach((el) => {
      const path = el.getAttribute('data-name') || el.textContent.trim();
      if (path && !files.includes(path)) {
        files.push(path);
      }
    });
  }

  // Method 4: Legacy data-testid selectors
  if (files.length === 0) {
    const fileElements = document.querySelectorAll('[data-testid="file-tree-item-wrapper"]');
    fileElements.forEach((element) => {
      const fileNameElement = element.querySelector('[data-testid="file-tree-item"]');
      if (fileNameElement) {
        const fileName = fileNameElement.textContent.trim();
        if (fileName) files.push(fileName);
      }
    });
  }

  return files;
}

// ============================================================================
// EXTRACT ADDITIONS AND DELETIONS
// ============================================================================

function extractAdditionsDeletions() {
  let additions = 0;
  let deletions = 0;

  // Method 1: Look for the PR stats in the header
  // GitHub shows something like "+123 −456" or similar in the files changed section
  // Look for elements that typically contain these stats
  const statsText = document.body.textContent;

  // Try to find additions count (look for +number pattern)
  // Usually appears as "+123" or "123 additions"
  const addMatch = statsText.match(/\+(\d+)\s+(additions?)/i)
    || statsText.match(/(\d+)\s+additions?/i);
  if (addMatch) {
    additions = parseInt(addMatch[1], 10);
  }

  // Try to find deletions count (look for −/- number pattern)
  // Usually appears as "−456" or "456 deletions"
  const delMatch = statsText.match(/−(\d+)\s+(deletions?)/i)
    || statsText.match(/-(\d+)\s+(deletions?)/i)
    || statsText.match(/(\d+)\s+deletions?/i);
  if (delMatch) {
    deletions = parseInt(delMatch[1], 10);
  }

  // Method 2: Look for specific GitHub elements that display file change stats
  // Try to find the stats display element
  const statsElements = document.querySelectorAll('[class*="diffstat"]');
  statsElements.forEach((element) => {
    const text = element.textContent;

    // Look for addition/deletion markers
    if (text.includes('+')) {
      const match = text.match(/\+(\d+)/);
      if (match) additions = Math.max(additions, parseInt(match[1], 10));
    }
    if (text.includes('−') || text.includes('-')) {
      const match = text.match(/−(\d+)/) || text.match(/-(\d+)/);
      if (match) deletions = Math.max(deletions, parseInt(match[1], 10));
    }
  });

  return {
    additions,
    deletions
  };
}

// ============================================================================
// UI CREATION
// ============================================================================

function createFloatingPanel() {
  if (state.panelCreated) return;

  // Main panel container
  const panel = document.createElement('div');
  panel.id = 'pr-quick-insight-panel';
  panel.innerHTML = `
    <!-- Header -->
    <div class="prs-header">
      <div class="prs-title">⚡ PR AUDIT</div>
      <button id="prs-close-btn" class="prs-close-btn" title="Close">×</button>
    </div>

    <!-- Content -->
    <div class="prs-content">
      <!-- Analyze Button (shown initially) -->
      <button id="prs-analyze-btn" class="prs-analyze-btn">
        ▶ SCAN PR
      </button>

      <!-- Loading State -->
      <div id="prs-loading" style="display: none;">
        <div class="prs-loading">
          <div class="prs-spinner"></div>
          <p>ANALYZING CODEBASE...</p>
        </div>
      </div>

      <!-- Results (hidden initially) -->
      <div id="prs-results" class="prs-results" style="display: none;">

        <!-- ── RISK CARD ── -->
        <div class="prs-risk-card" id="prs-risk-card">
          <div class="prs-risk-card-body">
            <div class="prs-risk-score-block">
              <div class="prs-risk-card-label">RISK SCORE</div>
              <div class="prs-risk-card-number" id="prs-risk-score-text">--</div>
            </div>
            <div class="prs-risk-divider"></div>
            <div class="prs-confidence-block">
              <div class="prs-risk-card-label">MERGE CONFIDENCE</div>
              <div class="prs-confidence-value" id="prs-confidence-text">--%</div>
            </div>
          </div>
          <div class="prs-risk-category" id="prs-risk-level-display">SCANNING...</div>
        </div>

        <!-- ── PR METADATA STATS ── -->
        <div class="prs-meta-stats" id="prs-meta-stats">
          <div class="prs-meta-stat">
            <div class="prs-meta-val" id="prs-meta-files">--</div>
            <div class="prs-meta-lbl">Files</div>
          </div>
          <div class="prs-meta-stat prs-stat-added">
            <div class="prs-meta-val" id="prs-meta-added">--</div>
            <div class="prs-meta-lbl">+ Added</div>
          </div>
          <div class="prs-meta-stat prs-stat-removed">
            <div class="prs-meta-val" id="prs-meta-removed">--</div>
            <div class="prs-meta-lbl">− Removed</div>
          </div>
          <div class="prs-meta-stat prs-stat-security" id="prs-meta-security-wrap" style="display:none;">
            <div class="prs-meta-val prs-meta-sec-val" id="prs-meta-security">--</div>
            <div class="prs-meta-lbl">Sensitive</div>
          </div>
        </div>

        <!-- ── SUMMARY ── -->
        <div class="prs-section-card">
          <div class="prs-section-title">📋 SUMMARY</div>
          <ul id="prs-summary-list"></ul>
        </div>

        <!-- ── SECURITY ISSUES ── -->
        <div class="prs-section-card" id="prs-security-section-container" style="display: none;">
          <div class="prs-section-title">🔐 SECURITY ISSUES</div>
          <ul id="prs-security-issues" class="prs-alert-list"></ul>
        </div>

        <!-- ── BREAKING CHANGES ── -->
        <div class="prs-section-card" id="prs-breaking-section-container" style="display: none;">
          <div class="prs-section-title">⚠️ BREAKING CHANGES</div>
          <ul id="prs-breaking-changes" class="prs-alert-list"></ul>
        </div>

        <!-- ── QUALITY METRICS ── -->
        <div class="prs-section-card">
          <div class="prs-section-title">🎯 QUALITY METRICS</div>
          <div class="prs-quality-row">
            <div class="prs-quality-item">
              <div class="prs-quality-label">Test Coverage <span class="prs-tip" title="Based on test file ratio and coverage indicators in the diff">ⓘ</span></div>
              <div id="prs-test-coverage" class="prs-quality-value">--</div>
            </div>
            <div class="prs-quality-item">
              <div class="prs-quality-label">Commit Quality <span class="prs-tip" title="Clarity, conventional format, and descriptiveness">ⓘ</span></div>
              <div id="prs-commit-quality" class="prs-quality-value"></div>
            </div>
          </div>
        </div>

        <!-- ── SUGGESTED COMMIT MESSAGE ── -->
        <div class="prs-section-card prs-commit-section" id="prs-commit-suggestion-container" style="display: none;">
          <div class="prs-section-title">💡 SUGGESTED MESSAGE</div>
          <textarea id="prs-suggested-commit" class="prs-commit-textarea" readonly rows="3"></textarea>
          <button id="prs-copy-commit-btn" class="prs-copy-btn">📋 COPY TO CLIPBOARD</button>
        </div>

        <!-- ── CRITICAL ISSUES ── -->
        <div class="prs-section-card prs-issues-section">
          <div class="prs-section-title">🔍 CRITICAL ISSUES</div>
          <div id="prs-issues-list"></div>
          <div id="prs-issues-locked" style="display:none;"></div>
        </div>

        <!-- PRO: Advanced Security Audit -->
        <div id="prs-pro-security-audit-container" class="prs-section-card" style="display: none;"></div>

        <!-- PRO: Advanced Breaking Changes -->
        <div id="prs-pro-breaking-changes-container" class="prs-section-card" style="display: none;"></div>

        <!-- PRO: Test Coverage Analysis -->
        <div id="prs-pro-test-coverage-container" class="prs-section-card" style="display: none;"></div>

        <!-- PRO: Critical Issues Panel -->
        <div id="prs-pro-critical-issues-container" class="prs-section-card" style="display: none;"></div>

        <!-- PRO: Advanced Riskometer -->
        <div id="prs-pro-advanced-riskometer-container" class="prs-section-card" style="display: none;"></div>

        <!-- ── BUTTONS (Full Report primary, Scan Again secondary) ── -->
        <button id="prs-full-report-btn" class="prs-full-report-btn" style="display: none;">📄 FULL REPORT <span class="prs-btn-arrow">→</span></button>
        <button id="prs-reset-btn" class="prs-reset-btn">↻ SCAN AGAIN</button>
        <button id="prs-view-history-btn" class="prs-view-history-btn" style="display: none;">📚 VIEW HISTORY</button>

        <!-- ── USAGE COUNTER (FREE users) ── -->
        <div id="prs-usage-display" class="prs-usage-counter" style="display: none;">
          <div class="prs-usage-text-row">
            <span id="prs-usage-text">-- of 5 Free Scans Used Today</span>
          </div>
          <div class="prs-usage-track">
            <div id="prs-usage-bar-fill" class="prs-usage-bar-fill" style="width: 0%"></div>
          </div>
          <button id="prs-upgrade-cta" class="prs-upgrade-cta" style="display: none;">Unlock Full Report (Pro) →</button>
        </div>
      </div>

      <!-- Warning Message (for license expiry, etc) -->
      <div id="prs-warning" class="prs-warning" style="display: none;"></div>

      <!-- Error Message (hidden initially) -->
      <div id="prs-error" class="prs-error" style="display: none;"></div>

      <!-- History Panel (PRO feature) -->
      <div id="prs-history-panel" class="prs-history-panel" style="display: none;">
        <!-- History Header with Controls -->
        <div class="prs-history-header">
          <div class="prs-history-title">📚 SCAN HISTORY</div>
          <button id="prs-history-close-btn" class="prs-history-close-btn" title="Close history">×</button>
        </div>

        <!-- History Stats -->
        <div class="prs-history-stats" id="prs-history-stats" style="display: none;">
          <div class="prs-stat-item">
            <span class="prs-stat-label">Total Scans:</span>
            <span class="prs-stat-value" id="prs-stat-total">0</span>
          </div>
          <div class="prs-stat-item">
            <span class="prs-stat-label">Avg Risk:</span>
            <span class="prs-stat-value" id="prs-stat-avg">0</span>
          </div>
          <div class="prs-stat-item">
            <span class="prs-stat-label">High Risk:</span>
            <span class="prs-stat-value" id="prs-stat-high">0</span>
          </div>
        </div>

        <!-- History List -->
        <div class="prs-history-list" id="prs-history-list" style="min-height: 100px;">
          <div class="prs-loading-history">Loading history...</div>
        </div>

        <!-- History Detail View (hidden by default) -->
        <div id="prs-history-detail" class="prs-history-detail" style="display: none;">
          <!-- Detail header -->
          <div class="prs-detail-header">
            <button id="prs-detail-back-btn" class="prs-detail-back-btn" title="Back to list">← BACK</button>
            <span id="prs-detail-title" class="prs-detail-title"></span>
          </div>

          <!-- Detail content -->
          <div id="prs-detail-content" class="prs-detail-content"></div>

          <!-- Detail actions -->
          <div class="prs-detail-actions">
            <button id="prs-copy-text-btn" class="prs-detail-action-btn prs-btn-copy">📋 COPY TEXT</button>
            <button id="prs-copy-json-btn" class="prs-detail-action-btn prs-btn-copy">{ } COPY JSON</button>
            <button id="prs-print-pdf-btn" class="prs-detail-action-btn prs-btn-print">🖨️ PRINT PDF</button>
            <button id="prs-delete-history-btn" class="prs-detail-action-btn prs-btn-delete">🗑️ DELETE</button>
          </div>
        </div>

        <!-- Clear All Button -->
        <div class="prs-history-footer">
          <button id="prs-clear-history-btn" class="prs-clear-history-btn">Clear All History</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  state.panelCreated = true;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  const analyzeBtn   = document.getElementById('prs-analyze-btn');
  const closeBtn     = document.getElementById('prs-close-btn');
  const resetBtn     = document.getElementById('prs-reset-btn');
  const fullReportBtn = document.getElementById('prs-full-report-btn');
  const upgradeCta   = document.getElementById('prs-upgrade-cta');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', handleAnalyzePR);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closePanel);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetPanel);
  }

  if (fullReportBtn) {
    fullReportBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('report.html'), '_blank');
    });
  }

  if (upgradeCta) {
    upgradeCta.addEventListener('click', () => {
      if (typeof window.openUpgradeModal === 'function') {
        window.openUpgradeModal();
      } else {
        chrome.runtime.openOptionsPage();
      }
    });
  }

  // History event listeners (PRO only)
  if (state.isProUser) {
    setupHistoryEventListeners();
  }
}

function closePanel() {
  const panel = document.getElementById('pr-quick-insight-panel');
  if (panel) {
    panel.style.display = 'none';
  }
}

function resetPanel() {
  showElement('prs-analyze-btn');
  hideElement('prs-loading');
  hideElement('prs-results');
  hideElement('prs-error');
  state.isAnalyzing = false;
}

// ============================================================================
// MAIN ANALYSIS FLOW
// ============================================================================

async function handleAnalyzePR() {
  if (state.isAnalyzing) return;

  state.isAnalyzing = true;
  
  try {
    // Hide analyze button and show loading
    hideElement('prs-analyze-btn');
    showElement('prs-loading');
    hideElement('prs-error');

    // Extract complete PR metadata (title, description, files, additions, deletions, diff)
    const prData = extractPRMetadata();
    console.log('PR data sent to API:', {
      title: prData.title,
      filesChanged: prData.filesChanged,
      additions: prData.additions,
      deletions: prData.deletions,
      diffLength: prData.diff.length
    });

    // If DOM extraction found no diff, fall back to GitHub API
    if (prData.diff.length === 0) {
      console.log('[Content] DOM diff extraction empty — trying GitHub API fallback');
      const apiResult = await fetchDiffFromAPI();

      if (apiResult && apiResult.diff.length > 0) {
        // Merge API results into prData
        prData.diff = apiResult.diff;
        if (apiResult.files.length > 0) {
          prData.files = apiResult.files;
          prData.filesChanged = apiResult.files.length;
        }
        if (apiResult.additions > 0 || apiResult.deletions > 0) {
          prData.additions = apiResult.additions;
          prData.deletions = apiResult.deletions;
          prData.totalChanges = apiResult.additions + apiResult.deletions;
        }
        console.log('[Content] GitHub API fallback succeeded:', {
          diffLength: prData.diff.length,
          filesChanged: prData.filesChanged
        });
      } else {
        // API also failed — guide the user
        showElement('prs-analyze-btn');
        hideElement('prs-loading');
        const prBasePath = window.location.pathname.match(/^(.*\/pull\/\d+)/)?.[1]
          || window.location.pathname;
        const filesUrl = window.location.origin + prBasePath + '/files';
        throw new Error(
          'No diff found on this page and GitHub API fallback also failed.\n\n' +
          'Try opening this tab and scanning from there: ' + filesUrl
        );
      }
    }

    // Get API key from storage
    const { apiKey } = await chrome.storage.local.get('apiKey');

    if (!apiKey) {
      throw new Error('API key not found. Please set it in the extension popup.');
    }

    // Validate API key is a valid string
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('Invalid API key format. Please check the extension popup.');
    }

    // Validate API key contains only ASCII characters
    if (!/^[\x20-\x7E]+$/.test(apiKey)) {
      throw new Error('API key contains invalid characters. Please check and re-enter it.');
    }

    // ===== CHECK FREE PLAN USAGE LIMITS =====
    const usageStatus = await UsageLimiter.canAnalyze(state.currentPlan);
    console.log('[Content] Usage status:', usageStatus);

    if (!usageStatus.canAnalyze) {
      // User has exceeded daily limit
      const timeRemaining = await UsageLimiter.getTimeUntilReset();
      const timeStr = UsageLimiter.formatTimeRemaining(timeRemaining);
      throw new Error(`Daily limit reached (${usageStatus.used}/${usageStatus.limit} scans). Resets in ${timeStr}. Upgrade to Pro for unlimited analysis.`);
    }

    // Send to OpenAI
    const analysis = await analyzePRWithOpenAI(prData, apiKey);
    console.log('Analysis result:', analysis);

    // Override riskScore with deterministic file-based scoring engine.
    // The AI score is kept as a fallback signal but the structural score
    // (file types, LOC, security paths) is what drives the final gauge.
    if (RiskEngine && typeof RiskEngine.calculateRiskScore === 'function') {
      analysis.riskScore = RiskEngine.calculateRiskScore(prData);
      // Sync riskLevel to match the deterministic score
      if (analysis.riskScore >= 66)      analysis.riskLevel = 'High';
      else if (analysis.riskScore >= 26) analysis.riskLevel = 'Medium';
      else                               analysis.riskLevel = 'Low';
      console.log(`[Content] Deterministic risk score: ${analysis.riskScore} (${analysis.riskLevel})`);
    }

    // Increment usage counter after successful analysis
    await UsageLimiter.incrementUsage(state.currentPlan);

    // Get remaining scans for display
    const updatedUsage = await UsageLimiter.canAnalyze(state.currentPlan);
    console.log(`[Content] Scans remaining: ${updatedUsage.remaining}/${updatedUsage.limit}`);

    // Attach extracted PR metadata so displayResults can render stat blocks
    analysis._meta = {
      filesChanged:  prData.filesChanged || 0,
      linesAdded:    prData.additions    || 0,
      linesRemoved:  prData.deletions    || 0,
      securityFiles: (prData.files || []).filter(f =>
        /\/(auth|payment|payments|core|middleware|security)\//i.test(f) ||
        /\.(env|pem|key|cert|secret)/i.test(f)
      ).length
    };

    // Display results with plan info
    displayResults(analysis, state.currentPlan);

    // Persist snapshot for the Full Report page (always, free + pro)
    try {
      const securityIssues = analysis.securityIssues || [];
      const breakingChanges = analysis.breakingChanges || [];
      const fileSuggestions = analysis.fileSuggestions || [];
      const realSecurityIssues = securityIssues.filter(i => i !== 'None detected');
      const realBreakingChanges = breakingChanges.filter(i => i !== 'None detected');

      const enhancedSecurityIssues = (RiskEngine && typeof RiskEngine.calculateSecurityRisk === 'function')
        ? RiskEngine.calculateSecurityRisk(realSecurityIssues)
        : [];

      const latestReport = {
        // Snapshot metadata
        generatedAt: Date.now(),
        snapshotVersion: '1.0',
        commitHash: null,
        // PR context
        prUrl: window.location.href,
        prTitle: prData.title,
        prDescription: prData.description,
        repo: extractRepoName(window.location.href),
        filesChanged: prData.filesChanged,
        additions: prData.additions,
        deletions: prData.deletions,
        files: prData.files,
        // Core analysis
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        summary: analysis.summary || [],
        topIssues: analysis.topIssues || [],
        testCoverage: analysis.testCoverage,
        commitMessageQuality: analysis.commitMessageQuality,
        suggestedCommitMessage: analysis.suggestedCommitMessage,
        // Security
        securityIssues: realSecurityIssues,
        enhancedSecurityIssues,
        // Breaking changes
        breakingChanges: realBreakingChanges,
        // Per-file suggestions from AI
        fileSuggestions,
        // Derived total
        totalSuggestions: realSecurityIssues.length + realBreakingChanges.length + fileSuggestions.length
      };

      await chrome.storage.local.set({ latestReport });
      console.log('[Content] latestReport snapshot saved');
    } catch (err) {
      console.warn('[Content] Failed to save latestReport snapshot:', err);
    }

    // Save to history for PRO users
    if (state.isProUser && PRHistory) {
      try {
        await PRHistory.saveToHistory(prData, analysis);
        console.log('[Content] PR analysis saved to history');
      } catch (error) {
        console.warn('[Content] Error saving to history:', error);
        // Don't throw - history is optional
      }
    }

    hideElement('prs-loading');
    showElement('prs-results');
    
  } catch (error) {
    console.error('Error analyzing PR:', error);
    showError(error.message);
    hideElement('prs-loading');
    showElement('prs-analyze-btn');
  } finally {
    state.isAnalyzing = false;
  }
}

// ============================================================================
// DATA EXTRACTION
// ============================================================================

function extractPRData() {
  // Extract PR title
  const titleElement = document.querySelector('[data-testid="pull-request-title"]') 
    || document.querySelector('h1');
  const title = titleElement?.textContent.trim() || 'Unknown Title';

  // Extract PR description
  const descriptionElement = document.querySelector('[data-testid="pull-request-body"]') 
    || document.querySelector('.js-comment-container');
  const description = descriptionElement?.textContent.trim() || 'No description';

  // Extract changed files
  const filesData = extractChangedFiles();

  // Extract diff text (limited to visible content)
  const diffText = extractDiffContent();

  return {
    title,
    description,
    files: filesData,
    diff: diffText
  };
}

function extractChangedFiles() {
  const files = [];
  
  // Get all file elements from the file list
  const fileElements = document.querySelectorAll('[data-testid="file-tree-item-wrapper"]');
  
  fileElements.forEach((element) => {
    const fileNameElement = element.querySelector('[data-testid="file-tree-item"]');
    if (fileNameElement) {
      const fileName = fileNameElement.textContent.trim();
      files.push(fileName);
    }
  });

  // Fallback: if no files found with data-testid, try alternative selector
  if (files.length === 0) {
    const fileHeaders = document.querySelectorAll('[data-testid^="file-name"]');
    fileHeaders.forEach((header) => {
      files.push(header.textContent.trim());
    });
  }

  return files;
}

// ============================================================================
// GITHUB API DIFF FETCH (fallback when DOM extraction fails)
// ============================================================================

/**
 * Parse the current GitHub PR URL into owner, repo, prNumber.
 * Works regardless of sub-path (/files, /changes, /commits, etc.)
 */
function parsePRUrl() {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], prNumber: match[3] };
}

/**
 * Fetch the PR diff via GitHub REST API.
 * Uses /repos/{owner}/{repo}/pulls/{pull_number}/files which returns
 * structured file objects including the `patch` (unified diff) for each file.
 * Works for public repos without authentication (60 req/hr rate limit).
 * @returns {Promise<{diff: string, files: string[], additions: number, deletions: number}|null>}
 */
async function fetchDiffFromAPI() {
  const prInfo = parsePRUrl();
  if (!prInfo) {
    console.warn('[Content] Could not parse PR URL for API fallback');
    return null;
  }

  const { owner, repo, prNumber } = prInfo;
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (response.status === 403) {
      console.warn('[Content] GitHub API rate limit hit (60 req/hr for unauthenticated requests)');
      return null;
    }

    if (!response.ok) {
      console.warn(`[Content] GitHub API returned ${response.status}`);
      return null;
    }

    const files = await response.json();
    if (!Array.isArray(files) || files.length === 0) return null;

    const maxChars = 10000;
    let diffText = '';
    const fileNames = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const file of files) {
      fileNames.push(file.filename);
      totalAdditions += file.additions || 0;
      totalDeletions += file.deletions || 0;

      // patch is undefined for binary files or files with no changes
      if (file.patch && diffText.length < maxChars) {
        diffText += `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}\n\n`;
      }
    }

    return {
      diff: diffText.substring(0, maxChars),
      files: fileNames,
      additions: totalAdditions,
      deletions: totalDeletions
    };
  } catch (error) {
    console.error('[Content] GitHub API fetch error:', error);
    return null;
  }
}

// ============================================================================
// EXTRACT DIFF CONTENT
// ============================================================================

function extractDiffContent() {
  let diffText = '';
  const maxChars = 10000; // Limit to 10,000 chars to avoid token overflow

  // Method 1: GitHub new /changes UI (React-based code review experience)
  // Classes confirmed from user diagnostic: diff-line-row, diff-text-marker, diff-text-inner, diff-text
  const newUiLines = document.querySelectorAll('.diff-line-row');
  if (newUiLines.length > 0) {
    newUiLines.forEach((row) => {
      if (diffText.length < maxChars) {
        const marker = row.querySelector('.diff-text-marker');
        const textEl = row.querySelector('.diff-text-inner') || row.querySelector('.diff-text');
        if (textEl) {
          const prefix = marker ? marker.textContent.trim() : ' ';
          diffText += prefix + textEl.textContent + '\n';
        }
      }
    });
  }

  // Method 2: Extract from blob-code lines (GitHub classic /files UI)
  // Added lines: .blob-code-addition, deleted: .blob-code-deletion, context: .blob-code-context
  if (diffText.length === 0) {
    const codeLines = document.querySelectorAll(
      '.blob-code-addition .blob-code-inner, .blob-code-deletion .blob-code-inner, .blob-code-context .blob-code-inner'
    );

    if (codeLines.length > 0) {
      codeLines.forEach((line) => {
        if (diffText.length < maxChars) {
          const row = line.closest('tr');
          const isAddition = row && (row.classList.contains('blob-code-addition') || row.classList.contains('addition'));
          const isDeletion = row && (row.classList.contains('blob-code-deletion') || row.classList.contains('deletion'));
          const prefix = isAddition ? '+' : isDeletion ? '-' : ' ';
          diffText += prefix + line.textContent + '\n';
        }
      });
    }
  }

  // Method 3: blob-code table cells directly (catches cases where inner span not present)
  if (diffText.length === 0) {
    const blobCells = document.querySelectorAll('td.blob-code');
    blobCells.forEach((cell) => {
      if (diffText.length < maxChars) {
        const row = cell.closest('tr');
        const isAddition = row && row.classList.contains('blob-code-addition');
        const isDeletion = row && row.classList.contains('blob-code-deletion');
        const prefix = isAddition ? '+' : isDeletion ? '-' : ' ';
        diffText += prefix + cell.textContent.trim() + '\n';
      }
    });
  }

  // Method 4: Diff tables (GitHub production fallback)
  if (diffText.length === 0) {
    const diffTables = document.querySelectorAll('table.diff-table, .diff-table');
    diffTables.forEach((table) => {
      if (diffText.length < maxChars) {
        diffText += table.textContent.substring(0, maxChars - diffText.length) + '\n\n';
      }
    });
  }

  // Method 5: File data sections
  if (diffText.length === 0) {
    const fileSections = document.querySelectorAll('.file .data, .js-file-content');
    fileSections.forEach((section) => {
      if (diffText.length < maxChars) {
        diffText += section.textContent.substring(0, maxChars - diffText.length) + '\n\n';
      }
    });
  }

  // Method 6: Broad container fallback (#files is GitHub's PR files tab container)
  if (diffText.length === 0) {
    const diffContainer = document.querySelector('#files')
      || document.querySelector('#pull-requests-diff')
      || document.querySelector('.diff-view')
      || document.querySelector('[data-testid="diff-container"]')
      || document.querySelector('[data-testid="split-diff-view"]');

    if (diffContainer) {
      diffText = diffContainer.textContent.substring(0, maxChars);
    }
  }

  // Clean up diff text: remove extra whitespace while preserving line breaks
  diffText = diffText
    .trim()
    .replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove multiple blank lines

  // Limit to 10,000 characters (max token consideration)
  diffText = diffText.substring(0, maxChars);

  return diffText;
}

// ============================================================================
// OPENAI API CALL
// ============================================================================

async function analyzePRWithOpenAI(prData, apiKey) {
  // ===== CHECK RATE LIMITING =====
  if (UsageTracker) {
    const canCall = UsageTracker.canMakeApiCall();
    if (!canCall.allowed) {
      if (canCall.waitMs === Infinity) {
        throw new Error(`Rate limited: Daily API limit reached. ${canCall.reason}`);
      }
      const waitSeconds = Math.ceil(canCall.waitMs / 1000);
      throw new Error(`Rate limited: Please wait ${waitSeconds} seconds before next analysis. Per-minute limit: ${canCall.reason}`);
    }
  }

  // Build comprehensive prompt with all PR data
  const prompt = `You are a senior software engineer reviewing a GitHub Pull Request. Analyze the PR below and provide a comprehensive code review covering security, breaking changes, test coverage, and commit message quality.

PR Title:
${prData.title}

PR Description:
${prData.description}

PR Statistics:
- Files Changed: ${prData.filesChanged}
- Lines Added: ${prData.additions}
- Lines Deleted: ${prData.deletions}

Changed Files:
${prData.files.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Code Diff (Preview):
${prData.diff}

---

Analyze this PR and respond in EXACTLY this JSON format (no markdown, no extra text):
{
  "summary": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "riskLevel": "Low|Medium|High",
  "riskScore": <integer 0-100>,
  "securityIssues": ["issue 1 or 'None detected'"],
  "breakingChanges": ["change 1 or 'None detected'"],
  "testCoverage": "Good|Fair|Poor|Not testable",
  "commitMessageQuality": "Good|Could be clearer|Needs improvement|Not applicable",
  "suggestedCommitMessage": "Suggested clearer commit message starting with Feat/Fix/Docs/etc or 'No change suggested'",
  "topIssues": ["critical issue 1", "critical issue 2", "critical issue 3"],
  "fileSuggestions": [{"file": "path/to/file.js", "severity": "Critical|High|Medium|Low", "issues": [{"description": "what is wrong and why it matters", "suggestion": "how to fix it", "codeBefore": "// existing problematic code (1-8 lines)", "codeAfter": "// corrected code (1-8 lines)"}]}]
}

Guidelines:
- Summary: 5 concise, actionable points about the PR
- Risk Level and Score:
  * Low (score 1–25): Documentation only (README, .md, comments, typos), config-only changes, no code logic touched
  * Medium (score 26–65): Code changes with limited blast radius, refactoring, non-breaking additive changes, test-only changes
  * High (score 66–100): Breaking API/interface changes, security-sensitive code, auth/payment/data paths, removing features, large-scale rewrites
  * A PR that only modifies documentation, markdown, or comments MUST be Low with score ≤ 15
- Security Issues: Flag any potential security vulnerabilities, injection risks, authentication issues, etc. or 'None detected'
- Breaking Changes: Identify API changes, behavior changes, or removing features. or 'None detected'
- Test Coverage: Assess if changes have adequate test coverage
- Commit Message Quality: Evaluate if the PR title/description follows conventions
- Suggested Commit Message: Propose a better commit message if needed
- Top Issues: 3 critical technical concerns to address
- File Suggestions: For each changed file with real concerns (max 10 files, omit clean files): list up to 3 issues per file. Each issue MUST include: description (what is wrong), suggestion (how to fix), codeBefore (1-8 lines of the problematic existing code from the diff), codeAfter (1-8 lines showing the corrected version). Keep code snippets concise and directly relevant. Set file severity to the highest issue severity in that file.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    const errorMsg = errorData.error?.message || 'Unknown error';
    throw new Error(`OpenAI API Error: ${errorMsg}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    throw new Error('Invalid API response from OpenAI');
  }

  const content = data.choices[0].message.content.trim();

  // ===== TRACK API USAGE =====
  if (UsageTracker && data.usage) {
    try {
      await UsageTracker.recordApiCall({
        inputTokens: data.usage.prompt_tokens || 150,
        outputTokens: data.usage.completion_tokens || 200,
        success: true
      });

      // Check for warnings and display if any
      const warning = UsageTracker.getWarningMessage();
      if (warning) {
        console.warn('[Content] Usage warning:', warning);
        // Store warning for display in UI later
        await chrome.storage.local.set({ lastUsageWarning: warning });
      }
    } catch (error) {
      console.warn('[Content] Error tracking usage:', error);
      // Don't throw - tracking is optional, shouldn't block analysis
    }
  }

  // Parse JSON response
  try {
    const analysis = JSON.parse(content);
    // Normalize riskScore to always be a valid integer on the analysis object.
    // This ensures history display and downstream consumers always have a number.
    if (typeof analysis.riskScore !== 'number' || analysis.riskScore < 0 || analysis.riskScore > 100) {
      analysis.riskScore = getRiskScore(analysis.riskLevel || 'Medium');
    } else {
      analysis.riskScore = Math.round(analysis.riskScore);
    }
    return analysis;
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
  }
}

// ============================================================================
// DISPLAY RESULTS
// ============================================================================

// ============================================================================
// DISPLAY RESULTS - PREMIUM CYBERPUNK DASHBOARD
// ============================================================================

function getRiskScore(level) {
  switch (level?.toLowerCase()) {
    case 'low':
      return 25;
    case 'medium':
      return 60;
    case 'high':
      return 85;
    default:
      return 50;
  }
}

function getContextualMicrocopy(riskLevel) {
  const messages = {
    'low': '✓ Safe to merge with standard review',
    'medium': '⚠ Review recommended before deployment',
    'high': '🛑 Requires critical review + testing'
  };
  return messages[riskLevel?.toLowerCase()] || 'Review required';
}

function animateRiskometer(score, level) {
  const scoreEl     = document.getElementById('prs-risk-score-text');
  const categoryEl  = document.getElementById('prs-risk-level-display');
  const confidenceEl = document.getElementById('prs-confidence-text');
  const card        = document.getElementById('prs-risk-card');

  if (!scoreEl) return;

  // Determine color class based on score
  let colorVar, categoryClass;
  if (score > 60) {
    colorVar      = 'var(--risk-high)';
    categoryClass = 'prs-risk-high';
  } else if (score > 30) {
    colorVar      = 'var(--risk-medium)';
    categoryClass = 'prs-risk-medium';
  } else {
    colorVar      = 'var(--risk-low)';
    categoryClass = 'prs-risk-low';
  }

  // Apply color class to card
  if (card) {
    card.className = `prs-risk-card ${categoryClass}`;
  }

  // Animate score counter
  animateCounter(scoreEl, 0, score, 1200);

  // Set confidence (inverse of risk score, clamped)
  if (confidenceEl) {
    const confidence = Math.max(0, Math.min(100, 100 - score));
    confidenceEl.textContent = `${confidence}%`;
    confidenceEl.style.color = colorVar;
  }

  // Set category badge
  if (categoryEl) {
    categoryEl.textContent = `${level.toUpperCase()} RISK`;
    categoryEl.style.color = colorVar;
  }
}

// rAF handle for the score counter animation — cancelled before each new analysis
// so a rapid double-scan cannot leave two competing loops writing to the same DOM node.
let counterFrameId = null;

function animateCounter(element, start, end, duration) {
  if (!element || !element.parentNode) {
    console.warn('[Content] animateCounter: Element not found or already removed');
    return;
  }

  // Cancel any in-flight animation before starting a new one
  if (counterFrameId !== null) {
    cancelAnimationFrame(counterFrameId);
    counterFrameId = null;
  }

  const startTime = Date.now();

  const step = () => {
    // Check if element is still in the document
    if (!element.parentNode) {
      counterFrameId = null;
      return; // Element was removed, stop animation
    }

    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const current = Math.floor(start + (end - start) * easeOutCubic(progress));
    element.textContent = current;

    if (progress < 1) {
      counterFrameId = requestAnimationFrame(step);
    } else {
      counterFrameId = null;
    }
  };

  step();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function formatTestCoverage(coverage) {
  if (typeof coverage === 'number') {
    if (coverage >= 80) return `${coverage}% (Good)`;
    if (coverage >= 60) return `${coverage}% (Below Avg)`;
    if (coverage >= 40) return `${coverage}% (Low)`;
    return `${coverage}% (Poor)`;
  }
  // Extract percentage from string and reformat
  const match = String(coverage).match(/(\d+)/);
  if (match) {
    const pct = parseInt(match[1], 10);
    return formatTestCoverage(pct);
  }
  return coverage;
}

function getTestCoverageClass(coverage) {
  if (typeof coverage === 'number') {
    if (coverage > 70) return 'prs-coverage-good';
    if (coverage > 40) return 'prs-coverage-fair';
    return 'prs-coverage-poor';
  }
  // Extract percentage from string if exists
  const match = String(coverage).match(/(\d+)/);
  if (match) {
    const percent = parseInt(match[1], 10);
    if (percent > 70) return 'prs-coverage-good';
    if (percent > 40) return 'prs-coverage-fair';
    return 'prs-coverage-poor';
  }
  return 'prs-coverage-fair';
}

function formatCommitQuality(quality) {
  const mapping = {
    'good':              '9/10',
    'could be clearer':  '6/10',
    'needs improvement': '3/10',
    'not applicable':    '—'
  };
  return mapping[quality?.toLowerCase()] || quality;
}

function getCommitQualityExplanation(quality) {
  const explanations = {
    'good': 'Excellent - Follows conventions, clear and descriptive',
    'could be clearer': 'Good - Could be more specific or follow better practices',
    'needs improvement': 'Needs Work - Vague or lacks important details',
    'not applicable': 'Not Applicable - No commit message to evaluate'
  };
  return explanations[quality?.toLowerCase()] || '';
}

// ============================================================================
// RENDER ISSUE CARDS — structured cards from fileSuggestions, with Pro gating
// ============================================================================

function renderIssueCards(analysis, plan) {
  const container = document.getElementById('prs-issues-list');
  const lockedEl  = document.getElementById('prs-issues-locked');
  if (!container) return;

  container.innerHTML = '';
  if (lockedEl) lockedEl.style.display = 'none';

  // Flatten fileSuggestions into individual issue cards
  const flat = [];
  (analysis.fileSuggestions || []).forEach(f => {
    (f.issues || []).forEach(issue => {
      flat.push({
        file:     f.file || '',
        severity: (f.severity || 'medium').toLowerCase(),
        title:    typeof issue === 'string' ? issue : (issue.description || ''),
        impact:   typeof issue === 'string' ? ''    : (issue.suggestion  || '')
      });
    });
  });

  // Fall back to topIssues string array when fileSuggestions is absent
  if (flat.length === 0) {
    (analysis.topIssues || analysis.issues || []).forEach(issue => {
      flat.push({
        file:     '',
        severity: 'medium',
        title:    typeof issue === 'string' ? issue : (issue.title || ''),
        impact:   ''
      });
    });
  }

  const FREE_LIMIT = 3;
  const visible    = plan === 'FREE' ? flat.slice(0, FREE_LIMIT) : flat;
  const hidden     = plan === 'FREE' ? Math.max(0, flat.length - FREE_LIMIT) : 0;

  visible.forEach(issue => {
    const sev  = issue.severity || 'medium';
    const file = issue.file ? issue.file.split('/').pop() : '';
    const card = document.createElement('div');
    card.className = `prs-issue-card prs-issue-${sev}`;
    card.innerHTML = `
      <div class="prs-issue-header">
        <span class="prs-issue-badge prs-badge-${sev}">${sev.toUpperCase()}</span>
        ${file ? `<span class="prs-issue-file">${escapeHTML(file)}</span>` : ''}
      </div>
      ${issue.title  ? `<div class="prs-issue-title">${escapeHTML(issue.title)}</div>`  : ''}
      ${issue.impact ? `<div class="prs-issue-impact">${escapeHTML(issue.impact)}</div>` : ''}
    `;
    container.appendChild(card);
  });

  // Pro gate: show locked count row
  if (hidden > 0 && lockedEl) {
    lockedEl.style.display = 'block';
    lockedEl.innerHTML = `
      <div class="prs-issues-gate">
        <span class="prs-gate-icon">🔒</span>
        <span class="prs-gate-text">${hidden} additional issue${hidden !== 1 ? 's' : ''} detected</span>
        <span class="prs-gate-badge">Pro Only</span>
      </div>
    `;
  }
}

function displayResults(analysis, plan = 'FREE') {
  // Get risk score and level
  // Prefer the numeric riskScore returned directly by the AI (0-100 range).
  // Fall back to level-to-score mapping for backward compatibility.
  const riskLevel = analysis.riskLevel || 'Medium';
  const riskScore = (typeof analysis.riskScore === 'number' && analysis.riskScore >= 0 && analysis.riskScore <= 100)
    ? analysis.riskScore
    : getRiskScore(riskLevel);

  // Feature gating is handled by PlanManager.isFeatureEnabled() and renderProFeatures()

  // ===== Animate Risk Card =====
  animateRiskometer(riskScore, riskLevel);

  // ===== PR Metadata Stats =====
  const meta = analysis._meta || {};
  const metaFiles    = document.getElementById('prs-meta-files');
  const metaAdded    = document.getElementById('prs-meta-added');
  const metaRemoved  = document.getElementById('prs-meta-removed');
  const metaSecurity = document.getElementById('prs-meta-security');
  const metaSecWrap  = document.getElementById('prs-meta-security-wrap');

  if (metaFiles)   metaFiles.textContent   = meta.filesChanged  || 0;
  if (metaAdded)   metaAdded.textContent   = `+${meta.linesAdded   || 0}`;
  if (metaRemoved) metaRemoved.textContent = `−${meta.linesRemoved || 0}`;
  if (meta.securityFiles > 0 && metaSecurity && metaSecWrap) {
    metaSecurity.textContent = meta.securityFiles;
    metaSecWrap.style.display = '';
  }

  // ===== Summary (Limited to 3-4 points for FREE) =====
  const summaryList = document.getElementById('prs-summary-list');
  if (summaryList) {
    summaryList.innerHTML = '';
    const summaryPoints = analysis.summary || [];
    // FREE users see 3 points, PRO users see all
    const maxPoints = plan === 'FREE' ? 3 : 5;
    const displayPoints = summaryPoints.slice(0, maxPoints);

    displayPoints.forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      summaryList.appendChild(li);
    });

    // Add "PRO" indicator if summary is truncated
    if (plan === 'FREE' && summaryPoints.length > maxPoints) {
      const li = document.createElement('li');
      li.innerHTML = `<em class="prs-limited-indicator">⭐ Pro unlock: ${summaryPoints.length - maxPoints} more insights</em>`;
      summaryList.appendChild(li);
    }
  }

  // ===== Security Issues (LIMITED for FREE plan) =====
  const securityContainer = document.getElementById('prs-security-section-container');
  const securityList = document.getElementById('prs-security-issues');
  if (securityContainer && securityList && analysis.securityIssues) {
    const issues = analysis.securityIssues;
    const hasRealIssues = issues.length > 0 && !issues.includes('None detected');

    if (hasRealIssues) {
      securityList.innerHTML = '';

      // For FREE users: show only first issue + overlay
      const issuesToShow = plan === 'FREE' ? issues.slice(0, 1) : issues;
      const hiddenCount = plan === 'FREE' ? Math.max(0, issues.length - 1) : 0;

      issuesToShow.forEach((issue) => {
        const li = document.createElement('li');
        li.textContent = issue;
        securityList.appendChild(li);
      });

      // Add pro unlock overlay if FREE and issues hidden
      if (hiddenCount > 0) {
        const proOverlay = document.createElement('div');
        proOverlay.className = 'prs-pro-unlock-overlay';
        proOverlay.innerHTML = `
          <div class="prs-pro-unlock-content">
            <div class="prs-unlock-icon">🔒</div>
            <div class="prs-unlock-text">Unlock Pro to view ${hiddenCount} more ${hiddenCount === 1 ? 'issue' : 'issues'}</div>
          </div>
        `;
        securityContainer.style.position = 'relative';
        securityContainer.appendChild(proOverlay);
      }

      securityContainer.style.display = 'block';
    } else {
      securityContainer.style.display = 'none';
    }
  }

  // ===== Breaking Changes =====
  const breakingContainer = document.getElementById('prs-breaking-section-container');
  const breakingList = document.getElementById('prs-breaking-changes');
  if (breakingContainer && breakingList && analysis.breakingChanges) {
    const changes = analysis.breakingChanges;
    const hasRealChanges = changes.length > 0 && !changes.includes('None detected');

    if (hasRealChanges) {
      breakingList.innerHTML = '';
      changes.forEach((change) => {
        const li = document.createElement('li');
        li.textContent = change;
        breakingList.appendChild(li);
      });
      breakingContainer.style.display = 'block';
    } else {
      breakingContainer.style.display = 'none';
    }
  }

  // ===== Test Coverage & Commit Quality =====
  const testCoverage = document.getElementById('prs-test-coverage');
  if (testCoverage && analysis.testCoverage) {
    testCoverage.textContent = formatTestCoverage(analysis.testCoverage);
    testCoverage.className = `prs-quality-value ${getTestCoverageClass(analysis.testCoverage)}`;
  }

  const commitQuality = document.getElementById('prs-commit-quality');
  if (commitQuality && analysis.commitMessageQuality) {
    commitQuality.textContent = formatCommitQuality(analysis.commitMessageQuality);
    commitQuality.title = getCommitQualityExplanation(analysis.commitMessageQuality);
    commitQuality.classList.add('prs-grade-badge');
  }

  // ===== Suggested Commit Message ===== (PRO FEATURE)
  const commitContainer = document.getElementById('prs-commit-suggestion-container');
  const commitTextarea = document.getElementById('prs-suggested-commit');

  // Check if Suggested Commit Message feature is enabled
  const canSuggestCommitMessage = PlanManager && PlanManager.isFeatureEnabled('canSuggestCommitMessage');

  if (commitContainer && commitTextarea && analysis.suggestedCommitMessage && canSuggestCommitMessage) {
    const message = analysis.suggestedCommitMessage;
    if (!message.includes('No change suggested')) {
      commitTextarea.value = message;
      commitContainer.style.display = 'block';
      setupCopyButton();
    } else {
      commitContainer.style.display = 'none';
    }
  } else if (commitContainer) {
    // Feature not available in current plan
    commitContainer.style.display = 'none';
  }

  // ===== Critical Issues (structured cards with Pro gating) =====
  renderIssueCards(analysis, plan);

  // ===== PRO FEATURES (gated by PlanManager) =====
  if (PlanManager && PlanManager.isFeatureEnabled('canShowRiskometer') && RiskEngine && UIRenderer) {
    renderProFeatures(analysis, plan);
  }

  // ===== Full Report Button (always shown after analysis, free + pro) =====
  const fullReportBtn = document.getElementById('prs-full-report-btn');
  if (fullReportBtn) {
    fullReportBtn.style.display = 'block';
  }

  // ===== View History Button (PRO users) =====
  const viewHistoryBtn = document.getElementById('prs-view-history-btn');
  if (viewHistoryBtn) {
    if (PlanManager && PlanManager.isFeatureEnabled('canAccessAnalyticsHistory') && PRHistory) {
      viewHistoryBtn.style.display = 'block';
      // Remove any existing listener first, then add new one
      viewHistoryBtn.removeEventListener('click', loadHistoryPanel);
      viewHistoryBtn.addEventListener('click', loadHistoryPanel);
    } else {
      viewHistoryBtn.style.display = 'none';
    }
  }

  // ===== Usage Counter (for FREE users) =====
  updateUsageDisplay(plan);

  // ===== LOCK PRO-ONLY SECTIONS (for FREE users) =====
  if (plan === 'FREE' && ProFeatureGate) {
    try {
      // Lock Security Issues section
      const securityContainer = document.getElementById('prs-security-section-container');
      if (securityContainer) {
        const securityIssues = analysis.securityIssues || [];
        const hiddenCount = Math.max(0, securityIssues.length - 1);
        if (hiddenCount > 0) {
          ProFeatureGate.lockSection(
            securityContainer,
            `${hiddenCount} more security ${hiddenCount === 1 ? 'issue' : 'issues'} hidden`,
            true,
            'Full audit • All issue types • Risk scoring'
          );
        }
      }

      // Lock Critical Issues section (show first 3 in FREE)
      const criticalContainer = document.getElementById('prs-pro-critical-issues-container');
      if (criticalContainer && criticalContainer.children.length > 0) {
        ProFeatureGate.lockSection(
          criticalContainer,
          'Advanced critical issue analysis locked',
          true,
          'Full analysis • Risk prioritization • Metrics'
        );
      }

      // Lock Test Coverage section
      const testCoverageContainer = document.getElementById('prs-pro-test-coverage-container');
      if (testCoverageContainer && testCoverageContainer.children.length > 0) {
        ProFeatureGate.lockSection(
          testCoverageContainer,
          'Full test analysis & recommendations locked',
          true,
          'Coverage gaps • Recommendations • Metrics'
        );
      }

      // Lock Advanced Riskometer section
      const advancedRiskometerContainer = document.getElementById('prs-pro-advanced-riskometer-container');
      if (advancedRiskometerContainer && advancedRiskometerContainer.children.length > 0) {
        ProFeatureGate.lockSection(
          advancedRiskometerContainer,
          'Advanced risk breakdown & trends locked',
          true,
          'Trends • Comparisons • Historical data'
        );
      }
    } catch (error) {
      console.warn('[Content] Error applying pro feature locks:', error);
    }
  }
}

/**
 * Update and display usage counter for FREE users
 * @param {string} plan - 'FREE' or 'PRO'
 */
async function updateUsageDisplay(plan = 'FREE') {
  if (plan === 'PRO') {
    const usageDisplay = document.getElementById('prs-usage-display');
    if (usageDisplay) usageDisplay.style.display = 'none';
    return;
  }

  try {
    const usageStatus  = await UsageLimiter.canAnalyze(plan);
    const usageDisplay = document.getElementById('prs-usage-display');
    const usageText    = document.getElementById('prs-usage-text');
    const usageBarFill = document.getElementById('prs-usage-bar-fill');
    const upgradeCta   = document.getElementById('prs-upgrade-cta');

    if (!usageDisplay || !usageText || !usageBarFill) return;

    usageDisplay.style.display = 'block';

    // Human-readable text: "3 of 5 Free Scans Used Today"
    usageText.textContent = `${usageStatus.used} of ${usageStatus.limit} Free Scans Used Today`;

    // Progress bar
    const pct = Math.min(100, (usageStatus.used / usageStatus.limit) * 100);
    usageBarFill.style.width = pct + '%';

    // Warning states
    if (usageStatus.remaining <= 0) {
      // Limit hit — red glow + show Upgrade CTA
      usageBarFill.style.background = 'var(--neon-red)';
      usageText.style.color = 'var(--neon-red)';
      usageDisplay.classList.add('prs-usage-warn');
      if (upgradeCta) upgradeCta.style.display = 'block';
    } else if (usageStatus.remaining <= 1) {
      // Last scan — amber warning glow
      usageBarFill.style.background = 'linear-gradient(90deg, var(--neon-yellow), var(--neon-red))';
      usageText.style.color = 'var(--neon-yellow)';
      usageDisplay.classList.add('prs-usage-warn');
      if (upgradeCta) upgradeCta.style.display = 'block';
    } else {
      usageBarFill.style.background = 'linear-gradient(90deg, var(--neon-green), var(--neon-blue))';
      usageText.style.color = 'var(--text-secondary)';
      usageDisplay.classList.remove('prs-usage-warn');
      if (upgradeCta) upgradeCta.style.display = 'none';
    }
  } catch (error) {
    console.error('[Content] Error updating usage display:', error);
  }
}

/**
 * Render advanced PRO-only features (gated by PlanManager)
 * @param {object} analysis - OpenAI analysis result
 * @param {string} plan - Current plan (should be PRO)
 */
function renderProFeatures(analysis = {}, plan = 'PRO') {
  // Hard gate: don't render PRO content into the DOM for FREE users.
  // This means there is nothing to un-blur via DevTools — the containers stay empty.
  if (plan !== 'PRO') return;

  try {
    console.log('[Content] Rendering PRO features...');

    // ===== 1. ADVANCED SECURITY AUDIT =====
    if (PlanManager && PlanManager.isFeatureEnabled('canShowFullSecurityAudit')) {
      const securityContainer = document.getElementById('prs-pro-security-audit-container');
      if (securityContainer) {
        try {
          if (!RiskEngine) {
            console.warn('[Content] RiskEngine not available for security audit');
            securityContainer.style.display = 'none';
          } else {
            const securityIssues = analysis.securityIssues || [];
            const enhancedIssues = RiskEngine.calculateSecurityRisk(securityIssues);

            if (!UIRenderer) {
              console.warn('[Content] UIRenderer not available for security audit');
              securityContainer.style.display = 'none';
            } else {
              const securityAuditUI = UIRenderer.renderSecurityAudit(enhancedIssues);
              if (securityAuditUI) {
                securityContainer.innerHTML = '';
                securityContainer.appendChild(securityAuditUI);
                securityContainer.style.display = 'block';
              }
            }
          }
        } catch (error) {
          console.error('[Content] Error rendering advanced security audit:', error);
          securityContainer.style.display = 'none';
          // Continue with other features
        }
      }
    }

    // ===== 2. BREAKING CHANGES ANALYSIS =====
    if (PlanManager && PlanManager.isFeatureEnabled('canShowAllBreakingChanges')) {
      const breakingContainer = document.getElementById('prs-pro-breaking-changes-container');
      if (breakingContainer) {
        try {
          if (!RiskEngine) {
            console.warn('[Content] RiskEngine not available for breaking changes');
            breakingContainer.style.display = 'none';
          } else {
            const breakingChanges = analysis.breakingChanges || [];
            const enhancedBreaking = RiskEngine.detectBreakingChanges({ breakingChanges });

            if (!UIRenderer) {
              console.warn('[Content] UIRenderer not available for breaking changes');
              breakingContainer.style.display = 'none';
            } else {
              const breakingUI = UIRenderer.renderBreakingChangesPanel(enhancedBreaking);
              if (breakingUI) {
                breakingContainer.innerHTML = '';
                breakingContainer.appendChild(breakingUI);
                breakingContainer.style.display = 'block';
              }
            }
          }
        } catch (error) {
          console.error('[Content] Error rendering breaking changes:', error);
          breakingContainer.style.display = 'none';
          // Continue with other features
        }
      }
    }

    // ===== 3. TEST COVERAGE ANALYSIS =====
    if (PlanManager && PlanManager.isFeatureEnabled('canAnalyzeTestCoverage')) {
      const testCoverageContainer = document.getElementById('prs-pro-test-coverage-container');
      if (testCoverageContainer && analysis.testCoverage) {
        try {
          if (!RiskEngine) {
            console.warn('[Content] RiskEngine not available for test coverage');
            testCoverageContainer.style.display = 'none';
          } else {
            const coverageAnalysis = RiskEngine.analyzeTestCoverage(analysis);

            if (!UIRenderer) {
              console.warn('[Content] UIRenderer not available for test coverage');
              testCoverageContainer.style.display = 'none';
            } else {
              const testCoverageUI = UIRenderer.renderTestCoveragePanel(coverageAnalysis);
              if (testCoverageUI) {
                testCoverageContainer.innerHTML = '';
                testCoverageContainer.appendChild(testCoverageUI);
                testCoverageContainer.style.display = 'block';

                // Add copy button listener for test skeleton
                setupTestSkeletonCopyButtons();
              }
            }
          }
        } catch (error) {
          console.error('[Content] Error rendering test coverage analysis:', error);
          testCoverageContainer.style.display = 'none';
          // Continue with other features
        }
      }
    }

    // ===== 4. CRITICAL ISSUES PANEL =====
    if (PlanManager && PlanManager.isFeatureEnabled('canShowCriticalIssues')) {
      const criticalContainer = document.getElementById('prs-pro-critical-issues-container');
      if (criticalContainer && RiskEngine) {
        try {
          const allSecurityIssues = RiskEngine.calculateSecurityRisk(analysis.securityIssues || []);

          if (!UIRenderer) {
            console.warn('[Content] UIRenderer not available for critical issues');
            criticalContainer.style.display = 'none';
          } else {
            const criticalUI = UIRenderer?.renderCriticalIssuesPanel(allSecurityIssues, 5);
            if (criticalUI) {
              criticalContainer.innerHTML = '';
              criticalContainer.appendChild(criticalUI);
              criticalContainer.style.display = 'block';
            } else {
              criticalContainer.style.display = 'none';
            }
          }
        } catch (error) {
          console.error('[Content] Error rendering critical issues:', error);
          criticalContainer.style.display = 'none';
          // Continue with other features
        }
      }
    }

    // ===== 5. ADVANCED RISKOMETER =====
    if (PlanManager && PlanManager.isFeatureEnabled('canShowRiskometer')) {
      const advancedRiskometerContainer = document.getElementById('prs-pro-advanced-riskometer-container');
      if (advancedRiskometerContainer && RiskEngine) {
        try {
          if (!UIRenderer) {
            console.warn('[Content] UIRenderer not available for advanced riskometer');
            advancedRiskometerContainer.style.display = 'none';
          } else {
            const breakdown = RiskEngine.calculateRiskBreakdown(analysis);
            const repoName = extractRepoName(window.location.href);

            RiskEngine.compareTrendToPreviousPR(analysis.riskScore || 0, repoName)
              .then((trend) => {
                try {
                  const totalRisk = RiskEngine.calculateOverallRiskScore(analysis);
                  const advancedRiskometerUI = UIRenderer.renderAdvancedRiskometer(breakdown, trend, totalRisk);
                  if (advancedRiskometerUI) {
                    advancedRiskometerContainer.innerHTML = '';
                    advancedRiskometerContainer.appendChild(advancedRiskometerUI);
                    advancedRiskometerContainer.style.display = 'block';
                  } else {
                    advancedRiskometerContainer.style.display = 'none';
                  }
                } catch (error) {
                  console.error('[Content] Error processing advanced riskometer data:', error);
                  advancedRiskometerContainer.style.display = 'none';
                }
              })
              .catch((error) => {
                console.warn('[Content] Error fetching riskometer trend data:', error);
                advancedRiskometerContainer.style.display = 'none';
              });
          }
        } catch (error) {
          console.error('[Content] Error setting up advanced riskometer:', error);
          advancedRiskometerContainer.style.display = 'none';
          // Continue with other features
        }
      }
    }

    console.log('[Content] PRO features rendered successfully');
  } catch (error) {
    console.error('[Content] Critical error in renderProFeatures:', error);
    // If there's a critical error, hide all pro feature containers gracefully
    const proContainers = [
      'prs-pro-security-audit-container',
      'prs-pro-breaking-changes-container',
      'prs-pro-test-coverage-container',
      'prs-pro-critical-issues-container',
      'prs-pro-advanced-riskometer-container'
    ];
    proContainers.forEach(id => {
      const container = document.getElementById(id);
      if (container) container.style.display = 'none';
    });
  }
}

/**
 * Extract repository name from GitHub URL
 * @param {string} url - Current URL
 * @returns {string} Repository identifier
 */
function extractRepoName(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\//);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return 'unknown';
}

/**
 * Setup copy button for test skeleton
 */
function setupTestSkeletonCopyButtons() {
  const copyBtns = document.querySelectorAll('[data-copy]');
  copyBtns.forEach((btn) => {
    // Remove existing listener if any
    // Create a new handler function and store it for cleanup
    const handler = async (e) => {
      const content = btn.getAttribute('data-copy');
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
          const originalText = btn.textContent;
          btn.textContent = '✅ COPIED!';
          btn.style.opacity = '0.7';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.opacity = '1';
          }, 2000);
        } catch (error) {
          console.error('[Content] Error copying to clipboard:', error);
        }
      }
    };

    // Store handler reference for cleanup
    btn._copyHandler = handler;
    btn.addEventListener('click', handler);
  });
}

function setupCopyButton() {
  const copyBtn = document.getElementById('prs-copy-commit-btn');
  if (!copyBtn) return;

  // Remove existing listener if any
  if (copyBtn._copyCommitHandler) {
    copyBtn.removeEventListener('click', copyBtn._copyCommitHandler);
  }

  // Create handler and store reference
  const handler = async () => {
    const textarea = document.getElementById('prs-suggested-commit');
    if (!textarea) return;

    try {
      await navigator.clipboard.writeText(textarea.value);

      // Animate button feedback
      copyBtn.classList.add('copied');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ COPIED!';

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Store handler for cleanup and add listener
  copyBtn._copyCommitHandler = handler;
  copyBtn.addEventListener('click', handler);
}

function showError(message) {
  const errorDiv = document.getElementById('prs-error');
  errorDiv.textContent = message;
  showElement('prs-error');
}

function showWarning(message) {
  const warningDiv = document.getElementById('prs-warning');
  if (warningDiv) {
    warningDiv.textContent = message;
    showElement('prs-warning');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showElement(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'block';
  }
}

function hideElement(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'none';
  }
}

// ============================================================================
// HISTORY PANEL FUNCTIONS (PRO FEATURE)
// ============================================================================

/**
 * Setup event listeners for history panel
 */
function setupHistoryEventListeners() {
  // History close button
  const historyCloseBtn = document.getElementById('prs-history-close-btn');
  if (historyCloseBtn) {
    historyCloseBtn.addEventListener('click', () => {
      hideElement('prs-history-panel');
      showElement('prs-results');
    });
  }

  // Detail back button
  const detailBackBtn = document.getElementById('prs-detail-back-btn');
  if (detailBackBtn) {
    detailBackBtn.addEventListener('click', showHistoryList);
  }

  // Copy text button
  const copyTextBtn = document.getElementById('prs-copy-text-btn');
  if (copyTextBtn) {
    copyTextBtn.addEventListener('click', copyReportToClipboard);
  }

  // Copy JSON button
  const copyJsonBtn = document.getElementById('prs-copy-json-btn');
  if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', copyJsonToClipboard);
  }

  // Print PDF button
  const printPdfBtn = document.getElementById('prs-print-pdf-btn');
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', printReportPdf);
  }

  // Delete button
  const deleteBtn = document.getElementById('prs-delete-history-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteCurrentHistoryItem);
  }

  // Clear history button
  const clearBtn = document.getElementById('prs-clear-history-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllHistory);
  }
}

/**
 * Load and display PR history
 */
async function loadHistoryPanel() {
  if (!state.isProUser || !PRHistory) {
    console.log('[Content] History not available for non-PRO users');
    return;
  }

  try {
    hideElement('prs-results');
    showElement('prs-history-panel');
    hideElement('prs-history-detail');
    showElement('prs-history-list');

    // Load history
    const history = await PRHistory.getHistory();

    if (history.length === 0) {
      document.getElementById('prs-history-list').innerHTML = '<div class="prs-empty-history">No scan history yet</div>';
      hideElement('prs-history-stats');
      return;
    }

    // Load statistics
    const stats = await PRHistory.getStatistics();
    updateHistoryStats(stats);
    showElement('prs-history-stats');

    // Render history list
    renderHistoryList(history);
  } catch (error) {
    console.error('[Content] Error loading history panel:', error);
    showError('Failed to load history: ' + error.message);
  }
}

/**
 * Update history statistics display
 */
function updateHistoryStats(stats) {
  const totalEl = document.getElementById('prs-stat-total');
  const avgEl = document.getElementById('prs-stat-avg');
  const highEl = document.getElementById('prs-stat-high');

  if (totalEl) totalEl.textContent = stats.totalAnalyzed || 0;
  if (avgEl) avgEl.textContent = (stats.averageRisk || 0) + '%';
  if (highEl) highEl.textContent = stats.highRiskCount || 0;
}

/**
 * Render history list items
 */
function renderHistoryList(history) {
  const list = document.getElementById('prs-history-list');
  list.innerHTML = '';

  history.forEach((item) => {
    const listItem = document.createElement('div');
    listItem.className = `prs-history-item prs-risk-${item.analysis.riskLevel.toLowerCase()}`;
    listItem.innerHTML = `
      <div class="prs-history-item-main" data-history-id="${escapeHTML(String(item.id))}">
        <div class="prs-history-pr-title">${escapeHTML(item.pr.title)}</div>
        <div class="prs-history-pr-meta">
          <span class="prs-history-repo">${escapeHTML(item.pr.repo)}</span>
          <span class="prs-history-date">${escapeHTML(item.date)}</span>
        </div>
        <div class="prs-history-item-footer">
          <span class="prs-risk-badge prs-risk-${escapeHTML(item.analysis.riskLevel.toLowerCase())}">
            ${escapeHTML(String(item.analysis.riskScore))} / 100
          </span>
          <span class="prs-history-summary">${escapeHTML(item.analysis.summary[0] || 'No summary')}</span>
        </div>
      </div>
    `;

    listItem.addEventListener('click', () => {
      showHistoryDetail(item.id);
    });

    list.appendChild(listItem);
  });
}

/**
 * Show history detail view
 */
async function showHistoryDetail(historyId) {
  try {
    const item = await PRHistory.getHistoryItem(historyId);
    if (!item) {
      showError('History item not found');
      return;
    }

    // Store current item for export functions (using state instead of window)
    state.currentHistoryItem = item;

    // Update header
    document.getElementById('prs-detail-title').textContent = item.pr.title;

    // Render detail content
    const detailContent = document.getElementById('prs-detail-content');
    detailContent.innerHTML = `
      <div class="prs-detail-section">
        <div class="prs-detail-section-title">Repository</div>
        <div class="prs-detail-value">${escapeHTML(item.pr.repo)}</div>
      </div>

      <div class="prs-detail-section">
        <div class="prs-detail-section-title">Risk Assessment</div>
        <div class="prs-risk-display prs-risk-${escapeHTML(item.analysis.riskLevel.toLowerCase())}">
          <div class="prs-risk-score">${escapeHTML(String(item.analysis.riskScore))}</div>
          <div class="prs-risk-level">${escapeHTML(item.analysis.riskLevel)}</div>
        </div>
      </div>

      <div class="prs-detail-section">
        <div class="prs-detail-section-title">Metrics</div>
        <div class="prs-detail-metrics">
          <div class="prs-metric-item">
            <span class="prs-metric-label">Test Coverage:</span>
            <span class="prs-metric-value">${escapeHTML(String(item.analysis.testCoverage || ''))}</span>
          </div>
          <div class="prs-metric-item">
            <span class="prs-metric-label">Commit Quality:</span>
            <span class="prs-metric-value">${escapeHTML(String(item.analysis.commitQuality || ''))}</span>
          </div>
          <div class="prs-metric-item">
            <span class="prs-metric-label">Files Changed:</span>
            <span class="prs-metric-value">${escapeHTML(String(item.pr.files || 0))}</span>
          </div>
          <div class="prs-metric-item">
            <span class="prs-metric-label">Issues Found:</span>
            <span class="prs-metric-value">${escapeHTML(String(item.analysis.securityIssuesCount || 0))}</span>
          </div>
        </div>
      </div>

      <div class="prs-detail-section">
        <div class="prs-detail-section-title">Key Findings</div>
        <ul class="prs-findings-list">
          ${item.analysis.summary.map(point => `<li>${escapeHTML(point)}</li>`).join('')}
        </ul>
      </div>

      <div class="prs-detail-section">
        <div class="prs-detail-section-title">Scan Details</div>
        <div class="prs-detail-timestamp">Scanned: ${escapeHTML(item.date)} ${escapeHTML(item.time)}</div>
      </div>
    `;

    // Hide list, show detail
    hideElement('prs-history-list');
    showElement('prs-history-detail');
  } catch (error) {
    console.error('[Content] Error showing history detail:', error);
    showError('Failed to load detail: ' + error.message);
  }
}

/**
 * Go back to history list view
 */
function showHistoryList() {
  hideElement('prs-history-detail');
  showElement('prs-history-list');
}

/**
 * Copy report as plain text to clipboard
 */
async function copyReportToClipboard() {
  const item = state.currentHistoryItem;
  if (!item) return;

  try {
    const report = PRHistory.generateStructuredReport(item);
    await navigator.clipboard.writeText(report);

    showClipboardFeedback('Copy Text');
  } catch (error) {
    console.error('[Content] Error copying to clipboard:', error);
    showError('Failed to copy to clipboard');
  }
}

/**
 * Copy report as JSON to clipboard
 */
async function copyJsonToClipboard() {
  const item = state.currentHistoryItem;
  if (!item) return;

  try {
    const json = PRHistory.generateJsonReport(item);
    await navigator.clipboard.writeText(json);

    showClipboardFeedback('Copy JSON');
  } catch (error) {
    console.error('[Content] Error copying JSON:', error);
    showError('Failed to copy JSON');
  }
}

/**
 * Show copy feedback
 */
function showClipboardFeedback(buttonId) {
  const btn = document.getElementById('prs-' + buttonId.toLowerCase().replace(' ', '-') + '-btn');
  if (!btn) return;

  const originalText = btn.textContent;
  btn.textContent = '✅ COPIED!';
  btn.style.opacity = '0.7';

  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.opacity = '1';
  }, 2000);
}

/**
 * Print report as PDF
 */
function printReportPdf() {
  const item = state.currentHistoryItem;
  if (!item) return;

  try {
    const html = PRHistory.generateHtmlReport(item);

    // Open in new window for printing
    const newWindow = window.open('', '', 'width=900,height=800');
    newWindow.document.write(html);
    newWindow.document.close();

    // Trigger print after content loads
    setTimeout(() => {
      newWindow.print();
    }, 500);
  } catch (error) {
    console.error('[Content] Error printing PDF:', error);
    showError('Failed to generate PDF');
  }
}

/**
 * Delete current history item
 */
async function deleteCurrentHistoryItem() {
  const item = state.currentHistoryItem;
  if (!item) return;

  if (!confirm('Delete this PR analysis from history?')) {
    return;
  }

  try {
    await PRHistory.deleteHistoryItem(item.id);
    console.log('[Content] Deleted history item:', item.id);

    // Reload history list
    showHistoryList();
    await loadHistoryPanel();
  } catch (error) {
    console.error('[Content] Error deleting history item:', error);
    showError('Failed to delete item');
  }
}

/**
 * Clear all history
 */
async function clearAllHistory() {
  if (!confirm('Clear all PR scan history? This cannot be undone.')) {
    return;
  }

  try {
    await PRHistory.clearHistory();
    console.log('[Content] Cleared all history');

    // Reload history panel
    await loadHistoryPanel();
  } catch (error) {
    console.error('[Content] Error clearing history:', error);
    showError('Failed to clear history');
  }
}

/**
 * Helper: Escape HTML in text
 */
function escapeHTML(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// LICENSE CHANGE LISTENER
// Re-validates license whenever chrome.storage changes (e.g. popup applies key)
// This also closes the window where a console attacker manually writes storage:
// the re-validation runs LicenseManager.getCurrentPlan() → LicenseValidator HMAC check.
// ============================================================================
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (!changes.licenseKey && !changes.proLicense) return;

    try {
      // Re-validate from scratch — goes through LicenseValidator HMAC path
      const newPlan = await LicenseManager.getCurrentPlan();
      const newIsProUser = newPlan === 'PRO';

      state.currentPlan = newPlan;
      state.isProUser = newIsProUser;

      // Refresh PlanManager in-memory state via validated re-check
      if (typeof PlanManager !== 'undefined') {
        await PlanManager.refresh();
      }

      // Update visual lock state
      if (typeof ProFeatureGate !== 'undefined') {
        ProFeatureGate.setProUser(newIsProUser);
      }

      console.log('[Content] License re-validated after storage change. Plan:', newPlan);

      // Prompt reload so PRO content sections are fully rendered
      if (newIsProUser) {
        showWarning('✓ Pro license activated. Reload the page to unlock all Pro features.');
      }
    } catch (error) {
      console.warn('[Content] Error re-validating license after storage change:', error);
    }
  });
}

// ============================================================================
// GITHUB SPA NAVIGATION HANDLER
// GitHub is a single-page app: navigating between PRs uses pushState and does
// NOT reload the page, so the content script does not re-inject. We observe
// document.title via MutationObserver (GitHub updates it on every navigation)
// to detect URL transitions between PR pages and reset the panel for the new PR.
// ============================================================================
(function observeGitHubNavigation() {
  let lastHref = location.href;

  const titleObserver = new MutationObserver(() => {
    const currentHref = location.href;
    if (currentHref === lastHref) return;

    lastHref = currentHref;

    const isNewPR = currentHref.includes('/pull/');

    if (!isNewPR) return;

    console.log('[Content] GitHub SPA navigation detected — resetting panel for new PR');

    // Cancel any in-flight rAF counter animation from the previous PR
    if (counterFrameId !== null) {
      cancelAnimationFrame(counterFrameId);
      counterFrameId = null;
    }

    // Reset analysis state
    state.isAnalyzing = false;

    // Reset panel UI: hide results, show scan button, hide loading
    const resultsEl = document.getElementById('prs-results');
    const analyzeBtn = document.getElementById('prs-analyze-btn');
    const loadingEl = document.getElementById('prs-loading');

    if (resultsEl) resultsEl.style.display = 'none';
    if (analyzeBtn) analyzeBtn.style.display = 'block';
    if (loadingEl) loadingEl.style.display = 'none';

    // Clear any warning/error banners from the previous PR
    const warningEl = document.getElementById('prs-warning');
    const errorEl = document.getElementById('prs-error');
    if (warningEl) warningEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
  });

  // document.title is a text node child of <head><title>; observing head covers it.
  const titleEl = document.querySelector('head > title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true });
  }
})();
