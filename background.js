// mock-form - background.js

function updateDisplayMode(mode) {
  if (mode === 'popup' || mode === 'contextual') {
    chrome.action.setPopup({ popup: "popup.html" });
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
  } else if (mode === 'widget') {
    chrome.action.setPopup({ popup: "" });
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
  } else {
    // Default: sidepanel
    chrome.action.setPopup({ popup: "" });
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  }
}

// Init mode on startup
chrome.storage.local.get(['displayMode'], (data) => {
  updateDisplayMode(data.displayMode || 'sidepanel');
});

// Listen for mode changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.displayMode) {
    updateDisplayMode(changes.displayMode.newValue || 'sidepanel');
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

chrome.runtime.onInstalled.addListener(() => {
  console.log('mock-form Extension Installed');
});
