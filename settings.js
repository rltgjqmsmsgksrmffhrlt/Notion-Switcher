'use strict';
/* Settings panel — theme (system/light/dark) + editable shortcuts with conflict check.
   Shared by popup + dashboard. Loaded after ui.js, before page scripts. */

window.Settings = (function () {
  var SC_KEY = 'ns_shortcuts';

  // Shortcut catalog. scope:'global' = Chrome-managed (read-only here),
  // scope:'page' = handled in-page (fully editable + applied live).
  var DEFS = [
    { id: 'popup',     label: '팝업 열기',        sub: '전역 · Chrome 관리', scope: 'global', def: 'Alt+N' },
    { id: 'dashboard', label: '대시보드 열기',     sub: '전역 · Chrome 관리', scope: 'global', def: 'Alt+Shift+N' },
    { id: 'focusSearch',       label: '검색창 포커스',  sub: '대시보드',  scope: 'page', def: '/' },
    { id: 'openDashFromPopup', label: '팝업 → 대시보드', sub: '팝업',     scope: 'page', def: 'D' },
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
      return { type: 'reserved', label: '기본 키(' + bareKey + ')와 충돌' };
    }
    var map = assignments();
    var hit = null;
    Object.keys(map).forEach(function (id) {
      if (id !== forId && map[id] && map[id].toUpperCase() === combo.toUpperCase()) {
        var od = DEFS.find(function (x) { return x.id === id; });
        hit = { type: 'shortcut', label: '"' + (od ? od.label : id) + '"와 충돌' };
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

  var overlay = null, recording = null;

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
      var label = m === 'system' ? '시스템' : (m === 'light' ? '라이트' : '다크');
      return '<button data-theme-opt="' + m + '" class="' + (theme === m ? 'on' : '') + '">' + label + '</button>';
    }).join('');

    var rows = DEFS.map(function (d) {
      var combo = get(d.id);
      var right;
      if (d.scope === 'global') {
        right = '<button class="sc-link" data-chrome="1">Chrome ↗</button>';
      } else {
        right = '<button class="sc-edit" data-edit="' + d.id + '">변경</button>';
      }
      var scopeBadge = d.scope === 'global'
        ? '<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--field);color:var(--ink-3);flex-shrink:0">전역</span>'
        : '<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-soft);color:var(--accent);flex-shrink:0">앱 내</span>';
      return '<div class="sc-row" data-row="' + d.id + '">' +
        '<div class="sc-meta">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<div class="sc-label">' + d.label + '</div>' +
            scopeBadge +
          '</div>' +
          '<div class="sc-sub">' + d.sub + '</div>' +
          '<div class="sc-error" data-err="' + d.id + '" style="display:none"></div>' +
        '</div>' +
        '<div class="sc-keys" data-keys="' + d.id + '">' + chip(combo) + '</div>' +
        right +
      '</div>';
    }).join('');

    overlay.querySelector('.set-panel').innerHTML =
      '<div class="set-title-row"><div class="set-title">설정</div>' +
        '<button class="btn-icon" data-close="1" title="닫기">✕</button></div>' +
      '<div class="set-section">' +
        '<div class="set-h">테마</div>' +
        '<div class="seg" data-seg="theme">' + seg + '</div>' +
      '</div>' +
      '<div class="set-section">' +
        '<div class="set-h">단축키</div>' + rows +
        '<div class="sc-note">전역 단축키는 브라우저가 관리해요. 다른 프로그램과 겹치면 ' +
        '<b>Chrome에서 변경</b>으로 <span class="mono">chrome://extensions/shortcuts</span>에서 바꿀 수 있어요.</div>' +
      '</div>';
  }

  function beginRecording(id) {
    stopRecording();
    var keysEl = overlay.querySelector('[data-keys="' + id + '"]');
    var errEl = overlay.querySelector('[data-err="' + id + '"]');
    var editBtn = overlay.querySelector('[data-edit="' + id + '"]');
    errEl.style.display = 'none';
    keysEl.innerHTML = '<span class="sc-recording">키 입력… (Esc 취소)</span>';
    if (editBtn) editBtn.textContent = '취소';

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
        keysEl.innerHTML = '<span class="sc-recording">다시 입력… (Esc 취소)</span>';
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
  }

  function open() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'set-overlay';
      overlay.innerHTML = '<div class="set-panel"></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    }
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
      btn.title = '설정';
      btn.addEventListener('click', open);
    }
  };
})();
