# Console Output Reference

## 🎯 What Gets Logged to Browser Console

### On Page Load (Automatic)

When a GitHub PR page loads with the extension, the console will show:

```javascript
Initializing PR Quick Insight...

PR Metadata: {
  title: "Add authentication middleware",
  description: "Implements JWT validation and token refresh",
  files: ["src/auth/jwt.js", "src/middleware/auth.js", "tests/auth.test.js"],
  filesChanged: 3,
  additions: 120,
  deletions: 20,
  diffLength: 8432
}
```

---

## 📝 Log Fields Explained

| Field | Example | What It Shows |
|-------|---------|---------------|
| `title` | "Add authentication middleware" | PR title from GitHub |
| `description` | "Implements JWT validation..." | PR body/description |
| `files` | Array of 3 strings | Changed file names |
| `filesChanged` | 3 | Count of changed files |
| `additions` | 120 | Total +lines added |
| `deletions` | 20 | Total -lines deleted |
| **`diffLength`** | **8432** | **Diff character count (NOT full content)** |

---

## 🔑 Key Points

### ✅ What's Logged
- ✅ All metadata fields
- ✅ **Diff length** (character count)
- ✅ Clean, readable format
- ✅ Easy to copy/inspect

### ❌ What's NOT Logged  
- ❌ Full diff content (too large for console)
- ❌ Full description text (shown separately)
- ❌ Personal info or secrets

---

## 🧪 Test Page Console Output

When you click "Run Test" on test.html, you see:

```
Starting PR metadata extraction test...
✅ Test completed successfully!

PR Metadata: {
  title: "Fix: Improve performance in data processing",
  description: "This PR optimizes the data processing pipeline by implementing caching mechanisms and reducing unnecessary iterations.",
  files: [
    "src/cache/redis-cache.js",
    "src/db/query-optimizer.js",
    "src/utils/helpers.js",
    "tests/cache.test.js",
    "README.md"
  ],
  filesChanged: 5,
  additions: 142,
  deletions: 58,
  diffLength: 847
}

📋 Extracted Values:
- Title: Fix: Improve performance in data processing
- Description length: 234 characters
- Description preview: This PR optimizes the data processing pipeline by implementing caching mechanisms...

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
- Total changes: +142 −58

🔄 Diff Content:
- Diff length: 847 characters
- Max limit: 10,000 characters
- Diff preview (first 200 chars):
+import { cacheManager } from './cache-manager';
+
 export function processData(input) {
   const data = parseInput(input);
-  const result = heavyComputation(data);
...
```

---

## 💻 Real GitHub PR Console

When extension runs on real PR at github.com:

**DevTools (F12) → Console Tab:**

```
Initializing PR Quick Insight...
PR Metadata: Object
  title: "Your actual PR title"
  description: "Your actual PR description"
  files: Array(5)
    0: "actual/file1.js"
    1: "actual/file2.js"
    ...
  filesChanged: 5
  additions: 142
  deletions: 58
  diffLength: 7354
```

**Click on the Object to expand and see all values**

---

## 🔍 How to View Console

### Chrome/Edge:
1. Press `F12` or `Ctrl+Shift+I` or `Cmd+Option+I`
2. Click "Console" tab
3. Look for "PR Metadata:" log

### Firefox:
1. Press `F12` or `Ctrl+Shift+K`
2. Look for log messages
3. Click to expand objects

### Safari:
1. Enable Developer Menu: Safari → Preferences → Advanced → Show Develop menu
2. Develop → Show Web Inspector
3. Console tab

---

## 📊 Size Reference

### diffLength Values:
- **0-500:** Very small PR (few lines changed)
- **500-2000:** Small PR (1-3 files, light changes)
- **2000-5000:** Medium PR (5-10 files)
- **5000-10000:** Large PR (many file changes), **capped here**

### Example PRs:
```javascript
// Tiny fix
{ title: "Fix typo in README", diffLength: 42, filesChanged: 1 }

// Small feature
{ title: "Add login button", diffLength: 1200, filesChanged: 3 }

// Medium feature
{ title: "Implement caching", diffLength: 5500, filesChanged: 8 }

// Large refactor (capped at 10K)
{ title: "Refactor auth system", diffLength: 10000, filesChanged: 12 }
```

---

## 🎯 Debugging Using Console

### Check if Extension is Running:
```javascript
// You should see this log:
console.log('Initializing PR Quick Insight...')
```

### Verify PR Page Detection:
```javascript
// If you see this, you're not on a PR page:
console.log('Not a GitHub PR page')
```

### Check Specific Fields:
```javascript
// Open console, paste this to check diff:
// (After the PR Metadata log appears)
const diff = dataObject.diff;  // Full diff text
console.log('Diff length:', diff.length);
console.log('Diff preview:', diff.substring(0, 500));
```

---

## 🛠️ Production Cleanup

Before publishing, remove these debug logs (see content.js Lines 30-46):

```javascript
console.log('Initializing PR Quick Insight...');  // ← REMOVE
console.log('PR Metadata:', metadataLog);        // ← REMOVE
```

The `// TODO: Remove debug logs before production` comment is there as a reminder.

---

## ✨ Why This Format?

✅ **Shows everything you need to know**
- All extracted data visible
- Diff length confirms extraction worked
- No performance impact (no 10KB of diff text)

✅ **Avoids console spam**
- 10,000 character diff would clutter console
- Browser might slow down with huge logs
- Still accessible via object property: `metadataLog.diff`

✅ **Easy to debug**
- Can copy the object and inspect
- All fields right there
- Clean, readable format

---

**Ready to test?** Open `/Users/anknish/PR Analyzer/test.html` and click "Run Test" to see the console output! 🚀
