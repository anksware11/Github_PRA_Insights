# PR Data Extraction Guide

## 📊 What Gets Extracted

The `extractPRMetadata()` function now extracts a complete PR object with:

```javascript
{
  title: "string",           // PR title
  description: "string",     // PR body/description
  files: ["string"],         // Array of changed filenames
  filesChanged: number,      // Count of changed files
  additions: number,         // Total lines added (+)
  deletions: number          // Total lines deleted (−)
}
```

## 🔍 Example Output

```javascript
{
  title: "Fix: Improve performance in data processing",
  description: "This PR optimizes the data processing pipeline...",
  files: [
    "src/cache/redis-cache.js",
    "src/db/query-optimizer.js",
    "src/utils/helpers.js",
    "tests/cache.test.js",
    "README.md"
  ],
  filesChanged: 5,
  additions: 142,
  deletions: 58
}
```

## 🛠️ Helper Functions

### 1. `extractChangedFilesList()`
Extracts array of changed file names using 3 fallback methods:
- **Method 1**: `[data-testid="file-tree-item-wrapper"]` (Primary)
- **Method 2**: `[data-testid^="file-name"]` (Fallback)
- **Method 3**: `[data-testid="diff-file-header"]` (Last resort)

### 2. `extractAdditionsDeletions()`
Extracts additions (+) and deletions (−) using regex patterns:
- Looks for `+142 additions` or `+142` patterns
- Looks for `−58 deletions` or `-58` patterns
- Searches both page text and `[class*="diffstat"]` elements

## 🧪 Testing

### Test Page (Beginner-Friendly)
Open `/Users/anknish/PR Analyzer/test.html` in your browser:
1. You'll see a mock PR page
2. Click **"Run Test"** button
3. See all extracted data in console output panel

**Test data includes:**
- Title: "Fix: Improve performance in data processing"
- Description: Full PR body with markdown
- Files: 5 mock files (js, test, md)
- Additions: +142 lines
- Deletions: −58 lines

### Real GitHub PR Testing
1. Load extension in Chrome: `chrome://extensions/`
2. Visit any real GitHub PR
3. Open DevTools (F12)
4. Console logs show:
   ```
   Initializing PR Quick Insight...
   PR Title detected: <title>
   PR Metadata: { title, description, files, filesChanged, additions, deletions }
   ```

## 📝 Selector Documentation

### Title Selectors
```javascript
'[data-testid="pull-request-title"]'  // Primary (reliable)
'h1'                                   // Fallback (compatibility)
```

### Description Selectors
```javascript
'[data-testid="pull-request-body"]'    // Primary (reliable)
'.js-comment-container'                 // Fallback
'[id^="issue_comment_"] .timeline-comment' // Alternative
```

### Files Selectors
```javascript
'[data-testid="file-tree-item-wrapper"]'  // Primary
'[data-testid^="file-name"]'              // Fallback
'[data-testid="diff-file-header"]'        // Last resort
```

### Statistics Selectors
```javascript
// Regex patterns in page text:
/\+(\d+)\s+(additions?)/i      // Additions
/−(\d+)\s+(deletions?)/i       // Deletions (minus)
/-(\d+)\s+(deletions?)/i       // Deletions (hyphen)

// Elements:
'[class*="diffstat"]'           // Stats container
```

## 🔧 How It Works

### Extraction Flow
```
initializeExtension()
  ↓
extractPRMetadata()
  ├── Extract title
  ├── Extract description
  ├── Extract files via extractChangedFilesList()
  ├── Extract stats via extractAdditionsDeletions()
  └── Return complete object
  ↓
console.log('PR Metadata:', prMetadata)
```

### Robustness Features
✅ **Multiple fallback selectors** for each piece of data
✅ **Handles empty/missing data** gracefully
✅ **Regex patterns** for flexible stat extraction
✅ **Non-empty validation** before adding files
✅ **Default values** when data not found

## 🎯 Use Cases

### For AI Analysis
Send the complete object to OpenAI:
```javascript
const prData = extractPRMetadata();
// Send prData to OpenAI API with title, description, files, additions, deletions
```

### For Display
Show user-friendly summary:
```javascript
console.log(`PR: ${metadata.title}`);
console.log(`Files: ${metadata.filesChanged}`);
console.log(`Changes: +${metadata.additions} −${metadata.deletions}`);
```

### For Filtering
Check if PR meets criteria:
```javascript
if (metadata.filesChanged > 10) {
  console.log('Large PR - many files changed');
}
if (metadata.additions > 1000) {
  console.log('Large PR - many additions');
}
```

## 📋 Empty Cases Handling

| Case | Result |
|------|--------|
| No description | `"(No description provided)"` |
| No files found | `files: [], filesChanged: 0` |
| No stats visible | `additions: 0, deletions: 0` |
| Empty filename | Not added to files array |

## 🐛 Debugging Tips

1. Open DevTools (F12) on any GitHub PR
2. Console should log PR Metadata
3. If data missing, check:
   - Are selectors matching? (DevTools Elements tab)
   - Is page fully loaded? (Wait a moment)
   - Did GitHub change the DOM structure? (Try new selectors)

## 🚀 Next Steps

The extracted data is ready for:
- ✅ Sending to OpenAI API for PR analysis
- ✅ Displaying in the floating panel
- ✅ Storing for later review
- ✅ Creating custom reports

---

**All extraction is done on the client-side (your browser) - no data leaves until you click "Analyze PR"!**
