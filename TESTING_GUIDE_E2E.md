# 🧪 End-to-End Testing Guide — PR Quick Insight

## Overview
This guide walks you through testing the complete integration: extraction → API → display.

---

## Phase 1: Setup (5 minutes)

### Step 1.1: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to `/Users/anknish/PR Analyzer/` and select it
5. You should see "PR Quick Insight" appear in the extensions list
6. ✅ Verify the extension icon appears in your Chrome toolbar

### Step 1.2: Set Your OpenAI API Key

1. Click the **PR Quick Insight** extension icon in the toolbar
2. A popup should open with:
   - Title: "PR Quick Insight"
   - Input field: "OpenAI API Key"
   - Instructions: "How to get your API key"
3. Enter your OpenAI API key (format: `sk-...`)
4. Click **Save API Key**
5. ✅ You should see: "✓ API key saved successfully!" (disappears after 3 seconds)
6. Close the popup

### Step 1.3: Open DevTools Console

1. Open a new Chrome tab
2. Press `F12` to open Developer Tools
3. Click the **Console** tab
4. Keep this open while testing (you'll see log output here)
5. ✅ You should see: "Not a GitHub PR page" (normal - we're not on GitHub yet)

---

## Phase 2: Extract & Test (5 minutes)

### Step 2.1: Navigate to a Small GitHub PR

Find a small PR with **1-3 files** changed:
- **Good examples**:
  - Single file fix: `github.com/owner/repo/pull/123`
  - Small feature: `github.com/owner/repo/pull/456`
- **Avoid for first test**:
  - Large refactors (50+ files)
  - Massive diffs (1000+ lines)
  - Merge commits (multiple PRs)

**If you need a test PR**, you can use:
- Your own repository's PRs
- Popular repos with recent PRs: github.com/facebook/react/pulls, github.com/torvalds/linux/pulls

### Step 2.2: Verify Extraction Phase

1. Go to the GitHub PR page
2. **Look in DevTools Console** for this output:

```
Initializing PR Quick Insight...
PR Metadata: {
  title: "...",
  description: "...",
  files: [...],
  filesChanged: 3,
  additions: 142,
  deletions: 58,
  diffLength: 2345
}
```

3. **Check each value**:
   - ✅ `title`: Non-empty string (e.g., "Fix: Improve performance")
   - ✅ `description`: Non-empty string (or "(No description provided)")
   - ✅ `files`: Array with filenames (e.g., ["src/cache.js", "tests/cache.test.js"])
   - ✅ `filesChanged`: Number > 0 (e.g., 3)
   - ✅ `additions`: Number >= 0 (e.g., 142)
   - ✅ `deletions`: Number >= 0 (e.g., 58)
   - ✅ `diffLength`: Number > 100 (should be several KB, not 0)

**If ANY of these is 0 or empty**:
- ❌ STOP - extraction failed
- Review [EXTRACTION_GUIDE.md](./EXTRACTION_GUIDE.md)
- Try a different PR
- Check your GitHub UI hasn't changed

---

## Phase 3: AI Analysis (2 minutes)

### Step 3.1: Click "Analyze PR" Button

1. Look for the **floating panel** on the right side of the GitHub PR page
2. It should have:
   - Title: "PR Quick Insight"
   - Button: "Analyze PR"
3. Click the **"Analyze PR"** button
4. You should see:
   - Button hides
   - **Loading spinner** appears with "Analyzing PR..."

### Step 3.2: Monitor Console During API Call

**Watch the Console** for:

1. First, you should see:
```
PR data sent to API: {
  title: "...",
  filesChanged: 3,
  additions: 142,
  deletions: 58,
  diffLength: 2345
}
```

2. Then, wait 2-5 seconds for OpenAI to respond

3. You should see:
```
Analysis result: {
  summary: ["...", "...", "..."],
  riskLevel: "Low",
  issues: ["...", "...", "..."]
}
```

---

## Phase 4: Verify Results (2 minutes)

### Step 4.1: Check Panel Display

The floating panel should now show:

```
┌─ PR Quick Insight ────────────────────┐
│                                        │
│  Summary                               │
│  • Point 1 about the PR                │
│  • Point 2 about the PR                │
│  • Point 3 about the PR                │
│  • Point 4 about the PR                │
│  • Point 5 about the PR                │
│                                        │
│  Risk Level                            │
│  [Low]  ← colored green/yellow/red     │
│                                        │
│  Top Issues                            │
│  • Issue 1                             │
│  • Issue 2                             │
│  • Issue 3                             │
│                                        │
│  [Analyze Again]                       │
└────────────────────────────────────────┘
```

### Step 4.2: Validate Output Quality

**Summary should be**:
- ✅ 5 points (not 3, not 10)
- ✅ Concise and actionable (each line ~15-30 words)
- ✅ Related to the actual PR changes
- ✅ Example: "Adds caching layer to reduce API latency" (good) vs "PR modifies code" (bad)

**Risk Level should be**:
- ✅ One of: `Low`, `Medium`, `High`
- ✅ Colored appropriately:
  - 🟢 Green = Low
  - 🟡 Yellow/Orange = Medium
  - 🔴 Red = High
- ✅ Makes sense for the PR scope

**Issues should be**:
- ✅ 3 items (not 2, not 5)
- ✅ Technical concerns (not generic fluff)
- ✅ Related to code quality, performance, security, or testing
- ✅ Example: "Missing error handling for cache failures" (good) vs "The PR is merged" (bad)

### Step 4.3: Test "Analyze Again" Button

1. Click the **"Analyze Again"** button
2. Panel should reset and show button again
3. Click **"Analyze PR"** one more time
4. Should work the same way (verify reproducibility)
5. ✅ Confirms state management is working

---

## Phase 5: Error Handling Tests (3 minutes each)

### Test 5.1: No API Key

1. Go to `chrome://extensions/`
2. Find "PR Quick Insight" and click **Details**
3. Scroll to **Storage** section
4. Click **"Clear site data"** (this erases the saved API key)
5. Close popup
6. Go back to a GitHub PR
7. Click "Analyze PR"
8. **Expected**: Error message in panel:
   ```
   API key not found. Please set it in the extension popup.
   ```
9. ✅ Check that button re-appears (so you can try again)

### Test 5.2: Invalid API Key

1. Click extension popup
2. Clear the input and enter: `sk-invalid-key-12345`
3. Click "Save API Key"
4. ✅ You should see error: "API key seems too short"
5. Try: `sk-` then 50 random characters
6. Click "Save API Key"
7. Go to a GitHub PR
8. Click "Analyze PR"
9. **Expected**: Error appears in panel:
   ```
   OpenAI API Error: Incorrect API key provided. You can find your API key at...
   ```
10. ✅ Button should re-appear and panel should show "Analyze Again"

### Test 5.3: No Network / Timeout

1. Open DevTools (F12)
2. Click **Network** tab
3. **Throttle connection**: Select "Slow 3G" from dropdown
4. Remove API key (see Test 5.1)
5. Set a valid API key again
6. Go to a GitHub PR
7. Click "Analyze PR"
8. **Expected**: Network request shows in Network tab, takes longer
9. ✅ Should eventually succeed (or show timeout error)

### Test 5.4: Another PR (Different Type)

Test on a **completely different PR** to verify extraction adapts:

1. Find a PR with **different characteristics**:
   - More files (5-10 instead of 1-3)
   - Larger diff (500+ lines added/removed)
   - Different language (Python instead of JavaScript, etc.)
   - OR a PR with no description
2. Click "Analyze PR"
3. **Expected**:
   - ✅ Extraction succeeds (correct file count, additions/deletions)
   - ✅ API call succeeds
   - ✅ Results are different from first PR (AI is analyzing actual content)
   - ✅ If no description: shows "(No description provided)" in logs

---

## Success Criteria Checklist

### Extraction Phase
- [ ] Title is correctly extracted
- [ ] Description is extracted (or shows placeholder)
- [ ] File list shows all changed files
- [ ] File count is accurate
- [ ] Additions and deletions are non-zero numbers
- [ ] Diff length is > 100 characters (not 0)

### API Integration
- [ ] API key is stored and retrieved successfully
- [ ] PR data is logged to console before API call
- [ ] OpenAI API call completes within 5 seconds
- [ ] Response is valid JSON (no parse errors)

### Display & UX
- [ ] Panel shows 5 summary points
- [ ] Risk level is one of: Low/Medium/High (properly colored)
- [ ] 3 issues are displayed
- [ ] "Analyze Again" button works
- [ ] Loading spinner appears during analysis
- [ ] Errors are shown in user-friendly format

### Error Handling
- [ ] Missing API key shows clear message
- [ ] Invalid API key shows clear message
- [ ] API errors are caught and displayed
- [ ] "Analyze Again" button resets the panel
- [ ] Can retry after error

### Consistency
- [ ] Same PR analyzed twice gives similar results
- [ ] Different PRs give different analyses
- [ ] Works on small (1-3 files) and medium (5-10 files) PRs
- [ ] Results are sensible for the actual PR content

---

## Debugging Output Reference

### Normal Flow (Console)

```javascript
// 1. Extension loads
Initializing PR Quick Insight...

// 2. PR data extracted
PR Metadata: {
  title: "Fix: Improve performance",
  description: "...",
  files: ["src/cache.js", "..."],
  filesChanged: 3,
  additions: 142,
  deletions: 58,
  diffLength: 2847
}

// 3. User clicks analyze
PR data sent to API: {
  title: "Fix: Improve performance",
  filesChanged: 3,
  additions: 142,
  deletions: 58,
  diffLength: 2847
}

// 4. API responds
Analysis result: {
  summary: ["...", "...", "...", "...", "..."],
  riskLevel: "Low",
  issues: ["...", "...", "..."]
}
```

### Error Flow (Console)

```javascript
// Missing API key
Error analyzing PR: Error: API key not found. Please set it in the extension popup.

// Invalid API key
Error analyzing PR: Error: OpenAI API Error: Incorrect API key provided...

// JSON parse error
Error analyzing PR: Error: Failed to parse AI response as JSON: ...
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Not a GitHub PR page" in console | Not on a GitHub PR URL | Navigate to `github.com/owner/repo/pull/123` |
| diffLength: 0 | Diff extraction failed | Try different PR, or check GitHub's DOM structure hasn't changed |
| filesChanged: 0 | File extraction failed | Check PR actually has changed files |
| API error: "Incorrect API key" | API key is invalid or expired | Generate new key at platform.openai.com/api-keys |
| API error: "Rate limit exceeded" | OpenAI rate limit hit | Wait a few minutes, try again |
| "Failed to parse AI response" | OpenAI returned invalid JSON | Try again (might be temporary issue) |
| Panel doesn't appear | Content script didn't inject | Reload page, check manifest.json host_permissions |
| Button doesn't respond | JavaScript error | Check DevTools for error messages |

---

## Next Steps After Successful Test

If all checks pass ✅:

1. **Test with 3+ different PRs** to confirm robustness
2. **Test error scenarios** (invalid key, no internet, etc.)
3. **Remove debug logs** before production:
   - Remove `// TODO: Remove debug logs before production` lines
   - Remove all `console.log()` statements (except errors which stay)
4. **Ready for production** 🚀

If any checks fail ❌:

1. **Check the console output** for error messages
2. **Review the error type**:
   - Extraction issue? → Check [EXTRACTION_GUIDE.md](./EXTRACTION_GUIDE.md)
   - API issue? → Check [API_INTEGRATION.md](./API_INTEGRATION.md)
3. **Try different PR** to isolate the issue
4. **Report findings** with console output

---

## Quick Reference: Key Files

- **content.js**: Extraction and API logic (lines 306-346 for main flow)
- **popup.js**: API key storage (lines 29-90)
- **styles.css**: Floating panel UI
- **manifest.json**: Extension permissions and configuration
- **test.html**: Local testing without needing real PR

---

## Questions to Answer After Testing

1. **Is API returning correctly?**
   - ✅ Yes: OpenAI responds with valid JSON in 2-5 seconds
   - ❌ No: Check API key validity, check internet connection

2. **Is output formatted properly?**
   - ✅ Yes: 5 summary points, risk level, 3 issues, all displayed cleanly
   - ❌ No: Check styles.css, check console for parse errors

3. **Any CORS issues?**
   - ✅ No: Content script is on same domain, direct fetch to OpenAI API
   - ❌ If CORS error: Not expected for this setup, contact support

4. **Any rate limit errors?**
   - ✅ No: First 3-5 analyses should work fine
   - ⚠️ Yes (after many tests): OpenAI has rate limits, wait a few minutes

---

Good luck testing! Report back with results from any of the success criteria. 🚀
