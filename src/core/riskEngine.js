// ============================================================================
// RISK ENGINE MODULE
// Pure logic for PRO-only advanced analysis features
// Handles: Security risk calculation, breaking changes, test coverage, trends
// ============================================================================

const RiskEngine = (() => {
  const STORAGE_KEY = 'prRiskHistory';

  /**
   * Calculate security risk with severity levels
   * @param {Array} securityIssues - Array of issue objects from OpenAI
   * @returns {Array} Issues with severity levels, CWE tags, and fixes
   */
  function calculateSecurityRisk(securityIssues = []) {
    return securityIssues.map((issue, index) => {
      const severity = determineSeverityLevel(issue);
      const cweTag = determineCWETag(issue);
      const suggestedFix = generateSecurityFix(issue);

      return {
        id: index,
        issue: issue,
        severity: severity,
        cweTag: cweTag,
        suggestedFix: suggestedFix,
        codeSnippet: extractCodeSnippet(issue),
        riskScore: calculateIssueSeverityScore(severity)
      };
    });
  }

  /**
   * Determine severity level from issue description
   * @param {string|object} issue - Issue description
   * @returns {string} 'Critical' | 'High' | 'Medium' | 'Low'
   */
  function determineSeverityLevel(issue) {
    const issueStr = typeof issue === 'string' ? issue : JSON.stringify(issue);
    const lowerIssue = issueStr.toLowerCase();

    // Critical indicators
    if (/sql injection|remote code execution|rce|xss|cross-site|credential|password|api key|secret|token|buffer overflow|privilege escalation/.test(lowerIssue)) {
      return 'Critical';
    }

    // High indicators
    if (/authentication|authorization|encryption|ssl|tls|vulnerab|exploit|bypass|dos|denial|race condition|infinite loop|null pointer|memory leak/.test(lowerIssue)) {
      return 'High';
    }

    // Medium indicators
    if (/input validation|sanitization|injection|error handling|exposure|leak|logging|debug|performance|concurrency|race|deadlock/.test(lowerIssue)) {
      return 'Medium';
    }

    // Low indicators (default)
    return 'Low';
  }

  /**
   * Map security issues to CWE categories
   * @param {string|object} issue - Issue description
   * @returns {string} CWE category identifier
   */
  function determineCWETag(issue) {
    const issueStr = typeof issue === 'string' ? issue : JSON.stringify(issue);
    const lowerIssue = issueStr.toLowerCase();

    // Common Weakness Enumeration mappings
    if (/sql injection/.test(lowerIssue)) return 'CWE-89';
    if (/xss|cross-site|script injection/.test(lowerIssue)) return 'CWE-79';
    if (/command injection|os command/.test(lowerIssue)) return 'CWE-78';
    if (/csrf|cross-site request/.test(lowerIssue)) return 'CWE-352';
    if (/broken authentication|auth/.test(lowerIssue)) return 'CWE-287';
    if (/sensitive data|exposure|leak/.test(lowerIssue)) return 'CWE-200';
    if (/encryption|cryptographic/.test(lowerIssue)) return 'CWE-327';
    if (/access control|authorization/.test(lowerIssue)) return 'CWE-284';
    if (/deserialization|serialization/.test(lowerIssue)) return 'CWE-502';
    if (/xml external|xxe/.test(lowerIssue)) return 'CWE-611';
    if (/injection|input validation/.test(lowerIssue)) return 'CWE-74';
    if (/dos|denial of service|infinite loop/.test(lowerIssue)) return 'CWE-400';
    if (/memory|buffer|overflow/.test(lowerIssue)) return 'CWE-788';
    if (/null pointer|undefined/.test(lowerIssue)) return 'CWE-476';
    if (/race condition|concurrency/.test(lowerIssue)) return 'CWE-362';

    return 'CWE-Unknown';
  }

  /**
   * Generate security fix suggestion
   * @param {string|object} issue - Issue description
   * @returns {string} Fix suggestion
   */
  function generateSecurityFix(issue) {
    const issueStr = typeof issue === 'string' ? issue : JSON.stringify(issue);
    const lowerIssue = issueStr.toLowerCase();

    const fixes = {
      'sql injection': 'Use parameterized queries or prepared statements. Sanitize all user input before database queries.',
      'xss': 'Escape all user input. Use Content Security Policy. Use template literals with proper escaping.',
      'rce': 'Never evaluate user input. Use safe APIs. Run code in sandboxed environments. Implement strict input validation.',
      'csrf': 'Implement CSRF tokens. Use SameSite cookie attributes. Validate Origin/Referer headers.',
      'broken authentication': 'Implement strong session management. Hash passwords with bcrypt or argon2. Enforce MFA. Validate credentials properly.',
      'sensitive data exposure': 'Encrypt data at rest and in transit. Use HTTPS. Never log sensitive data. Remove hardcoded secrets.',
      'xxe': 'Disable XML external entity parsing. Use safer XML parsers. Validate and sanitize XML input.',
      'dos': 'Implement rate limiting. Add request timeouts. Use circuit breakers. Monitor resource consumption.',
      'default': 'Review security best practices. Implement input validation, output encoding, and proper error handling.'
    };

    for (const [keyword, fix] of Object.entries(fixes)) {
      if (lowerIssue.includes(keyword)) return fix;
    }

    return fixes['default'];
  }

  /**
   * Calculate numeric severity score for sorting
   * @param {string} severity - 'Critical' | 'High' | 'Medium' | 'Low'
   * @returns {number} Score for sorting (higher = worse)
   */
  function calculateIssueSeverityScore(severity) {
    const scores = {
      'Critical': 100,
      'High': 75,
      'Medium': 50,
      'Low': 25
    };
    return scores[severity] || 0;
  }

  /**
   * Extract code snippet from issue (placeholder for future enhancement)
   * @param {string|object} issue - Issue description
   * @returns {string} Code snippet or empty string
   */
  function extractCodeSnippet(issue) {
    const issueStr = typeof issue === 'string' ? issue : JSON.stringify(issue);
    // Future: Extract actual code from issue description or diff
    return '';
  }

  /**
   * Detect breaking changes in PR
   * @param {object} analysis - OpenAI analysis result
   * @returns {Array} Breaking changes with semver suggestions
   */
  function detectBreakingChanges(analysis = {}) {
    const breakingChanges = analysis.breakingChanges || [];

    return breakingChanges.map((change, index) => {
      const semverBump = suggestSemverBump(change);
      return {
        id: index,
        change: change,
        type: determineChangeType(change),
        semverBump: semverBump,
        impact: calculateChangeImpact(change),
        riskScore: semverBump === 'major' ? 100 : semverBump === 'minor' ? 50 : 25
      };
    });
  }

  /**
   * Determine type of breaking change
   * @param {string} change - Change description
   * @returns {string} 'function-removal' | 'api-change' | 'signature-change' | 'other'
   */
  function determineChangeType(change) {
    const lowerChange = change.toLowerCase();

    if (/removed|deleted|deprecated|no longer|function.*removal/.test(lowerChange)) {
      return 'function-removal';
    }
    if (/api|endpoint|route|url/.test(lowerChange)) {
      return 'api-change';
    }
    if (/signature|parameter|argument|return type|interface/.test(lowerChange)) {
      return 'signature-change';
    }

    return 'other';
  }

  /**
   * Suggest semantic version bump
   * @param {string|object} change - Change description
   * @returns {string} 'major' | 'minor' | 'patch'
   */
  function suggestSemverBump(change) {
    const changeStr = typeof change === 'string' ? change : JSON.stringify(change);
    const lowerChange = changeStr.toLowerCase();

    // Major: breaking changes, removed functions, API changes
    if (/removed|deleted|breaking|incompatible|api.*change|function.*removed|deprecated/.test(lowerChange)) {
      return 'major';
    }

    // Minor: new features, non-breaking additions
    if (/added|new feature|enhancement|new method|optional/.test(lowerChange)) {
      return 'minor';
    }

    // Patch: bug fixes, improvements
    return 'patch';
  }

  /**
   * Calculate impact of breaking change
   * @param {string} change - Change description
   * @returns {string} 'critical' | 'high' | 'medium' | 'low'
   */
  function calculateChangeImpact(change) {
    const lowerChange = change.toLowerCase();

    if (/removed|critical|major breaking/.test(lowerChange)) {
      return 'critical';
    }
    if (/breaking|incompatible/.test(lowerChange)) {
      return 'high';
    }
    if (/change|update|modify/.test(lowerChange)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Analyze test coverage gaps
   * @param {object} analysis - OpenAI analysis result
   * @returns {object} Test coverage analysis with suggestions
   */
  function analyzeTestCoverage(analysis = {}) {
    const testCoverage = analysis.testCoverage || {};
    const uncoveredBlocks = [];

    // Parse test coverage info if available
    if (testCoverage.uncovered) {
      uncoveredBlocks.push(...testCoverage.uncovered);
    }

    return {
      coverage: testCoverage.percentage || 0,
      uncoveredBlocks: uncoveredBlocks,
      hasMissingTests: uncoveredBlocks.length > 0,
      testSkeleton: generateTestSkeleton(analysis),
      riskScore: calculateTestCoverageRisk(testCoverage.percentage || 0),
      recommendation: getTestCoverageRecommendation(testCoverage.percentage || 0)
    };
  }

  /**
   * Generate basic test skeleton suggestion
   * @param {object} analysis - OpenAI analysis result
   * @returns {string} Test template suggestion
   */
  function generateTestSkeleton(analysis = {}) {
    const functionName = analysis.functionName || 'newFunction';

    return `
describe('${functionName}', () => {
  it('should handle nominal case', () => {
    // Add nominal assertions
    expect(true).toBe(true);
  });

  it('should handle edge cases', () => {
    // Add edge-case assertions
    expect(true).toBe(true);
  });

  it('should handle error conditions', () => {
    // Add error-condition assertions
    expect(true).toBe(true);
  });
});
    `.trim();
  }

  /**
   * Calculate test coverage risk score
   * @param {number} percentage - Coverage percentage (0-100)
   * @returns {number} Risk score (0-100)
   */
  function calculateTestCoverageRisk(percentage) {
    if (percentage >= 90) return 0;      // Excellent
    if (percentage >= 75) return 25;     // Good
    if (percentage >= 60) return 50;     // Fair
    if (percentage >= 40) return 75;     // Poor
    return 100;                          // Critical
  }

  /**
   * Get test coverage recommendation
   * @param {number} percentage - Coverage percentage
   * @returns {string} Recommendation message
   */
  function getTestCoverageRecommendation(percentage) {
    if (percentage >= 90) return '✓ Excellent coverage';
    if (percentage >= 75) return '⚠ Good coverage, consider adding edge case tests';
    if (percentage >= 60) return '⚠ Fair coverage, add more tests for edge cases';
    if (percentage >= 40) return '❌ Poor coverage, prioritize test additions';
    return '❌ Critical: Add comprehensive tests before merge';
  }

  /**
   * Calculate overall risk breakdown by category
   * @param {object} analysis - OpenAI analysis result
   * @returns {object} Risk breakdown: {security%, breaking%, quality%}
   */
  function calculateRiskBreakdown(analysis = {}) {
    const securityRisk = calculateSecurityRiskPercentage(analysis);
    const breakingRisk = calculateBreakingRiskPercentage(analysis);
    const qualityRisk = calculateQualityRiskPercentage(analysis);

    const total = securityRisk + breakingRisk + qualityRisk;
    const normalized = total > 0 ? total : 1;

    return {
      security: Math.round((securityRisk / normalized) * 100),
      breaking: Math.round((breakingRisk / normalized) * 100),
      quality: Math.round((qualityRisk / normalized) * 100),
      total: Math.round(((securityRisk + breakingRisk + qualityRisk) / 3)),
      riskLevel: getRiskLevelFromScore(analysis.riskScore || 0)
    };
  }

  /**
   * Calculate security risk percentage
   * @param {object} analysis - Analysis result
   * @returns {number} Risk value
   */
  function calculateSecurityRiskPercentage(analysis = {}) {
    const securityIssues = analysis.securityIssues || [];
    if (securityIssues.length === 0) return 0;

    const securityRisk = calculateSecurityRisk(securityIssues);
    const totalSeverity = securityRisk.reduce((sum, issue) => sum + issue.riskScore, 0);
    return Math.min(100, totalSeverity / securityRisk.length);
  }

  /**
   * Calculate breaking changes risk percentage
   * @param {object} analysis - Analysis result
   * @returns {number} Risk value
   */
  function calculateBreakingRiskPercentage(analysis = {}) {
    const breakingChanges = analysis.breakingChanges || [];
    if (breakingChanges.length === 0) return 0;

    const breaking = detectBreakingChanges(analysis);
    const totalImpact = breaking.reduce((sum, change) => sum + change.riskScore, 0);
    return Math.min(100, totalImpact / breaking.length);
  }

  /**
   * Calculate quality/coverage risk percentage
   * @param {object} analysis - Analysis result
   * @returns {number} Risk value
   */
  function calculateQualityRiskPercentage(analysis = {}) {
    const testCoverage = analyzeTestCoverage(analysis);
    return testCoverage.riskScore || 0;
  }

  /**
   * Get risk level from score
   * @param {number} score - Risk score (0-100)
   * @returns {string} Risk level description
   */
  function getRiskLevelFromScore(score) {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Low';
    return 'Minimal';
  }

  /**
   * Compare current PR risk to previous PR
   * @param {number} currentScore - Current PR risk score
   * @param {string} repoName - Repository name for storage key
   * @returns {Promise<object>} Trend: {trend: 'up'|'down'|'stable', previousScore, improvement}
   */
  async function compareTrendToPreviousPR(currentScore, repoName = 'default') {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const history = result[STORAGE_KEY] || {};
      const repoHistory = history[repoName] || { score: 0, timestamp: 0 };

      const previousScore = repoHistory.score || 0;
      let trend = 'stable';
      let improvement = 0;

      if (currentScore < previousScore - 5) {
        trend = 'down';
        improvement = previousScore - currentScore;
      } else if (currentScore > previousScore + 5) {
        trend = 'up';
        improvement = currentScore - previousScore;
      }

      // Store current score
      history[repoName] = {
        score: currentScore,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [STORAGE_KEY]: history });

      return {
        trend: trend,
        previousScore: previousScore,
        currentScore: currentScore,
        improvement: Math.abs(improvement),
        trendIndicator: getTrendIndicator(trend, improvement)
      };
    } catch (error) {
      console.error('[RiskEngine] Error comparing trend:', error);
      return {
        trend: 'stable',
        previousScore: currentScore,
        currentScore: currentScore,
        improvement: 0,
        trendIndicator: '─'
      };
    }
  }

  /**
   * Get visual trend indicator
   * @param {string} trend - 'up' | 'down' | 'stable'
   * @param {number} improvement - Improvement amount
   * @returns {string} Visual indicator with emoji
   */
  function getTrendIndicator(trend, improvement) {
    if (trend === 'down') {
      return improvement > 20 ? '📉 Great improvement' : '📉 Better than last PR';
    }
    if (trend === 'up') {
      return improvement > 20 ? '📈 Significantly worse' : '📈 Slightly worse than last PR';
    }
    return '─ Similar to last PR';
  }

  /**
   * Calculate overall PRO risk score for circular gauge
   * @param {object} analysis - Full analysis result
   * @returns {number} Overall risk score (0-100)
   */
  function calculateOverallRiskScore(analysis = {}) {
    const breakdown = calculateRiskBreakdown(analysis);
    const riskScore = analysis.riskScore || breakdown.total;
    return Math.min(100, Math.max(0, riskScore));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PR RISK SCORING ENGINE
  // Deterministic, file-based scoring with classification gates.
  // No randomness. No arbitrary base score.
  // ──────────────────────────────────────────────────────────────────────────

  // Runtime source file extensions
  const RUNTIME_EXTS = /\.(js|ts|jsx|tsx|mjs|cjs|py|go|java|cs|rb|php|swift|kt|rs|cpp|c|h)$/;

  // Config files (build system, compiler, linter, framework)
  const CONFIG_PATTERN = /(Dockerfile|dockerfile|\.env(\.[a-z]+)?$|webpack\.|vite\.config|tsconfig\.json|babel\.config|\.eslintrc|jest\.config|rollup\.config|next\.config|nuxt\.config|\.babelrc|\.swcrc)/;

  // Pure dependency lock/manifest files (always +18)
  const DEPENDENCY_PATTERN = /(requirements\.txt|go\.mod|go\.sum|Pipfile(\.lock)?|Gemfile(\.lock)?|yarn\.lock|package-lock\.json|poetry\.lock|composer\.lock)/;

  // Security-sensitive directory paths (require surrounding slashes to match directory, not substring)
  const SECURITY_PATH = /\/(auth|payment|payments|core|middleware)\//;

  // CI / build infrastructure files
  const CI_PATTERN = /\.github\/workflows|\.gitlab-ci\.yml|\.circleci\/|Jenkinsfile/;

  // Production config signals
  const PROD_PATTERN = /(\.prod\.|\.production\.|production\.env|prod\.env|\/config\/prod(uction)?\/)|(production|prod)\.(json|yaml|yml|toml|ini|env)$/i;

  /**
   * Classify a single file into a scoring tier.
   * Returns the tier name for accounting, plus the point value.
   * Priority: security > dependency > config > runtime > (none)
   *
   * @param {string} filePath
   * @param {string} diff - Full PR diff text (used for package.json version detection)
   * @returns {{ tier: string, points: number }}
   */
  function classifyFile(filePath, diff) {
    if (SECURITY_PATH.test(filePath)) {
      return { tier: 'security', points: 25 };
    }

    if (DEPENDENCY_PATTERN.test(filePath)) {
      return { tier: 'dependency', points: 18 };
    }

    // package.json: dependency tier (+18) if diff shows version/dep changes, else config (+12)
    if (/package\.json$/.test(filePath)) {
      const hasDependencyChange = /[+\-]\s*"(version|dependencies|devDependencies|peerDependencies|optionalDependencies)"/.test(diff);
      return hasDependencyChange
        ? { tier: 'dependency', points: 18 }
        : { tier: 'config', points: 12 };
    }

    if (CONFIG_PATTERN.test(filePath)) {
      return { tier: 'config', points: 12 };
    }

    if (RUNTIME_EXTS.test(filePath)) {
      return { tier: 'runtime', points: 6 };
    }

    return { tier: 'other', points: 0 };
  }

  /**
   * Calculate PR risk score using structured, deterministic file-based rules.
   *
   * Scoring pipeline:
   *   1. Classification Gate  → early-exit for docs-only / test-only PRs
   *   2. Weighted Base Score  → file type weights (additive per file)
   *   3. Change Magnitude     → LOC bonus, highest tier only (not stacked)
   *   4. Contextual Multiplier → directory/infra signal, highest only
   *   5. Normalize            → clamp to [0, 95], round to integer
   *
   * @param {object} prMetadata
   * @param {string[]} prMetadata.files        - List of changed file paths
   * @param {number}   prMetadata.additions    - Lines added
   * @param {number}   prMetadata.deletions    - Lines deleted
   * @param {string}   [prMetadata.diff]       - Full diff text (for package.json analysis)
   * @returns {number} Integer score in range [0, 95]
   */
  function calculateRiskScore(prMetadata) {
    const files     = Array.isArray(prMetadata.files) ? prMetadata.files : [];
    const additions = typeof prMetadata.additions === 'number' ? prMetadata.additions : 0;
    const deletions = typeof prMetadata.deletions === 'number' ? prMetadata.deletions : 0;
    const loc       = additions + deletions;
    const diff      = typeof prMetadata.diff === 'string' ? prMetadata.diff : '';

    // ── STEP 1: Classification Gate (early exit) ──────────────────────────

    if (files.length > 0) {
      // Gate A: Documentation-only — every file is .md or lives inside /docs/
      const isDocsOnly = files.every(f =>
        f.endsWith('.md') || /\/docs\//.test(f)
      );
      if (isDocsOnly) {
        console.log({ filesChanged: files.length, runtimeFiles: 0, configFiles: 0, dependencyChanges: 0, loc, multiplier: 1, finalScore: 5 });
        return 5;
      }

      // Gate B: Test-only — every file is a test file
      const isTestOnly = files.every(f =>
        /\.(test|spec)\.[a-z0-9]+$/.test(f) ||
        /\/__tests__\//.test(f) ||
        /\/tests\//.test(f)
      );
      if (isTestOnly) {
        console.log({ filesChanged: files.length, runtimeFiles: 0, configFiles: 0, dependencyChanges: 0, loc, multiplier: 1, finalScore: 10 });
        return 10;
      }
    }

    // ── STEP 2: Weighted Base Scoring ──────────────────────────────────────

    let runtimeFiles       = 0;
    let configFiles        = 0;
    let dependencyChanges  = 0;
    let baseScore          = 0;

    for (const file of files) {
      const { tier, points } = classifyFile(file, diff);
      baseScore += points;

      if (tier === 'runtime')    runtimeFiles++;
      if (tier === 'config')     configFiles++;
      if (tier === 'dependency') dependencyChanges++;
    }

    // ── STEP 3: Change Magnitude (highest tier only, not stacked) ──────────

    let locBonus = 0;
    if      (loc > 1500) locBonus = 15;
    else if (loc > 500)  locBonus = 10;
    else if (loc >= 200) locBonus = 5;
    // < 200 LOC: no bonus

    baseScore += locBonus;

    // ── STEP 4: Contextual Multiplier (highest match only) ─────────────────

    const filePaths = files.join('\n');
    const applicableMultipliers = [];

    if (PROD_PATTERN.test(filePaths))                        applicableMultipliers.push(1.3);
    if (/\/(src\/core|auth|payments?)\//.test(filePaths))    applicableMultipliers.push(1.2);
    if (CI_PATTERN.test(filePaths))                          applicableMultipliers.push(1.15);

    const multiplier = applicableMultipliers.length > 0
      ? Math.max(...applicableMultipliers)
      : 1.0;

    // ── STEP 5: Normalize ──────────────────────────────────────────────────

    const finalScore = Math.min(95, Math.max(0, Math.round(baseScore * multiplier)));

    console.log({
      filesChanged:      files.length,
      runtimeFiles,
      configFiles,
      dependencyChanges,
      loc,
      multiplier,
      finalScore
    });

    return finalScore;
  }

  // Public API
  return {
    calculateSecurityRisk,
    determineSeverityLevel,
    determineCWETag,
    generateSecurityFix,
    detectBreakingChanges,
    suggestSemverBump,
    analyzeTestCoverage,
    generateTestSkeleton,
    calculateRiskBreakdown,
    compareTrendToPreviousPR,
    calculateOverallRiskScore,
    getTrendIndicator,
    calculateRiskScore
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RiskEngine;
}
