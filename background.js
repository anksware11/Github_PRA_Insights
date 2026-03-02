// ============================================================================
// BACKGROUND SERVICE WORKER
// Handles background tasks and event listeners
// ============================================================================

const DEBUG_BACKGROUND = false;
function backgroundLog(...args) {
  if (DEBUG_BACKGROUND) {
    console.log(...args);
  }
}

backgroundLog('[Background] Service worker initialized');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    backgroundLog('[Background] Extension installed');
    // Open onboarding page or show message
  } else if (details.reason === 'update') {
    backgroundLog('[Background] Extension updated');
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  backgroundLog('[Background] Message received:', request);

  if (request.action === 'getLicenseInfo') {
    // License info will be handled by popup
    sendResponse({ status: 'ok' });
  }
});
