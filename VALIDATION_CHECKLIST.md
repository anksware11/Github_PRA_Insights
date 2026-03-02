# ✅ Extraction Validation Checklist

**MUST VALIDATE before integrating with OpenAI API!**

---

## 🚫 RED FLAGS - Don't Move to API Yet If:

### ❌ 1. **Diff Length is 0**
```javascript
// BAD - Diff not extracted
diffLength: 0  

// GOOD - Diff was found
diffLength: 847  // or any number > 0
```

**If diffLength = 0:**
- Diffs may not be loaded on page
- Scroll down on PR page to trigger lazy loading
- Check if PR actually has file changes
- Verify `[data-testid="diff-hunk"]` elements exist (DevTools Inspector)

**Fix:** Scroll PR page before analyzing, or update selectors

---

### ❌ 2. **Files Array is Empty**
```javascript
// BAD - No files found
filesChanged: 0
files: []

// GOOD - Files detected
filesChanged: 5
files: ["src/auth.js", "tests/auth.test.js", ...]
```

**If files array is empty:**
- File selectors may be wrong
- GitHub may have changed DOM structure
- PR might genuinely have no file changes (rare)

**Debug Steps:**
1. Open DevTools (F12)
2. Go to Elements tab
3. Search for: `[data-testid="file-tree-item-wrapper"]`
4. If not found, selectors are outdated

**Fix:** Update selectors in `extractChangedFilesList()`

---

### ❌ 3. **Description is Generic/Empty**
```javascript
// BAD - Generic fallback
description: "(No description provided)"

// GOOD - Real description
description: "This PR implements JWT authentication with..."
```

**If you get the placeholder:**
- Description selector may not match
- GitHub updated the DOM
- PR legitimately has no description (sometimes OK)

**Debug Steps:**
1. Open DevTools → Elements
2. Search for: `[data-testid="pull-request-body"]`
3. Check if content is there

**Fix:** Update selectors in `extractPRMetadata()`

---

### ❌ 4. **It Works on test.html But Breaks on Real PR**
```javascript
// test.html: Works fine
{ filesChanged: 5, diffLength: 847 }

// Real PR: Fails
{ filesChanged: 0, diffLength: 0 }
```

**Most Common Cause:**
- GitHub's DOM differs between pages
- Selectors are too specific/brittle
- Real diffs are lazy-loaded
- Need to scroll to load content

**Fix:**
- Update selectors to be more robust
- Add scroll detection
- Test on multiple different PRs

---

## ✅ GREEN FLAGS - Safe to Move to API If:

### ✅ 1. **Diff Length > 0**
```javascript
diffLength: 847  // Any number > 0 is good
```
- Confirms diff extraction works
- Full diff available in object
- Safe for API call

---

### ✅ 2. **Files Detected**
```javascript
filesChanged: 5
files: ["file1.js", "file2.js", ...]
```
- File extraction working
- All 3 fallback methods validated
- Safe for API

---

### ✅ 3. **Description is Real**
```javascript
description: "Actual PR description text starting with real content..."
// NOT: "(No description provided)"
```
- Selector working reliably
- Content extraction valid

---

### ✅ 4. **Works on Multiple Real PRs**
Test on at least 3 different real GitHub PRs:
- Small PR (1-2 files)
- Medium PR (5-10 files)
- Large PR (15+ files)

All should show:
- ✅ Title extracted
- ✅ Files detected
- ✅ Additions/Deletions > 0
- ✅ Diff length > 0

---

## 🧪 Testing Checklist

### Test 1: Local Test Page
```bash
1. Open: /Users/anknish/PR Analyzer/test.html
2. Click "Run Test"
✓ Should show all 7 fields extracted
✓ diffLength: ~847
✓ filesChanged: 5
```

### Test 2: Real PR (Setup)
```bash
1. Load extension (chrome://extensions/)
2. Open real GitHub PR
3. Open DevTools (F12 → Console)
```

### Test 3: Check Console Output
Should see:
```javascript
Initializing PR Quick Insight...
PR Metadata: {
  title: "Real PR title",
  description: "Real description",
  files: [3+ items],
  filesChanged: N > 0,
  additions: N > 0,
  deletions: N > 0,
  diffLength: N > 0  ← CRITICAL
}
```

### Test 4: Test Multiple PRs
Pick 3 different real PRs:

**PR #1: Small (1-3 files)**
```javascript
filesChanged: 2-3  ✓
diffLength: 500-2000  ✓
additions: 10-100  ✓
```

**PR #2: Medium (5-10 files)**
```javascript
filesChanged: 5-10  ✓
diffLength: 2000-6000  ✓
additions: 100-500  ✓
```

**PR #3: Large (15+ files)**
```javascript
filesChanged: 15+  ✓
diffLength: 6000-10000  ✓
additions: 500+  ✓
```

---

## 🔧 Troubleshooting by Symptom

### Problem: diffLength = 0 on Real PR
**Cause:** Diffs not loaded (lazy-loaded by GitHub)

**Fix:**
1. Scroll down on PR page to load diffs
2. Then click "Analyze PR"
3. Or add scroll detection to extension

---

### Problem: filesChanged = 0
**Cause:** Selector doesn't match real GitHub DOM

**Fix:**
1. Check DevTools Inspector for actual selectors
2. Update in `extractChangedFilesList()`
3. Test again

**Common GitHub Changes:**
- `[data-testid="file-tree-item-wrapper"]` → might be different
- Try alternative selectors in Method 2/3
- Add new selectors if needed

---

### Problem: Works on Small PR, Fails on Large PR
**Cause:** Lazy loading or performance issues

**Fix:**
1. Large PRs need scrolling to load all diffs
2. May need pagination handling
3. Diffs truncate at 10,000 chars (this is OK)

---

## 📋 Sign-Off Checklist

Before moving to API integration, verify:

- [ ] test.html extraction works (all 7 fields)
- [ ] Real PR #1 (Small): All fields populated
- [ ] Real PR #2 (Medium): All fields populated
- [ ] Real PR #3 (Large): All fields populated
- [ ] diffLength > 0 on all tests
- [ ] filesChanged > 0 on all tests
- [ ] No console errors
- [ ] Description is not placeholder on real PRs

**If ANY checkbox fails: DO NOT move to API yet**

---

## 🚀 Ready for API Integration When:

✅ All tests pass with real data
✅ diffLength consistently > 0
✅ All 7 fields extracted properly
✅ No console errors
✅ Works on multiple different PRs

---

## 📊 Performance Considerations

**Before API call, ensure:**
- Total request will be < 4,000 tokens
- Title: ~25 tokens
- Description: ~200 tokens
- Files: ~50 tokens
- Diff: ~2,500 tokens (10K chars max)
- **Total: ~2,775 tokens** ✓ Safe

---

**Don't skip this validation!**
A solid extraction foundation = better API results

