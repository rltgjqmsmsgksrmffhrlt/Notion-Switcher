'use strict';
// Mock of the chrome extension APIs so popup.html / dashboard.html render in a normal browser.
(function () {
  var SAMPLE = {
    workspaces: [
      { id: '1', name: '제품 기획', url: 'https://www.notion.so/product-planning', emoji: '🚀', folderId: 'f1' },
      { id: '2', name: '디자인 시스템', url: 'https://www.notion.so/design-system', emoji: '🎨', folderId: 'f1' },
      { id: '3', name: '엔지니어링 위키', url: 'https://www.notion.so/eng-wiki', emoji: '🛠', folderId: 'f1' },
      { id: '4', name: '마케팅 캠페인', url: 'https://www.notion.so/marketing-q3', emoji: '📣', folderId: 'f2' },
      { id: '5', name: '콘텐츠 캘린더', url: 'https://www.notion.so/content-calendar', emoji: '🗓', folderId: 'f2' },
      { id: '6', name: '회사 위키', url: 'https://www.notion.so/company-wiki', emoji: '🏢', folderId: null },
      { id: '7', name: '개인 노트', url: 'https://www.notion.so/personal-notes', emoji: '📓', folderId: null },
      { id: '8', name: '독서 기록', url: 'https://www.notion.so/reading-list', emoji: '📚', folderId: null },
    ],
    folders: [
      { id: 'f1', name: '프로덕트', emoji: '💼' },
      { id: 'f2', name: '마케팅', emoji: '📊' },
    ],
  };

  var store = JSON.parse(JSON.stringify(SAMPLE));
  try {
    var saved = localStorage.getItem('__ns_preview');
    if (saved) store = JSON.parse(saved);
  } catch (e) {}
  function persist() { try { localStorage.setItem('__ns_preview', JSON.stringify(store)); } catch (e) {} }

  var listeners = [];

  window.chrome = {
    storage: {
      sync: {
        get: function (keys, cb) {
          var out = {};
          (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { out[k] = store[k]; });
          setTimeout(function () { cb(out); }, 0);
        },
        set: function (obj, cb) {
          var changes = {};
          Object.keys(obj).forEach(function (k) {
            changes[k] = { oldValue: store[k], newValue: obj[k] };
            store[k] = obj[k];
          });
          persist();
          setTimeout(function () {
            if (cb) cb();
            listeners.forEach(function (l) { l(changes, 'sync'); });
          }, 0);
        },
      },
      onChanged: { addListener: function (fn) { listeners.push(fn); } },
    },
    tabs: {
      query: function (q, cb) {
        var res = [{ id: 1, url: 'https://www.notion.so/product-planning', windowId: 1, active: true }];
        if (cb) { setTimeout(function () { cb(res); }, 0); return; }
        return Promise.resolve(res);
      },
      update: function () { return Promise.resolve(); },
      create: function (opts) { window.open(opts.url, '_blank'); return Promise.resolve(); },
    },
    windows: { update: function () { return Promise.resolve(); } },
    runtime: { getURL: function (p) { return p; } },
    commands: {
      getAll: function (cb) {
        setTimeout(function () {
          cb([
            { name: '_execute_action', shortcut: 'Alt+N' },
            { name: 'open-dashboard', shortcut: 'Alt+Shift+N' },
          ]);
        }, 0);
      },
    },
  };
})();
