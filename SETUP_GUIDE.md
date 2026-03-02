# Quick Setup Guide - PR Quick Insight

## ⚡ 5-Minute Setup

### 1. Get Your OpenAI API Key (2 minutes)
```
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with sk-)
5. Save it somewhere safe
```

### 2. Load Extension (2 minutes)
```
1. Open Chrome
2. Type: chrome://extensions/ (in address bar)
3. Toggle "Developer mode" (top right corner)
4. Click "Load unpacked"
5. Select your extension folder
6. Done! Extension appears in toolbar
```

### 3. Configure API Key (1 minute)
```
1. Click extension icon (puzzle piece in toolbar)
2. Paste your API key
3. Click "Save API Key"
4. You'll see: "✓ API key saved successfully!"
```

## ✨ You're Ready!

Visit any GitHub PR (change URL to `https://github.com/username/repo/pull/123`)

You'll see a "PR Quick Insight" panel on the right side. Click "Analyze PR" and wait for results!

## 📁 What You Have

```
manifest.json       ← Extension config
content.js          ← Runs on GitHub (10 KB)
popup.html          ← Settings UI
popup.js            ← Saves API key (3 KB)
styles.css          ← All styling (8 KB)
README.md           ← Full documentation
SETUP_GUIDE.md      ← This file
```

## 🚀 First Test

1. Go to a real GitHub PR
2. Wait for panel to appear
3. Click "Analyze PR"
4. Look for loading spinner
5. Results appear in 10-30 seconds!

## ❓ Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "API key not found" | Paste key in popup, click Save |
| No panel appears | Check you're on GitHub PR page |
| "OpenAI API Error" | Check your API key is valid |
| Extension not loading | Try reloading (F5) after loading |

## 💡 Tips

- API key is stored locally (private & safe)
- Extension only runs on GitHub PR pages
- Free to use (you pay OpenAI per API call)
- Check OpenAI dashboard for API costs

## 📞 Need Help?

Check README.md for full documentation and troubleshooting guide.

---

**Happy PR analyzing!** 🚀
