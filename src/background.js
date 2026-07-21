/*
 * Cam360 — background.js (service worker)
 * Relays the keyboard shortcut to the active tab's bridge so the
 * in-call panel can be toggled without opening the popup.
 */
chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-overlay") return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { __cam360: "toggleOverlay" }, () => void chrome.runtime.lastError);
    }
  });
});
