# AI GitHub PR Analyzer

A lightweight Chrome extension that analyzes GitHub Pull Requests using OpenAI's API to provide quick insights, risk assessment, and potential issues.

## Product Details

### AI GitHub PR Analyzer

Analyze GitHub pull requests with AI-powered risk detection, security checks, and actionable review guidance directly in your browser.

## Pricing

- Free Plan: Limited daily scans
- Pro Plan: $10/month for Unlimited Scans

## Terms & Conditions

Use of this product is governed by our Terms of Service: [TERMS.md](TERMS.md).

## Privacy Policy

Our data handling practices are described in [PRIVACY.md](PRIVACY.md).

## Legal

- Terms of Service: [TERMS.md](TERMS.md)
- Privacy Policy: [PRIVACY.md](PRIVACY.md)

## Features

✨ **Core Features:**
- Injects a floating panel on GitHub PR pages
- Extracts PR title, description, changed files, and diff content
- Sends data to OpenAI API for intelligent analysis
- Displays 5-point summary, risk level (Low/Medium/High), and top 3 issues
- Loading spinner during analysis
- Error handling with user-friendly messages

## Installation

### Step 1: Prepare Your OpenAI API Key
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key (it will start with `sk-`)
3. Copy the key

### Step 2: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the folder containing these files
5. The extension will appear in your extensions list

### Step 3: Configure API Key

1. Click the extension icon in the Chrome toolbar
2. Paste your OpenAI API key
3. Click **Save API Key**
4. Your key is stored locally in `chrome.storage.local` and never sent externally

## Usage

1. Navigate to any GitHub Pull Request (URL pattern: `https://github.com/*/*/pull/*`)
2. You'll see the **PR Quick Insight** panel on the right side
3. Click the **Analyze PR** button
4. Wait for the analysis (takes 10-30 seconds)
5. View the results:
   - **Summary**: 5 bullet points about the PR
   - **Risk Level**: Low, Medium, or High
   - **Top Issues**: 3 potential concerns or issues

## File Structure

```
PR Analyzer/
├── manifest.json      # Extension configuration
├── content.js         # Runs on GitHub PR pages (extraction & UI)
├── popup.html         # Extension popup UI (settings)
├── popup.js           # API key handling logic
├── styles.css         # All styling for panel and popup
└── README.md          # This file
```

## File Descriptions

### manifest.json
- **Purpose**: Defines the extension configuration, permissions, and entry points
- **Key Settings**:
  - Version 3 (Manifest V3)
  - Runs on `https://github.com/*/*/pull/*`
  - Permissions: `storage`, `activeTab`, `scripting`
  - Injects `content.js` and `styles.css` on GitHub PR pages
  - Provides popup window via `popup.html`

### content.js (10.4 KB)
- **Purpose**: Main logic that runs on GitHub PR pages
- **Responsibilities**:
  - Creates floating panel UI
  - Extracts PR data (title, description, files, diff)
  - Handles user interactions (button clicks)
  - Calls OpenAI API for analysis
  - Displays results in the panel
- **Key Functions**:
  - `initializeExtension()` - Sets up the extension
  - `createFloatingPanel()` - Creates UI elements
  - `extractPRData()` - Collects PR information
  - `analyzePRWithOpenAI()` - Sends data to API
  - `displayResults()` - Shows analysis to user

### popup.html (1.6 KB)
- **Purpose**: User interface for setting the API key
- **Features**:
  - Input field for API key (password masked)
  - Save button
  - Instructions for getting API key
  - Local storage notice (privacy)

### popup.js (3.4 KB)
- **Purpose**: Handles API key management
- **Responsibilities**:
  - Loads previously saved API key
  - Validates API key format
  - Saves to Chrome storage
  - Masks API key for security
- **Key Functions**:
  - `loadSavedApiKey()` - Retrieves key from storage
  - `saveApiKey()` - Validates and stores key
  - `maskApiKey()` - Hides full key display

### styles.css (8.2 KB)
- **Purpose**: All styling for extension UI
- **Includes**:
  - Floating panel styles (GitHub-like design)
  - Button and form styles
  - Loading spinner animation
  - Results display formatting
  - Dark mode ready
  - Responsive design for small screens

## Technical Details

### How It Works

1. **Page Detection**: Detects GitHub PR URLs
2. **UI Injection**: Creates floating panel in the DOM
3. **Data Extraction**: 
   - Queries GitHub DOM elements for PR info
   - Collects visible diff content
   - Lists changed files
4. **API Communication**:
   - Gets API key from Chrome storage
   - Sends PR data to OpenAI GPT-3.5-turbo
   - Parses JSON response
5. **Display**: Shows formatted results in panel

### API Request

The extension sends PR data to OpenAI in this format:

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [{
    "role": "user",
    "content": "Analyze this GitHub PR... [full PR content]"
  }],
  "temperature": 0.7,
  "max_tokens": 500
}
```

Expected response format:

```json
{
  "summary": ["point1", "point2", "point3", "point4", "point5"],
  "riskLevel": "Low|Medium|High",
  "issues": ["issue1", "issue2", "issue3"]
}
```

### Storage

- API key is stored in `chrome.storage.local`
- Data is stored only in the local encrypted Chrome storage
- No data is sent to external servers (except OpenAI API)
- Key is never logged or stored elsewhere

## Troubleshooting

### "API key not found" error
- Go to extension settings (extension icon > popup)
- Paste your API key and save

### "OpenAI API Error" message
- Check your API key is valid and active
- Ensure you have OpenAI credits remaining
- Check your API key has proper permissions
- Review the error message for details

### No results displayed
- Check browser console (F12) for errors
- Ensure all files are properly loaded
- Try refreshing the GitHub PR page
- Check if PR has sufficient content for analysis

### API key not saving
- Ensure Developer Mode is ON in Chrome
- Check extension permissions (chrome://extensions)
- Try clearing Chrome cache and reloading extension

## Security Notes

✅ **Safe Practices**:
- API key stored locally only (encrypted Chrome storage)
- Never logged in console (production)
- Only sent to OpenAI official API
- No tracking or analytics
- No backend server involvement

⚠️ **Important**:
- Keep your API key secret
- Don't share screenshots showing your key
- Regenerate key if accidentally exposed
- Check OpenAI API usage limits regularly

## Customization

### Change API Model
Edit `content.js` line ~190:
```javascript
model: 'gpt-3.5-turbo', // Change to 'gpt-4' for better quality (costs more)
```

### Adjust Temperature
Edit `content.js` line ~193:
```javascript
temperature: 0.7, // 0=deterministic, 1=creative
```

### Modify Analysis Prompt
Edit the `prompt` variable in `analyzePRWithOpenAI()` function in `content.js`

## Performance

- **Lightweight**: ~25KB total size
- **Fast Load**: Minimal dependencies
- **Efficient**: Only runs on GitHub PR pages
- **Memory**: Uses minimal memory, no persistent background processing

## Browser Support

- Chrome 88+
- Edge 88+ (Chromium-based)
- Any Chromium browser with extension support

## Limitations

- Only analyzes visible diff sections (first 3 hunks)
- Diff text limited to 2000 characters (to manage API costs)
- Requires active internet connection
- API rate limits apply (check OpenAI dashboard)
- Requires valid OpenAI API key with credits

## Future Enhancements

Potential features for future versions:
- Caching results per PR
- Custom analysis prompts
- Support for multiple AI providers
- Export analysis as PDF
- Dark mode toggle
- Historical analysis tracking
- Keyboard shortcuts

## License

MIT - Feel free to modify and distribute

## Support

For issues or feature requests:
1. Check the Troubleshooting section above
2. Review the Console (F12) for errors
3. Ensure manifest.json is valid


---

**Created**: 2026
**Manifest Version**: 3
**Required Permissions**: storage, activeTab, scripting
