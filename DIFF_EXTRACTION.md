# Diff Content Extraction Guide

## 📋 What Was Added

The PR extraction now includes **visible diff content** from the GitHub PR page.

### New Field in PR Object

```javascript
{
  title: "string",
  description: "string",
  files: ["string"],
  filesChanged: number,
  additions: number,
  deletions: number,
  diff: "string"  // ← NEW: Concatenated diff text
}
```

---

## 🔍 How Diff Extraction Works

### Three-Method Fallback Strategy

**Method 1: Diff Hunks (Primary - Most Reliable)**
```javascript
document.querySelectorAll('[data-testid="diff-hunk"]')
```
- Extracts all visible diff hunks from the PR page
- Each hunk contains added (+) and removed (-) lines
- Concatenates all hunks into a single string

**Method 2: Individual Diff Lines (Fallback)**
```javascript
document.querySelectorAll('[data-testid^="diff-line"]')
```
- If hunks not found, tries individual line extraction
- Each line is extracted separately and joined with `\n`

**Method 3: Diff Container (Last Resort)**
```javascript
document.querySelector('[data-testid="diff-container"]')
  || document.querySelector('[data-testid="split-diff-view"]')
  || document.querySelector('.diff-view')
```
- Extracts from entire diff container if hunks unavailable

---

## 🛡️ Size Limits & Safety

### Character Limit: 10,000 Characters

```javascript
const maxChars = 10000; // Prevents token overflow in API
```

**Why 10,000?**
- OpenAI GPT-3.5-turbo has ~4,000 token limit
- Average: ~4 characters per token
- Safety margin: 10,000 chars = ~2,500 tokens
- Leaves room for PR title, description, files list, and analysis response

### Cleanup: Remove Extra Whitespace
```javascript
diffText = diffText
  .trim()
  .replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove multiple blank lines
```

---

## 📝 Console Logging

### What Gets Logged (Production)

**Full metadata logged:**
```javascript
console.log('PR Metadata:', {
  title: "...",
  description: "...",
  files: [...],
  filesChanged: 5,
  additions: 142,
  deletions: 58,
  diffLength: 2847  // ← Only length, not content!
});
```

**Why only length?**
- Avoid console spam with 10KB of diff text
- Prevents browser performance issues
- Clean debugging output
- Full diff still available in `prMetadata.diff` object

---

## 🧪 Testing the Diff Extraction

### Test Page: test.html

The test page now includes:
1. **Mock PR page** with title, description, files
2. **Sample diff hunks** showing:
   - Cache manager import additions
   - Code optimization changes
   - Function signature updates
3. **Test button** that runs extraction

#### Expected Test Output:

```
Starting PR metadata extraction test...
✅ Test completed successfully!
PR Metadata: {...}

📋 Extracted Values:
- Title: Fix: Improve performance in data processing
- Description length: 234 characters
- Description preview: This PR optimizes the data processing...

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

## 💻 Real GitHub PR Testing

When you load the extension on a real GitHub PR:

### Console Output
```
Initializing PR Quick Insight...
PR Metadata: {
  title: "Real PR title",
  description: "Real description...",
  files: ["real/file.js", ...],
  filesChanged: N,
  additions: N,
  deletions: N,
  diffLength: NNNN  // ← Shows character count of diff
}
```

### Floating Panel
When "Analyze PR" is clicked:
1. Extracts all PR data including diff (10KB max)
2. Sends to OpenAI with complete context
3. Shows analysis in panel

---

## 🚀 Integration with OpenAI API

### What Gets Sent

```javascript
const prompt = `
PR Title: ${prData.title}

PR Description:
${prData.description}

Changed Files:
${prData.files.join(', ')}

Diff Preview:
${prData.diff}  // ← Full diff (up to 10,000 chars)

Please analyze this PR...
`;
```

### Benefits of Diff Inclusion
✅ More context for AI analysis
✅ Can detect:
  - Code quality issues
  - Performance problems
  - Security vulnerabilities
  - API changes
  - Breaking changes
✅ More accurate risk assessment
✅ Better issue detection

---

## 🔧 Customization Options

### Change Character Limit

Edit in `extractDiffContent()`:
```javascript
const maxChars = 10000; // Change to 5000, 15000, etc.
```

### Extract Only Recent Changes

Modify diff extraction to limit number of hunks:
```javascript
let hunkCount = 0;
diffSections.forEach((section) => {
  if (hunkCount >= 5) return; // Only first 5 hunks
  if (diffText.length < maxChars) {
    diffText += section.textContent + '\n\n';
    hunkCount++;
  }
});
```

### Format Diff for Better Readability

Add line prefix extraction:
```javascript
// Extract only lines with + or -
const lines = diffText.split('\n');
const conceptLines = lines.filter(l => l.startsWith('+') || l.startsWith('-'));
diffText = conceptLines.join('\n');
```

---

## 📊 Size Examples

| PR Type | Diff Size | API Tokens |
|---------|-----------|-----------|
| Small (1-3 files) | 500 chars | ~125 |
| Medium (5-10 files) | 3000 chars | ~750 |
| Large (10+ files) | 10000 chars | ~2500 |

Total request tokens: **< 3500 tokens** (safe for 4K token limit)

---

## 🐛 Troubleshooting

### No diff extracted
- Check if PR page is fully loaded
- DevTools Inspector: search for `data-testid="diff-hunk"`
- Try refreshing the page

### Diff seems incomplete
- GitHub may be lazy-loading diffs
- Scroll to load more diff sections before analyzing
- Very large diffs are automatically truncated at 10,000 chars

### Console shows diffLength: 0
- No visible diffs on page (maybe PR has no file changes)
- Diffs may not be loaded yet
- Try scrolling to view diffs

---

## ✨ Summary

✅ Complete diff extraction from GitHub PR pages
✅ 10,000 character safety limit for API calls
✅ Three fallback methods for robustness
✅ Clean console logging (length only)
✅ Full diff available for AI analysis
✅ Better context for PR insights

---

**Ready?** Open `/Users/anknish/PR Analyzer/test.html` and click **"Run Test"** to see diff extraction in action!
