'use strict';

chrome.commands.onCommand.addListener(function (command) {
  if (command === 'open-dashboard') {
    const url = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.query({ url: url }, function (tabs) {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: url });
      }
    });
  }
});
