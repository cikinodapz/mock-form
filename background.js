// mock-form - background.js

function updateDisplayMode(mode) {
  if (mode === 'widget') {
    chrome.action.setPopup({ popup: "" });
  } else {
    // Default: popup or contextual
    chrome.action.setPopup({ popup: "popup.html" });
  }
}

// Init mode on startup
chrome.storage.local.get(['displayMode'], (data) => {
  updateDisplayMode(data.displayMode || 'popup');
});

// Listen for mode changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.displayMode) {
    updateDisplayMode(changes.displayMode.newValue || 'popup');
  }
});

// Handle icon click for widget mode
chrome.action.onClicked.addListener(async (tab) => {
  const data = await chrome.storage.local.get(['displayMode']);
  if (data.displayMode === 'widget') {
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'toggleWidget' });
    } catch (e) {
      console.log('Could not send toggleWidget to content script', e);
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'auto_fill_form') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'triggerAutofillShortcut' }, () => {
          if (chrome.runtime.lastError) {
            console.log('[mock-form] Shortcut error or content script not ready:', chrome.runtime.lastError.message);
          }
        });
      }
    } catch (e) {
      console.log('[mock-form] Failed to trigger shortcut autofill:', e);
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('mock-form Extension Installed');
});

