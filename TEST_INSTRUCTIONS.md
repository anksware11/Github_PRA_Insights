# How to Test Diff Extraction

## 🧪 Test Method 1: Local Browser (Recommended)

### Step 1: Open Test Page
```bash
# Open this file in your browser:
/Users/anknish/PR Analyzer/test.html
```

### Step 2: You'll See
- Mock GitHub PR page
- PR title, description, files list
- Two sample diff hunks (showing code changes)
- "Run Test" button

### Step 3: Click "Run Test"
Console output panel below shows:
```
Starting PR metadata extraction test...
✅ Test completed successfully!
PR Metadata: {...}

📋 Extracted Values:
- Title: Fix: Improve performance in data processing
- Description length: 234 characters

📁 Files Changed:
- Total files: 5
  1. src/cache/redis-cache.js
  2. src/db/query-optimizer.js
  3. src/utils/helpers.js
  4. tests/cache.test.js
  5. README.md

📊 Statistics:
- Additions: +142
- Deletions: −58

🔄 Diff Content:
- Diff length: 847 characters
- Max limit: 10,000 characters
- Diff preview (first 200 chars):
+import { cacheManager } from './cache-manager';
...rest of diff...
```

---

## 💻 Test Method 2: Real GitHub PR

### Step 1: Load Extension in Chrome
```
1. Open: chrome://extensions/
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select: /Users/anknish/PR Analyzer/
```

### Step 2: Navigate to GitHub PR
```
Example: https://github.com/torvalds/linux/pull/XXXX
Or any public/private repo PR you have access to
```

### Step 3: Check Console
```
1. Press F12 (open DevTools)
2. Go to "Console" tab
3. Look for logs:
   Initializing PR Quick Insight...
   PR Metadata: {
     title: "...",
     files: [...],
     filesChanged: N,
     additions: N,
     deletions: N,
     diffLength: NNNN  ← Shows diff character count
   }
```

### Step 4: Click "Analyze PR" Button
- Panel on right side should appear
- Shows "Analyzing..." with spinner
- After 10-30 seconds, shows AI analysis

---

## ✅ What to Verify

### Diff Extraction Success Indicators:

✅ **diffLength > 0**
- Means diff was extracted successfully

✅ **diffLength should be reasonable**
- Small PR: 500-2000 chars
- Medium PR: 2000-6000 chars
- Large PR: 6000-10000 chars (capped)

✅ **Diff preview shows code**
- Lines starting with + (additions)
- Lines starting with - (removals)
- Context lines (no prefix)

✅ **No console errors**
- Open DevTools (F12)
- Console tab should be clean
- Only info logs, no red error messages

---

## 🔍 Debugging Tips

### If diffLength is 0:

Check if diffs are loaded on page:
```
1. DevTools (F12)
2. Elements tab
3. Search for: [data-testid="diff-hunk"]
4. If not found, diffs haven't loaded yet
   → Scroll down on PR page to trigger loading
```

### If you see errors:

```
1. Check console (F12)
2. Look for red error messages
3. Copy error and debug (usually selector issue)
4. May need to update selectors if GitHub changed DOM
```

### Test Page Not Working:

```
1. Make sure test.html is in: /Users/anknish/PR Analyzer/
2. Open in modern browser (Chrome/Firefox/Safari)
3. Check browser console for JavaScript errors
4. May need to clear cache: Ctrl+Shift+Del
```

---

## 📊 Expected Results Summary

### Test Page (test.html)
| Metric | Value |
|--------|-------|
| Title extracted | "Fix: Improve performance..." |
| Description length | 234 chars |
| Files found | 5 |
| Additions | 142 |
| Deletions | 58 |
| **Diff length** | ~847 chars |

### Real GitHub PR
| Metric | Expected |
|--------|----------|
| Title extracted | Your PR title |
| Description | Your PR description |
| Files found | Number of changed files |
| Additions/Deletions | Real numbers from PR |
| **Diff length** | 500-10,000 chars |

---

## 🎯 Next Steps After Testing

Once diff extraction works:

1. **Test API Call**
   - Click "Analyze PR" on real PR
   - Should send all data (including diff) to OpenAI
   - Get analysis back

2. **Verify Results**
   - Check if analysis is helpful
   - Does it catch code issues?
   - Does it rate risk correctly?

3. **Production Ready**
   - Remove debug logs (// TODO in code)
   - Update manifest for publication
   - Test on more PRs

---

**Happy testing!** 🚀
