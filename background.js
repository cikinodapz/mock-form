// Gemini AutoFill - background.js
// Mengatur agar Side Panel terbuka saat ikon ekstensi diklik

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listener tambahan jika diperlukan di masa depan
chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini AutoFill Extension Installed');
});
