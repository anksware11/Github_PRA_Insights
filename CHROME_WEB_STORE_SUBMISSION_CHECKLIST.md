# Chrome Web Store Submission Checklist

Date: March 2, 2026
Bundle: `dist/pr-quick-insight-v1.1.zip`

## 1) Upload Package

- [ ] Upload `dist/pr-quick-insight-v1.1.zip`
- [ ] Confirm package parses with no manifest errors

## 2) Store Listing

- [ ] **Extension name**: PR Quick Insight
- [ ] **Short description**: AI-powered GitHub PR analysis with security, breaking changes, and code quality insights
- [ ] **Detailed description**: Use project README summary and feature bullets
- [ ] **Category**: Developer Tools (recommended)
- [ ] **Language**: English (or add localized listing)

## 3) Visual Assets (Manual)

- [x] App icon ready: `assets/icons/icon-128.png` (validated 128x128 PNG)
- [x] Screenshots prepared (1280x800 PNG):
  - `assets/store-screenshots/01-home.png`
  - `assets/store-screenshots/02-modal.png`
  - `assets/store-screenshots/03-popup.png`
- [ ] Add optional promo graphics if desired

## 4) Privacy & Data Disclosure

- [ ] Provide publicly hosted **Privacy Policy URL** (content source: `PRIVACY.md`)
- [ ] Declare data handling in CWS "Data usage" form:
  - User-provided PR text/content sent for AI analysis
  - Technical/license usage data for plan activation and abuse prevention
- [ ] Mark data is not sold (if true for your org)
- [ ] Mark encryption in transit (if true for your endpoints)

## 5) Permissions Justification

Current permissions in `manifest.json`:
- `storage`: persist API key/settings/license state locally
- `tabs`: open checkout link from popup (`chrome.tabs.create`)

Current host permissions:
- `https://github.com/*/*/pull/*`
- `https://api.prorisk.com/*`
- `https://api.github.com/*`

- [ ] Add concise justifications for each in CWS form

## 6) Policy/Risk Sanity Checks

- [ ] No secrets in package (no `.env*`, no tokens)
- [ ] No remote code execution patterns (`eval`, `new Function`)
- [ ] No broken file references from manifest
- [ ] Background/content logs are production-gated

## 7) Final QA Before Publish

- [ ] Load ZIP as unpacked equivalent and smoke test on 2-3 GitHub PR pages
- [ ] Verify popup save/load for API key and license
- [ ] Verify report generation opens correctly
- [ ] Verify paid feature gates behave as expected (free vs pro)

## 8) Post-Publish

- [ ] Tag release in repo (optional)
- [ ] Keep changelog notes for next update
- [ ] Monitor CWS review feedback and crash reports
