// ============================================================================
// USAGE LIMITER IMPLEMENTATION GUIDE
// FREE Plan: 5 analyses per 24 hours
// PRO Plan: Unlimited analyses
// ============================================================================
//
// This guide explains how the usage limiting system works and what happens
// when a FREE user reaches their daily analysis limit.
//
// ============================================================================
// QUICK OVERVIEW
// ============================================================================
//
// 1. User clicks "SCAN PR" button
// 2. System checks daily usage counter (UsageLimiter.canAnalyze())
// 3. If limit reached → Show error "Daily limit reached. Resets in 2h 30m"
// 4. If under limit → Proceed with analysis + increment counter
// 5. Display results with limited content for FREE users
// 6. Show usage indicator: "2/5 scans used"
//
// ============================================================================
// DAILY LIMITS
// ============================================================================
//
// FREE Plan:  5 analyses per 24 hours
// PRO Plan:   999 analyses per 24 hours (essentially unlimited)
//
// Counter resets automatically at 24:00 UTC+0 equivalent to when last reset
// Example: If user analyzes at 2:00 PM, counter resets at 2:00 PM next day
//
// ============================================================================
// WHAT HAPPENS AT LIMIT
// ============================================================================
//
// When FREE user clicks SCAN PR and limit is reached:
//
// ❌ Error shown: "Daily limit reached (5/5 scans)"
// ❌ Analysis NOT performed (saves API quota)
// ❌ Counter NOT incremented
// ✅ User sees time until reset: "Resets in 2h 30m"
// ✅ Upgrade prompt shown
//
// ============================================================================
// LIMITED CONTENT FOR FREE USERS
// ============================================================================
//
// Even if under limit, FREE users see limited analysis results:
//
// FEATURE                          | FREE USERS    | PRO USERS
// ─────────────────────────────────┼───────────────┼──────────
// Basic Risk Score                 | ✓ Full        | ✓ Full
// Summary Points                   | ✓ 3 of 5      | ✓ All 5
// Security Issues                  | ✓ 1 of N      | ✓ All
// Breaking Changes                 | ✓ All         | ✓ All
// Test Coverage Grade              | ✓ Yes         | ✓ Yes
// Commit Message Suggestion        | ✗ Hidden*     | ✓ Shown
// Critical Issues                  | ✓ All         | ✓ All
//
// * Feature-gated by canSuggestCommitMessage flag
//
// ============================================================================
// USAGE TRACKING STORAGE
// ============================================================================
//
// Data stored in chrome.storage.local under key "usageData":
//
// {
//   count: 3,                              // Current usage count
//   resetTime: 1677456000000,              // Epoch ms when counter resets
//   plan: 'FREE'                           // User's current plan
// }
//
// This data persists across:
// ✓ Browser tab reloads
// ✓ GitHub page navigation
// ✓ Browser restarts (except Incognito)
//
// Storage is cleared when:
// ✓ 24 hours pass
// ✗ Never manually cleared by user (unless via DevTools)
//
// ============================================================================
// MODULE API
// ============================================================================
//
// const usage = await UsageLimiter.canAnalyze('FREE');
// {
//   canAnalyze: true,              // Can user perform analysis?
//   remaining: 2,                  // Scans left today
//   limit: 5,                      // Daily limit for plan
//   used: 3,                       // Scans already used
//   resetTime: 1677456000000,      // When counter resets
//   plan: 'FREE'                   // User's plan
// }
//
// await UsageLimiter.incrementUsage('FREE');
// // Increments counter and saves to storage
//
// const ms = await UsageLimiter.getTimeUntilReset();
// // Returns milliseconds until next reset (e.g. 9000000 = 2h 30m)
//
// const str = UsageLimiter.formatTimeRemaining(9000000);
// // Returns formatted string: "2h 30m"
//
// const msg = await UsageLimiter.getUsageMessage('FREE');
// // Returns user-friendly message with remaining scans
//
// ============================================================================
// IMPLEMENTATION FLOW
// ============================================================================
//
// 1. User clicks "▶ SCAN PR"
//    ↓
// 2. handleAnalyzePR() called
//    ↓
// 3. Extract PR metadata
//    ↓
// 4. Get API key
//    ↓
// 5. ✨ CHECK USAGE LIMIT ✨ ← NEW STEP
//    ├─ UsageLimiter.canAnalyze(plan)
//    ├─ If remaining = 0 → THROW ERROR
//    └─ If remaining > 0 → continue
//    ↓
// 6. Call OpenAI API for analysis
//    ↓
// 7. ✨ INCREMENT USAGE ✨ ← NEW STEP
//    └─ UsageLimiter.incrementUsage(plan)
//    ↓
// 8. Get updated remaining count
//    ↓
// 9. Display results (with plan-specific limits)
//    ├─ Limit summary to 3 points (FREE)
//    ├─ Show only 1 security issue (FREE)
//    └─ Show usage bar: "2/5"
//    ↓
// 10. Show usage indicator at bottom of panel
//     └─ "2/5 scans remaining today"
//
// ============================================================================
// PRO UNLOCK OVERLAYS
// ============================================================================
//
// When FREE user hovers over limited content:
//
// ┌────────────────────────────────┐
// │    Security Issues             │
// │  • SQL Injection vulnerability │
// │                                │
// │  ┌──────────────────────────┐  │
// │  │   🔒  Unlock Pro to view │  │
// │  │   4 more issues          │  │
// │  └──────────────────────────┘  │
// └────────────────────────────────┘
//
// Overlay styling:
// - Semi-transparent red gradient background
// - Dashed red border
// - Pulsing lock icon 🔒
// - Centered text overlay
// - Blur effect: backdrop-filter: blur(3px)
//
// ============================================================================
// TESTING USAGE LIMITS
// ============================================================================
//
// Test 1: Use all 5 scans (FREE plan)
// ─────────────────────────────────
// 1. Open extension → Go to any PR
// 2. Click "SCAN PR" 5 times
// 3. After 5th scan → "Daily limit reached"
// 4. Error message includes reset time
// 5. Reset button visible (refreshes ✓)
//
// Test 2: Upgrade to PRO
// ──────────────────────
// 1. Open popup → License tab
// 2. Generate test key
// 3. Activate license
// 4. Limit reached message should disappear
// 5. PRO users can scan unlimited times
//
// Test 3: Downgrade to FREE
// ─────────────────────────
// 1. From PRO, remove license
// 2. Counter resets to show limit again
// 3. Usage tracking resumes for FREE tier
//
// Test 4: Manual reset (for development)
// ──────────────────────────────────────
// 1. In browser console:
//    UsageLimiter.resetUsage()
// 2. Counter resets to 0
// 3. All 5 scans available again
//
// ============================================================================
// STORAGE MANAGEMENT
// ============================================================================
//
// View current usage in browser DevTools:
// 1. Open DevTools → Application/Storage tab
// 2. Chrome Storage → chrome.storage.local
// 3. Look for "usageData" key
// 4. Shows { count, resetTime, plan }
//
// Clear usage manually (for testing):
// 1. Console: chrome.storage.local.remove('usageData')
// 2. Counter resets, all scans available
//
// Inspect reset time:
// 1. Console: UsageLimiter.getTimeUntilReset()
// 2. Shows milliseconds until reset
// 3. Or: UsageLimiter.getUsageMessage('FREE')
// 4. Shows human-readable reset time
//
// ============================================================================
// ERROR MESSAGES
// ============================================================================
//
// Error: Daily limit reached (5/5 scans). Resets in 1h 30m.
// Solution: Wait for reset or upgrade to PRO
//
// Error: Daily limit reached (3/5 scans). Resets in 2h.
// Solution: Pro unlock available in popup → License tab
//
// ============================================================================
// INTERACTION WITH OTHER SYSTEMS
// ============================================================================
//
// ✓ Compatible with Feature Flags system:
//   - canSuggestCommitMessage still controlled by featureFlags
//   - Usage limits are separate from feature gating
//
// ✓ Compatible with License Manager:
//   - Automatically integrates with current plan detection
//   - When license activated → Limits change from 5 to 999
//
// ✓ Works with OpenAI API:
//   - Prevents API calls when limit reached (saves quota)
//   - Counter only incremented on successful analysis
//
// ============================================================================
// FUTURE ENHANCEMENTS
// ============================================================================
//
// Stage 2: Analytics
// - Track which hours are used most
// - Show "Peak usage time" metrics
// - Suggest "best times to analyze"
//
// Stage 3: Per-repo usage
// - Track usage by repository
// - Show "Repo usage breakdown"
//
// Stage 4: Usage plans
// - Consider tiered PRO plans:
//   - PRO: 999 scans/day
//   - ENTERPRISE: Custom limits
//
// ============================================================================
