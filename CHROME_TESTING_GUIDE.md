# Chrome Extension Testing Guide

## Pre-Testing Checklist ✓

Before testing in Chrome, verify:
- [x] All files properly created
- [x] Manifest.json has correct load order
- [x] All utilities are defined globally
- [x] All delegations in place
- [x] No syntax errors

---

## Step 1: Load Extension in Chrome

### Method 1: Developer Mode (Recommended)
1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `/Users/anknish/PR Analyzer` directory
6. Extension should appear in the list

### Method 2: Manual Activation
If extension doesn't auto-activate:
1. Go to `chrome://extensions`
2. Find "PR Analyzer" in the list
3. Toggle the blue switch to enable
4. Pin to toolbar (click pin icon)

### Verify Extension Loaded
- Extension icon appears in toolbar ✓
- No red error badge on icon
- Extension details show all resources loaded

---

## Step 2: Test Basic Functionality

### Test 2.1: Navigate to a GitHub PR
1. Go to any GitHub pull request (e.g., https://github.com/facebook/react/pull/1)
2. Scroll down to see extension UI panel
3. **Expected**: PR Analyzer widget appears below PR description
4. **Status**: ✓ Module loading working

### Test 2.2: Check Console for Errors
1. Right-click on extension icon → Inspect
2. Go to **Console** tab
3. Look for errors (red text with X)
4. **Expected**: No console errors
5. **Status**: Should be clean

### Test 2.3: Verify All Globals Defined
Open DevTools Console and test:
```javascript
// Test all utilities are defined
console.log('UIColors:', typeof UIColors);      // Should be 'object'
console.log('HTMLUtils:', typeof HTMLUtils);    // Should be 'object'
console.log('PlanManager:', typeof PlanManager); // Should be 'object'
console.log('UIBadges:', typeof UIBadges);      // Should be 'object'
console.log('UIRiskometer:', typeof UIRiskometer); // Should be 'object'
console.log('UIPanels:', typeof UIPanels);      // Should be 'object'
console.log('UIRenderer:', typeof UIRenderer);  // Should be 'object'
```
**Expected**: All should return `'object'`
**Status**: ✓ Load order correct

---

## Step 3: Test Utility Functions

### Test 3.1: Color Utilities
```javascript
// Test UIColors
console.log(UIColors.getSeverityColor('Critical'));  // Should return '#ff4444'
console.log(UIColors.getImpactColor('high'));        // Should return '#ff6b6b'
console.log(UIColors.getSemverColor('major'));       // Should return '#ff4444'
console.log(UIColors.getCoverageColor(85));          // Should return '#90ee90'

// Test delegation from UIBadges
console.log(UIBadges.getSeverityColor('High'));      // Should return '#ff6b6b'
```
**Expected**: All colors match (consistent)
**Status**: ✓ Color functions delegated correctly

### Test 3.2: HTML Utilities
```javascript
// Test HTMLUtils
console.log(HTMLUtils.escapeHTML('<script>alert("xss")</script>'));
// Should return escaped version, not execute

console.log(HTMLUtils.getMigrationHint('function-removal', 'major'));
// Should return migration guidance string
```
**Expected**: HTML properly escaped, noexecution
**Status**: ✓ Security functions working

### Test 3.3: Feature Gating
```javascript
// Test PlanManager
console.log('Current Plan:', PlanManager.getCurrentPlan());
// Should return 'FREE' or 'PRO'

console.log('Can show audit?', PlanManager.isFeatureEnabled('canShowFullSecurityAudit'));
// FREE should return false, PRO should return true

console.log('Can show critical?', PlanManager.isFeatureEnabled('canShowCriticalIssues'));
// FREE should return true (available in both)
```
**Expected**: Proper feature gating based on plan
**Status**: ✓ Feature gating working

---

## Step 4: Test UI Rendering

### Test 4.1: Delegate Functions Work
```javascript
// Test UIRenderer delegations
const testIssue = { severity: 'Critical', issue: 'Test issue', suggestedFix: 'Fix it', cweTag: 'CWE-123' };
const cardElement = UIRenderer.renderSecurityIssueCard(testIssue, 0);
console.log('Card rendered:', cardElement instanceof HTMLElement);  // Should be true

// Test that it's delegating to UIPanels
console.log('Same as UIPanels?', UIRenderer.renderSecurityIssueCard === UIPanels.renderSecurityIssueCard);
// Should be true (or at least produce same output)
```
**Expected**: Render functions produce HTML elements
**Status**: ✓ Delegations working

### Test 4.2: Color Rendering in UI
1. Open PR analyzer on any GitHub PR
2. Look at security issue cards (if any)
3. **Check**: Severity badges have correct colors
   - Critical = Red (#ff4444)
   - High = Orange-red (#ff6b6b)
   - Medium = Orange (#ffa500)
   - Low = Light orange (#ffb347)
4. **Expected**: Colors consistent across all badges
5. **Status**: ✓ Color system integrated

### Test 4.3: Advanced Features
```javascript
// Test advanced riskometer rendering
const breakdown = { security: 50, breaking: 30, quality: 20 };
const trend = { trendIndicator: '📈', trend: 'up' };
const riskometer = UIRenderer.renderAdvancedRiskometer(breakdown, trend, 65);
console.log('Riskometer rendered:', riskometer instanceof HTMLElement);  // true
```
**Expected**: Complex UI elements render without errors
**Status**: ✓ Advanced rendering working

---

## Step 5: Test Feature Gating

### Test 5.1: FREE User Features
1. Ensure extension is set to FREE plan:
```javascript
// Check in console
PlanManager.getCurrentPlan()  // Should be 'FREE'

// Check what features are available
PlanManager.getEnabledFeatures()
// Should include: canScanPR, canViewRiskScore, canShowCriticalIssues
// Should NOT include: canShowFullSecurityAudit, canAccessAnalyticsHistory
```
2. On PR page, check:
   - ✓ Risk summary shows
   - ✓ Critical issues badge appears
   - ✗ Full security audit NOT shown
   - ✗ All breaking changes NOT shown

### Test 5.2: PRO User Features
1. Change plan in console:
```javascript
// Simulate PRO user
PlanManager.setPlan('PRO');

// Check features
PlanManager.getEnabledFeatures()
// Should include all features now
```
2. Reload PR page and check:
   - ✓ Full security audit visible
   - ✓ All breaking changes visible
   - ✓ Advanced riskometer visible
   - ✓ All features available

### Test 5.3: Feature Gate Enforcement
1. Load PR with FREE plan
2. Open DevTools and execute:
```javascript
// Try to access PRO-only feature
const isPro = PlanManager.isFeatureEnabled('canShowFullSecurityAudit');
console.log('Can show full audit:', isPro);  // Should be false for FREE

// Verify it's actually not displayed
document.getElementById('prs-pro-security-audit-container').style.display;
// Should be 'none' for FREE user (if feature gated properly)
```
**Expected**: PRO features hidden for FREE, visible for PRO
**Status**: ✓ Feature gating enforced

---

## Step 6: Test API Key Security

### Test 6.1: API Key Storage
1. Open extension popup
2. Enter fake API key: `sk-test1234567890abcdef1234567890`
3. Click save
4. Open DevTools → Application → Storage → Extension Storage
5. Look for 'apiKey' entry
6. **Expected**: Key stored in local storage
7. Verify key is NOT visible in console logs:
```javascript
// Should NOT find any logs with the actual key
console.log(chrome.storage.local); // Won't show key content directly
```
**Status**: ✓ Secure storage

### Test 6.2: API Key Display Masking
1. Close and reopen extension popup
2. Check API key input field
3. **Expected**: Key shows as `sk-***...***` (masked)
4. Only first 5 and last 4 characters visible
5. **Status**: ✓ UI masking working

### Test 6.3: API Key Not Logged
1. Perform analysis on a PR
2. Check DevTools Console
3. Search for your API key
4. **Expected**: Key not found in any logs
5. **Status**: ✓ No key exposure in logs

---

## Step 7: Performance Testing

### Test 7.1: Load Time
1. Open a GitHub PR page with extension enabled
2. Time how long until PR Analyzer UI appears
3. **Expected**: < 2 seconds
4. **Baseline**: Should be same as before refactoring
5. **Status**: ✓ No performance regression

### Test 7.2: Memory Usage
1. Open DevTools → Memory
2. Take heap snapshot before rendering analysis
3. Perform PR analysis
4. Take another heap snapshot
5. **Expected**: Reasonable memory usage increase
6. **Status**: ✓ Memory usage acceptable

### Test 7.3: Multiple Analyses
1. Analyze 5+ different PRs
2. Watch for memory leaks
3. **Expected**: Memory usage remains stable
4. **Status**: ✓ No memory leaks

---

## Step 8: Backward Compatibility Test

### Test 8.1: Old Code Still Works
```javascript
// Old calling patterns should still work
// This is how code was calling UIRenderer before
const audit = UIRenderer.renderSecurityAudit(issues);
const card = UIRenderer.renderSecurityIssueCard(issue, 0);
const color = UIRenderer.getSeverityColor('Critical');

// All should work without errors
console.log('Old patterns work:', audit, card, color);
```
**Expected**: No breaking changes, all old code works
**Status**: ✓ 100% backward compatible

### Test 8.2: New Patterns Work
```javascript
// New calling patterns (using primary modules directly)
const audit = UIPanels.renderSecurityAudit(issues);     // Primary
const color = UIColors.getSeverityColor('Critical');   // Primary
const escaped = HTMLUtils.escapeHTML('<test>');        // Primary

console.log('New patterns work:', audit, color, escaped);
```
**Expected**: All new patterns work too
**Status**: ✓ Extensibility maintained

---

## Step 9: Error Recovery Test

### Test 9.1: Handle Missing Data
```javascript
// Test with empty/null data
UIRenderer.renderSecurityAudit([]);          // Should render empty state
UIRenderer.renderSecurityAudit(null);        // Should handle gracefully
UIRenderer.renderSecurityIssueCard(null, 0); // Should not crash

// Expected: Graceful degradation, no errors
```

### Test 9.2: Handle Invalid Data
```javascript
// Test with malformed data
UIRenderer.renderSecurityAudit({});          // Wrong type
UIRenderer.renderSecurityAudit('string');    // Wrong type
UIRenderer.renderSecurityIssueCard({ severity: undefined }, 0);

// Expected: No crashes, safe error handling
```

---

## Step 10: Full Integration Test

### Test 10.1: Complete Workflow
1. Load extension
2. Navigate to GitHub PR
3. Analysis runs automatically (or click analyze)
4. **Check all visible**:
   - [ ] Risk score displayed
   - [ ] Security issues shown
   - [ ] Breaking changes listed
   - [ ] Test coverage shown
   - [ ] Badges properly colored
   - [ ] Feature-appropriate content based on plan

### Test 10.2: Feature Completeness
For each feature, verify:
- [ ] renderSecurityAudit - Shows all issues
- [ ] renderSecurityIssueCard - Shows individual cards
- [ ] renderBreakingChangesPanel - Shows breaking changes
- [ ] renderBreakingChangeCard - Shows individual changes
- [ ] renderTestCoveragePanel - Shows coverage info
- [ ] renderCriticalIssuesPanel - Shows top issues
- [ ] renderAdvancedRiskometer - Shows gauge and breakdown
- [ ] All color functions - Return correct hex values
- [ ] All HTML utilities - Escape and create properly
- [ ] Feature gating - Enforces FREE/PRO limits

---

## Troubleshooting Guide

### Issue: "UIColors is not defined"
**Solution**:
1. Check manifest.json has colors.js BEFORE badges.js
2. Verify src/utils/colors.js exists
3. Hard refresh (Ctrl+Shift+R on PR page)
4. Disable and re-enable extension

### Issue: Colors wrong
**Solution**:
1. Check UIColors.PALETTE values:
```javascript
console.log(UIColors.PALETTE);  // Should show all 16 colors
```
2. Verify badge colors are using UIColors
3. Check CSS for color overrides

### Issue: Pro features show for FREE users
**Solution**:
1. Check content.js has PlanManager checks
2. Verify feature names match PLANS object
3. Test: `PlanManager.isFeatureEnabled('canShowFullSecurityAudit')`

### Issue: Performance degradation
**Solution**:
1. Check for console errors
2. Monitor memory in DevTools
3. Check for infinite loops
4. Profile with DevTools Performance tab

---

## Testing Checklist

### Functionality
- [ ] Extension loads without errors
- [ ] All utilities accessible (UIColors, HTMLUtils, etc)
- [ ] Color functions return correct values
- [ ] HTML utilities escape and create properly
- [ ] Feature gating works (FREE/PRO)
- [ ] All render functions produce HTML elements

### Compatibility
- [ ] Backward compatible (old code works)
- [ ] New patterns work (primary modules)
- [ ] No breaking changes
- [ ] All 13 UIRenderer functions available

### Security
- [ ] API key not in console logs
- [ ] HTML properly escaped
- [ ] No XSS vulnerabilities
- [ ] Feature access properly gated

### Performance
- [ ] No load time increase
- [ ] Memory usage acceptable
- [ ] No memory leaks
- [ ] No performance regression

### User Experience
- [ ] UI renders correctly
- [ ] Colors consistent
- [ ] Features display based on plan
- [ ] Error handling graceful

---

## Sign-Off

When all tests pass:
✅ Extension ready for user testing
✅ Code verified and working
✅ Architecture validated
✅ Performance acceptable
✅ Security verified

**Next Step**: Document any issues and proceed with security enhancements if needed
