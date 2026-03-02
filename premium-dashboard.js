// ============================================================================
// PREMIUM CYBERPUNK DASHBOARD - RISKOMETER & INTERACTIONS
// ============================================================================

/**
 * Animate the riskometer SVG circle based on risk score
 * @param {number} score - Risk score (0-100)
 * @param {string} level - Risk level (Low/Medium/High)
 */
function animateRiskometer(score, level) {
  const circle = document.getElementById('prs-risk-circle');
  const scoreText = document.getElementById('prs-risk-score-text');
  const levelText = document.getElementById('prs-risk-level-display');

  if (!circle || !scoreText) return;

  // Determine color based on score
  let color = '#39FF14'; // Green (Low)
  if (score > 70) {
    color = '#FF1744'; // Red (High)
  } else if (score > 30) {
    color = '#FFD600'; // Yellow (Medium)
  }

  // Calculate stroke-dashoffset (0-100 maps to 565-0)
  const circumference = 565;
  const offset = circumference - (score / 100) * circumference;

  // Animate circle
  circle.style.setProperty('--transition-duration', '1.2s');
  circle.style.stroke = color;
  circle.style.filter = `drop-shadow(0 0 12px ${color})`;
  circle.style.transition = `stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)`;
  circle.style.strokeDashoffset = offset;

  // Animate score number
  animateCounter(scoreText, 0, score, 1200);

  // Set level text with color
  levelText.textContent = level.toUpperCase();
  levelText.style.color = color;
}

/**
 * Animate a counter from start to end
 * @param {HTMLElement} element - Element to update
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} duration - Duration in ms
 */
function animateCounter(element, start, end, duration) {
  const startTime = Date.now();
  const step = () => {
    const progress = Math.min((Date.now() - startTime) / duration, 1);
    const current = Math.floor(start + (end - start) * easeOutCubic(progress));
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  step();
}

/** Easing function */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Get risk color based on level
 */
function getRiskColor(level) {
  switch (level?.toLowerCase()) {
    case 'low':
      return '#39FF14'; // Neon Green
    case 'medium':
      return '#FFD600'; // Neon Yellow
    case 'high':
      return '#FF1744'; // Neon Red
    default:
      return '#00F5FF'; // Neon Blue
  }
}

/**
 * Get risk score (0-100) based on level
 * This is a subjective mapping for demo purposes
 */
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

/**
 * Format test coverage value (numeric to text)
 */
function formatTestCoverage(coverage) {
  if (typeof coverage === 'number') {
    if (coverage > 70) return `${coverage}% - GOOD`;
    if (coverage > 40) return `${coverage}% - FAIR`;
    return `${coverage}% - POOR`;
  }
  return coverage; // Already a string like "Good/Fair/Poor"
}

/**
 * Format commit message quality (Good/Could be clearer/etc -> A/B/C/D)
 */
function formatCommitQuality(quality) {
  const mapping = {
    'good': '✓ A',
    'could be clearer': 'B',
    'needs improvement': 'C',
    'not applicable': '-'
  };
  return mapping[quality?.toLowerCase()] || quality;
}

/**
 * Display comprehensive PR analysis results
 */
function displayPremiumResults(analysis) {
  // Get risk score and level
  const riskLevel = analysis.riskLevel || 'Medium';
  const riskScore = getRiskScore(riskLevel);
  const riskColor = getRiskColor(riskLevel);

  // ===== Animate Riskometer =====
  animateRiskometer(riskScore, riskLevel);

  // ===== Summary =====
  const summaryList = document.getElementById('prs-summary-list');
  if (summaryList) {
    summaryList.innerHTML = '';
    (analysis.summary || []).forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      summaryList.appendChild(li);
    });
  }

  // ===== Risk Level Badge =====
  const riskBadge = document.getElementById('prs-risk-level');
  if (riskBadge) {
    riskBadge.textContent = `● ${riskLevel.toUpperCase()} RISK`;
    riskBadge.className = `prs-risk-badge prs-risk-${riskLevel.toLowerCase()}`;
  }

  // ===== Security Issues =====
  const securityContainer = document.getElementById('prs-security-section-container');
  const securityList = document.getElementById('prs-security-issues');
  if (securityContainer && securityList && analysis.securityIssues) {
    const issues = analysis.securityIssues;
    const hasRealIssues = issues.length > 0 && !issues.includes('None detected');

    if (hasRealIssues) {
      securityList.innerHTML = '';
      issues.forEach((issue) => {
        const li = document.createElement('li');
        li.textContent = issue;
        securityList.appendChild(li);
      });
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
  }

  const commitQuality = document.getElementById('prs-commit-quality');
  if (commitQuality && analysis.commitMessageQuality) {
    commitQuality.textContent = formatCommitQuality(analysis.commitMessageQuality);
  }

  // ===== Suggested Commit Message =====
  const commitContainer = document.getElementById('prs-commit-suggestion-container');
  const commitTextarea = document.getElementById('prs-suggested-commit');
  if (commitContainer && commitTextarea && analysis.suggestedCommitMessage) {
    const message = analysis.suggestedCommitMessage;
    if (!message.includes('No change suggested')) {
      commitTextarea.value = message;
      commitContainer.style.display = 'block';
    } else {
      commitContainer.style.display = 'none';
    }
  }

  // ===== Critical Issues =====
  const issuesList = document.getElementById('prs-issues-list');
  if (issuesList) {
    issuesList.innerHTML = '';
    const issues = analysis.topIssues || analysis.issues || [];
    issues.forEach((issue) => {
      const li = document.createElement('li');
      li.textContent = issue;
      issuesList.appendChild(li);
    });
  }
}

/**
 * Setup copy-to-clipboard button
 */
function setupCopyButton() {
  const copyBtn = document.getElementById('prs-copy-commit-btn');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    const textarea = document.getElementById('prs-suggested-commit');
    if (!textarea) return;

    try {
      await navigator.clipboard.writeText(textarea.value);

      // Animate button feedback
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✓ COPIED!';

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋 COPY TO CLIPBOARD';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    displayPremiumResults,
    animateRiskometer,
    setupCopyButton,
    getRiskScore,
    getRiskColor,
  };
}
