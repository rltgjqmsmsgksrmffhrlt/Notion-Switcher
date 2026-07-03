'use strict';
/* Settings panel — theme (system/light/dark) + editable shortcuts with conflict check.
   Shared by popup + dashboard. Loaded after ui.js, before page scripts. */

window.Settings = (function () {
  var SC_KEY = 'ns_shortcuts';

  // Shortcut catalog. scope:'global' = Chrome-managed (read-only here),
  // scope:'page' = handled in-page (fully editable + applied live).
  var DEFS = [
    { id: 'popup',     labelKey: 'scPopup',        subKey: 'scGlobalChrome', scope: 'global', def: 'Alt+N' },
    { id: 'dashboard', labelKey: 'scDashboard',    subKey: 'scGlobalChrome', scope: 'global', def: 'Alt+Shift+N' },
    { id: 'focusSearch',       labelKey: 'scFocusSearch',  subKey: 'scScopeDashboard',  scope: 'page', def: '/' },
    { id: 'openDashFromPopup', labelKey: 'scPopupToDash', subKey: 'scScopePopup',     scope: 'page', def: 'D' },
  ];

  // In-page keys that are fixed / reserved (can't be reassigned to).
  var RESERVED = ['1','2','3','4','5','6','7','8','9','Enter','Escape','Tab'];

  function loadOverrides() {
    try { return JSON.parse(localStorage.getItem(SC_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveOverrides(o) {
    try { localStorage.setItem(SC_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function def(id) { var d = DEFS.find(function (x) { return x.id === id; }); return d ? d.def : ''; }
  function get(id) { var o = loadOverrides(); return o[id] || def(id); }
  function assignments() {
    var map = {};
    DEFS.forEach(function (d) { map[d.id] = get(d.id); });
    return map;
  }

  // ── key combo helpers ──
  function formatEvent(e) {
    var k = e.key;
    if (k === 'Control' || k === 'Alt' || k === 'Shift' || k === 'Meta') return null; // lone modifier
    var mods = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Cmd');
    if (k === ' ') k = 'Space';
    else if (k.length === 1) k = k.toUpperCase();
    return mods.concat([k]).join('+');
  }

  function matches(e, combo) {
    if (!combo) return false;
    var parts = combo.split('+');
    var key = parts[parts.length - 1];
    if (e.ctrlKey !== (parts.indexOf('Ctrl') >= 0)) return false;
    if (e.altKey !== (parts.indexOf('Alt') >= 0)) return false;
    if (e.shiftKey !== (parts.indexOf('Shift') >= 0)) return false;
    if (e.metaKey !== (parts.indexOf('Cmd') >= 0)) return false;
    var ek = e.key;
    if (ek === ' ') ek = 'Space';
    else if (ek.length === 1) ek = ek.toUpperCase();
    return ek === key;
  }

  // returns null if ok, else a conflict description
  function conflictOf(combo, forId) {
    var d = DEFS.find(function (x) { return x.id === forId; });
    var bareKey = combo.split('+').pop();
    var hasMod = combo.indexOf('+') >= 0;
    if (d && d.scope === 'page' && !hasMod && RESERVED.indexOf(bareKey) >= 0) {
      return { type: 'reserved', label: t('conflictReserved', [bareKey]) };
    }
    var map = assignments();
    var hit = null;
    Object.keys(map).forEach(function (id) {
      if (id !== forId && map[id] && map[id].toUpperCase() === combo.toUpperCase()) {
        var od = DEFS.find(function (x) { return x.id === id; });
        hit = { type: 'shortcut', label: t('conflictShortcut', [od ? t(od.labelKey) : id]) };
      }
    });
    return hit;
  }

  // ── UI ──
  function chip(combo) {
    var html = '<span class="kbd-chip">';
    combo.split('+').forEach(function (p) { html += '<kbd>' + p + '</kbd>'; });
    return html + '</span>';
  }

  function loadAppSettings() {
    return new Promise(function (r) { chrome.storage.sync.get(['settings'], function (d) { r(d.settings || {}); }); });
  }
  function saveAppSettings(s) {
    return new Promise(function (r) { chrome.storage.sync.set({ settings: s }, r); });
  }

  var overlay = null, recording = null, appSettings = {};

  function close() {
    if (overlay) overlay.classList.remove('open');
    stopRecording();
  }

  function stopRecording() {
    if (recording) { window.removeEventListener('keydown', recording.handler, true); recording = null; }
  }

  function render() {
    var theme = Theme.get();
    var seg = ['system','light','dark'].map(function (m) {
      var label = m === 'system' ? t('themeSystem') : (m === 'light' ? t('themeLight') : t('themeDark'));
      return '<button data-theme-opt="' + m + '" class="' + (theme === m ? 'on' : '') + '">' + label + '</button>';
    }).join('');

    var rows = DEFS.map(function (d) {
      var combo = get(d.id);
      var right = d.scope === 'page'
        ? '<button class="sc-edit" data-edit="' + d.id + '">' + t('change') + '</button>'
        : '';
      var scopeBadge = d.scope === 'global'
        ? '<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--field);color:var(--ink-3);flex-shrink:0">' + t('scopeGlobal') + '</span>'
        : '<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-soft);color:var(--accent);flex-shrink:0">' + t('scopeInApp') + '</span>';
      return '<div class="sc-row" data-row="' + d.id + '">' +
        '<div class="sc-meta">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<div class="sc-label">' + t(d.labelKey) + '</div>' +
            scopeBadge +
          '</div>' +
          '<div class="sc-sub">' + t(d.subKey) + '</div>' +
          '<div class="sc-error" data-err="' + d.id + '" style="display:none"></div>' +
        '</div>' +
        '<div class="sc-keys" data-keys="' + d.id + '">' + chip(combo) + '</div>' +
        right +
      '</div>';
    }).join('');

    var hideChecked = appSettings.hideUncategorized ? ' checked' : '';

    overlay.querySelector('.set-panel').innerHTML =
      '<div class="set-title-row"><div class="set-title">' + t('settingsTitle') + '</div>' +
        '<button class="btn-icon" data-close="1" title="' + t('close') + '">✕</button></div>' +
      '<div class="set-section">' +
        '<div class="set-h">' + t('theme') + '</div>' +
        '<div class="seg" data-seg="theme">' + seg + '</div>' +
      '</div>' +
      '<div class="set-section">' +
        '<label class="set-check-row">' +
          '<span>' + t('hideUncategorized') + '</span>' +
          '<input type="checkbox" id="chk-hide-uncat"' + hideChecked + '>' +
        '</label>' +
      '</div>' +
      '<div class="set-section" id="clear-section">' +
        '<button class="sc-danger-btn" data-clear-all="1">' + t('clearAll') + '</button>' +
      '</div>' +
      '<div class="set-section">' +
        '<div class="set-h">' + t('shortcuts') + '</div>' + rows +
      '</div>' +
      '<div class="set-section set-bottom">' +
        '<button class="sc-chrome-btn" data-chrome="1">' + t('chromeShortcuts') + '</button>' +
        '<div class="sc-note">' + t('chromeShortcutsNote') + '</div>' +
      '</div>' +
      '<div class="set-section">' +
        '<div class="tip-card">' +
          '<div class="tip-emoji">☕</div>' +
          '<div class="tip-title">' + t('tipTitle') + '</div>' +
          '<div class="tip-desc">' + t('tipDesc') + '</div>' +
          '<div class="tip-tabs">' +
            '<button class="tip-tab on" data-qr-tab="toss">' + t('tipToss') + '</button>' +
            '<button class="tip-tab" data-qr-tab="kakao">' + t('tipKakao') + '</button>' +
          '</div>' +
          '<div class="tip-qr">' +
            '<img class="tip-qr-img" data-qr="toss" src="icons/qr-toss.png" alt="QR">' +
            '<img class="tip-qr-img" data-qr="kakao" src="icons/qr-kakao.png" alt="QR" style="display:none">' +
          '</div>' +
          '<div class="tip-qr-hint">' + t('tipQrHint') + '</div>' +
          '<div class="tip-account" data-copy-account="1">' + t('tipAccount') + ' <span class="tip-copy">' + t('copy') + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="set-section">' +
        '<div class="tip-card">' +
          '<div class="tip-emoji">💬</div>' +
          '<div class="tip-title">' + t('feedbackTitle') + '</div>' +
          '<div class="tip-desc">' + t('feedbackDesc') + '</div>' +
          '<iframe data-tally-src="https://tally.so/embed/9qxE61?alignLeft=1&hideTitle=1&transparentBackground=1" loading="lazy" width="100%" height="340" frameborder="0" marginheight="0" marginwidth="0" title="Feedback" scrolling="no" style="border:none;border-radius:var(--r-md);margin-top:10px;overflow:hidden;background:#fff"></iframe>' +
        '</div>' +
      '</div>';
  }

  function beginRecording(id) {
    stopRecording();
    var keysEl = overlay.querySelector('[data-keys="' + id + '"]');
    var errEl = overlay.querySelector('[data-err="' + id + '"]');
    var editBtn = overlay.querySelector('[data-edit="' + id + '"]');
    errEl.style.display = 'none';
    keysEl.innerHTML = '<span class="sc-recording">' + t('recordingKey') + '</span>';
    if (editBtn) editBtn.textContent = t('cancel');

    var handler = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { stopRecording(); render(); bind(); return; }
      var combo = formatEvent(e);
      if (!combo) return; // waiting for a non-modifier key
      var c = conflictOf(combo, id);
      if (c) {
        errEl.textContent = '⚠ ' + chipText(combo) + ' — ' + c.label;
        errEl.style.display = 'block';
        keysEl.innerHTML = '<span class="sc-recording">' + t('recordingRetry') + '</span>';
        return;
      }
      var o = loadOverrides();
      o[id] = combo;
      saveOverrides(o);
      stopRecording();
      render();
      bind();
    };
    recording = { id: id, handler: handler };
    window.addEventListener('keydown', handler, true);
  }

  function chipText(combo) { return combo.replace(/\+/g, ' + '); }

  function bind() {
    overlay.querySelector('[data-close]').onclick = close;
    overlay.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.onclick = function () { Theme.set(b.dataset.themeOpt); render(); bind(); };
    });
    var hideChk = overlay.querySelector('#chk-hide-uncat');
    if (hideChk) {
      hideChk.onchange = function () {
        appSettings.hideUncategorized = hideChk.checked;
        saveAppSettings(appSettings);
      };
    }
    var clearBtn = overlay.querySelector('[data-clear-all]');
    if (clearBtn) {
      clearBtn.onclick = function () {
        var sec = overlay.querySelector('#clear-section');
        sec.innerHTML =
          '<div class="clear-confirm">' +
            '<div class="clear-confirm-icon">⚠️</div>' +
            '<div class="clear-confirm-msg">' + t('clearAllConfirm') + '</div>' +
            '<div class="clear-confirm-btns">' +
              '<button class="clear-cancel-btn" data-clear-cancel="1">' + t('cancel') + '</button>' +
              '<button class="clear-yes-btn" data-clear-yes="1">' + t('clearAllYes') + '</button>' +
            '</div>' +
          '</div>';
        sec.querySelector('[data-clear-cancel]').onclick = function () { render(); bind(); };
        sec.querySelector('[data-clear-yes]').onclick = function () {
          chrome.storage.sync.set({ workspaces: [], folders: [] }, function () { location.reload(); });
        };
      };
    }
    overlay.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        if (recording && recording.id === b.dataset.edit) { stopRecording(); render(); bind(); }
        else beginRecording(b.dataset.edit);
      };
    });
    overlay.querySelectorAll('[data-chrome]').forEach(function (b) {
      b.onclick = function () {
        try { chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); }
        catch (e) { window.open('chrome://extensions/shortcuts', '_blank'); }
      };
    });
    overlay.querySelectorAll('[data-qr-tab]').forEach(function (tab) {
      tab.onclick = function () {
        overlay.querySelectorAll('[data-qr-tab]').forEach(function (t) { t.classList.remove('on'); });
        tab.classList.add('on');
        var which = tab.dataset.qrTab;
        overlay.querySelectorAll('[data-qr]').forEach(function (img) {
          img.style.display = img.dataset.qr === which ? 'block' : 'none';
        });
      };
    });
    var copyBtn = overlay.querySelector('[data-copy-account]');
    if (copyBtn) {
      copyBtn.onclick = function () {
        navigator.clipboard.writeText('100032602565').then(function () {
          var sp = copyBtn.querySelector('.tip-copy');
          if (sp) { sp.textContent = t('copied'); setTimeout(function () { sp.textContent = t('copy'); }, 1500); }
        });
      };
    }
    overlay.querySelectorAll('iframe[data-tally-src]:not([src])').forEach(function (f) {
      f.src = f.dataset.tallySrc;
    });
    if (!window.__tallyResize) {
      window.__tallyResize = true;
      window.addEventListener('message', function (e) {
        if (e.data && e.data.event === 'Tally.FormLoaded') {
          var f = overlay && overlay.querySelector('iframe[data-tally-src]');
          if (f) f.style.height = (e.data.payload && e.data.payload.height || 300) + 'px';
        }
        if (e.data && e.data.event === 'Tally.ResizeFrame') {
          var f = overlay && overlay.querySelector('iframe[data-tally-src]');
          if (f) f.style.height = (e.data.payload && e.data.payload.height || 300) + 'px';
        }
      });
    }
  }

  async function open() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'set-overlay';
      overlay.innerHTML = '<div class="set-panel"></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    }
    appSettings = await loadAppSettings();
    render();
    bind();
    overlay.classList.add('open');
  }

  var GEAR = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  return {
    get: get,
    matches: matches,
    open: open,
    mount: function (btn) {
      btn.innerHTML = GEAR;
      btn.title = t('settings');
      btn.addEventListener('click', open);
    }
  };
})();
