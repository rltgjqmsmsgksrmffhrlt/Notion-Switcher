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
      { id: '9', name: '임시 회의록', url: 'https://www.notion.so/temp-meeting', emoji: '⏰', folderId: null, expireAt: Date.now() + 3 * 86400000 },
      { id: '10', name: '오늘 만료 링크', url: 'https://www.notion.so/expiring-today', emoji: '⚠️', folderId: 'f2', expireAt: Date.now() + 12 * 3600000 },
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

  var localStore = { onboardingDone: true };
  var listeners = [];

  function makeSyncLike(obj, persistFn) {
    return {
      get: function (keys, cb) {
        var out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { out[k] = obj[k]; });
        setTimeout(function () { cb(out); }, 0);
      },
      set: function (data, cb) {
        var changes = {};
        Object.keys(data).forEach(function (k) {
          changes[k] = { oldValue: obj[k], newValue: data[k] };
          obj[k] = data[k];
        });
        if (persistFn) persistFn();
        setTimeout(function () {
          if (cb) cb();
          listeners.forEach(function (l) { l(changes, 'sync'); });
        }, 0);
      },
      remove: function (key, cb) {
        var keys = Array.isArray(key) ? key : [key];
        keys.forEach(function (k) { delete obj[k]; });
        setTimeout(function () { if (cb) cb(); }, 0);
      },
    };
  }

  window.chrome = {
    storage: {
      sync: makeSyncLike(store, persist),
      local: makeSyncLike(localStore),
      onChanged: { addListener: function (fn) { listeners.push(fn); } },
    },
    tabs: {
      query: function (q, cb) {
        var res = [{ id: 1, url: 'https://app.notion.com/product-planning', title: '제품 기획 — Notion', windowId: 1, active: true }];
        if (cb) { setTimeout(function () { cb(res); }, 0); return; }
        return Promise.resolve(res);
      },
      update: function () { return Promise.resolve(); },
      create: function (opts) { window.open(opts.url, '_blank'); return Promise.resolve(); },
    },
    windows: { update: function () { return Promise.resolve(); } },
    runtime: { getURL: function (p) { return '../' + p; } },
    i18n: { getMessage: function (key) { return ''; } },
    commands: { getAll: function (cb) { if (cb) setTimeout(function () { cb([]); }, 0); return Promise.resolve([]); } },
  };
})();
