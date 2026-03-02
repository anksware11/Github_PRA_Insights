// ============================================================================
// POPUP.JS - Handles API key and License key management
// This script runs in the popup window when user clicks the extension icon
// ============================================================================

// Load data on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedApiKey();
  await loadLicenseStatus();
  setupTabNavigation();
  setupEventListeners();
});

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.prs-tab-btn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.prs-tab-content').forEach(content => {
    content.classList.remove('prs-tab-active');
  });

  // Remove active class from all buttons
  document.querySelectorAll('.prs-tab-btn').forEach(btn => {
    btn.classList.remove('prs-tab-active');
  });

  // Show selected tab
  const tabContent = document.getElementById(tabName + 'Tab');
  if (tabContent) {
    tabContent.classList.add('prs-tab-active');
  }

  // Mark button as active
  const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (tabBtn) {
    tabBtn.classList.add('prs-tab-active');
  }
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
  // API Key
  const saveBtn = document.getElementById('saveBtnPopup');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveApiKey);
  }

  const apiKeyInput = document.getElementById('apiKeyInput');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveApiKey();
      }
    });
  }

  // License Key
  const saveLicenseBtn = document.getElementById('saveLicenseBtnPopup');
  if (saveLicenseBtn) {
    saveLicenseBtn.addEventListener('click', saveLicense);
  }

  const removeLicenseBtn = document.getElementById('removeLicenseBtnPopup');
  if (removeLicenseBtn) {
    removeLicenseBtn.addEventListener('click', removeLicense);
  }

  const licenseKeyInput = document.getElementById('licenseKeyInput');
  if (licenseKeyInput) {
    licenseKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveLicense();
      }
    });
  }

  // Get Pro License — opens payment page in a new tab
  const getProBtn = document.getElementById('getProLicenseBtn');
  if (getProBtn) {
    getProBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://prorisk.com/upgrade' });
    });
  }
}

// ============================================================================
// LOAD SAVED API KEY
// ============================================================================

async function loadSavedApiKey() {
  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');

    if (apiKey) {
      const input = document.getElementById('apiKeyInput');
      input.value = maskApiKey(apiKey);
      input.dataset.originalKey = apiKey;
    }
  } catch (error) {
    console.error('[Popup] Error loading API key:', error);
  }
}

// ============================================================================
// SAVE API KEY
// ============================================================================

async function saveApiKey() {
  const input = document.getElementById('apiKeyInput');
  let apiKey = input.value.trim();

  // Check if input is the masked version
  if (apiKey === input.dataset.originalKey) {
    showMessage('API key unchanged', 'info', 'popupMessage');
    return;
  }

  // Validate API key
  if (!apiKey) {
    showMessage('Please enter an API key', 'error', 'popupMessage');
    return;
  }

  if (!apiKey.startsWith('sk-')) {
    showMessage('API key should start with "sk-"', 'error', 'popupMessage');
    return;
  }

  if (apiKey.length < 20) {
    showMessage('API key seems too short', 'error', 'popupMessage');
    return;
  }

  if (!/^[\x20-\x7E]+$/.test(apiKey)) {
    showMessage('API key contains invalid characters', 'error', 'popupMessage');
    return;
  }

  try {
    await chrome.storage.local.set({ apiKey });
    input.dataset.originalKey = apiKey;
    input.value = maskApiKey(apiKey);
    showMessage('✓ API key saved successfully!', 'success', 'popupMessage');
  } catch (error) {
    console.error('[Popup] Error saving API key:', error);
    showMessage('Error saving API key', 'error', 'popupMessage');
  }
}

// ============================================================================
// LOAD LICENSE STATUS
// ============================================================================

async function loadLicenseStatus() {
  try {
    const licenseInfo = await LicenseManager.getLicenseInfo();

    // If no legacy key, also check for HMAC-signed license in proLicense
    if (!licenseInfo.isActive && typeof LicenseValidator !== 'undefined') {
      const isHmacValid = await LicenseValidator.isStoredLicenseValid();
      if (isHmacValid) {
        const hmacStored = await LicenseValidator.getStoredLicense();
        licenseInfo.isActive = true;
        licenseInfo.plan = 'PRO';
        licenseInfo.isPro = true;
        // Show email as masked identifier for HMAC licenses
        const maskedEmail = hmacStored?.email
          ? hmacStored.email.replace(/(.{2}).+(@.+)/, '$1***$2')
          : 'HMAC License';
        licenseInfo.license = maskedEmail;
      }
    }

    updatePlanBadge(licenseInfo.plan);
    updateLicenseStatus(licenseInfo);
  } catch (error) {
    console.error('[Popup] Error loading license status:', error);
    updatePlanBadge('FREE');
  }
}

function updatePlanBadge(plan) {
  const badge = document.getElementById('planBadge');
  const planText = document.getElementById('planText');

  if (badge) {
    badge.className = `prs-plan-badge prs-plan-${plan.toLowerCase()}`;
  }

  if (planText) {
    if (plan === 'PRO') {
      planText.textContent = '⭐ Pro Unlocked';
    } else {
      planText.textContent = '📦 Free Plan';
    }
  }
}

function updateLicenseStatus(licenseInfo) {
  const statusDiv = document.getElementById('licenseStatus');
  const licenseInput = document.getElementById('licenseInput');
  const removeLicenseBtn = document.getElementById('removeLicenseBtnPopup');

  if (licenseInfo.isActive) {
    // Show status, hide input
    if (statusDiv) statusDiv.style.display = 'block';
    if (licenseInput) licenseInput.style.display = 'none';

    document.getElementById('statusPlan').textContent = licenseInfo.plan === 'PRO' ? 'Pro Unlocked' : 'Free Plan';
    document.getElementById('statusLicense').textContent = licenseInfo.license;

    if (removeLicenseBtn) removeLicenseBtn.style.display = 'block';
  } else {
    // Show input, hide status
    if (statusDiv) statusDiv.style.display = 'none';
    if (licenseInput) licenseInput.style.display = 'block';

    if (removeLicenseBtn) removeLicenseBtn.style.display = 'none';
  }
}

// ============================================================================
// SAVE LICENSE
// ============================================================================

async function saveLicense() {
  const input = document.getElementById('licenseKeyInput');
  const licenseKey = input.value.trim();

  if (!licenseKey) {
    showMessage('Please enter a license key', 'error', 'licenseMessage');
    return;
  }

  try {
    // Only HMAC-signed licenses accepted: "PRORISK|email|expiry|signature"
    const isHmacFormat = licenseKey.startsWith('PRORISK|') && licenseKey.split('|').length === 4;

    if (!isHmacFormat) {
      showMessage(
        'Invalid license key. Please paste the key from your account dashboard.',
        'error',
        'licenseMessage'
      );
      return;
    }

    if (typeof LicenseValidator === 'undefined') {
      showMessage('License validator unavailable. Please reload the extension.', 'error', 'licenseMessage');
      return;
    }

    const validation = await LicenseValidator.validateLicense(licenseKey);
    if (!validation.isValid) {
      const msg = validation.errors.length > 0 ? validation.errors[0] : 'License validation failed';
      showMessage(msg, 'error', 'licenseMessage');
      return;
    }
    await LicenseValidator.storeLicense(validation, licenseKey);

    // Update UI
    input.value = '';
    await loadLicenseStatus();

    showMessage('✓ License activated successfully!', 'success', 'licenseMessage');
  } catch (error) {
    console.error('[Popup] Error saving license:', error);
    showMessage('Error saving license: ' + error.message, 'error', 'licenseMessage');
  }
}

// ============================================================================
// REMOVE LICENSE
// ============================================================================

async function removeLicense() {
  if (!confirm('Remove license and revert to Free Plan?')) {
    return;
  }

  try {
    // Clear legacy key
    await LicenseManager.removeLicense();
    // Clear HMAC license if present
    if (typeof LicenseValidator !== 'undefined') {
      await LicenseValidator.clearLicense();
    }
    await loadLicenseStatus();
    showMessage('✓ License removed. Reverted to Free Plan.', 'success', 'licenseMessage');
  } catch (error) {
    console.error('[Popup] Error removing license:', error);
    showMessage('Error removing license', 'error', 'licenseMessage');
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function maskApiKey(key) {
  if (key.length <= 9) return key;
  return key.substring(0, 5) + '•'.repeat(Math.max(0, key.length - 9)) + key.substring(key.length - 4);
}

function showMessage(text, type, elementId = 'popupMessage') {
  const messageDiv = document.getElementById(elementId);
  if (!messageDiv) return;

  messageDiv.textContent = text;
  messageDiv.className = `prs-popup-message prs-message-${type}`;
  messageDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}
