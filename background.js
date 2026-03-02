// ============================================================================
// BACKGROUND SERVICE WORKER
// Handles background tasks and event listeners
// ============================================================================

console.log('[Background] Service worker initialized');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');
    // Open onboarding page or show message
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated');
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request);

  if (request.action === 'getLicenseInfo') {
    // License info will be handled by popup
    sendResponse({ status: 'ok' });
  }
});
