'use strict';
/* Shared UI helpers for popup + dashboard (loaded before each page script). */

// Pastel icon tiles (bg, fg) — matches tokens.css palette.
window.TILES = [
  ['#fbecdd', '#cc7722'], // orange
  ['#e7f1fb', '#2f77c4'], // blue
  ['#fbf0f5', '#c2548a'], // pink
  ['#eaf3ec', '#4f9168'], // green
  ['#fbf4dd', '#c29243'], // yellow
  ['#f2eefb', '#8a63c0'], // purple
  ['#fdecec', '#d24a4a'], // red
  ['#f0eeeb', '#8a7b6b'], // brown
];

window.hashTile = function (str) {
  var h = 0;
  for (var i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return window.TILES[Math.abs(h) % window.TILES.length];
};

// Resolve a workspace's tile: explicit colorId wins, else hashed by name.
window.tileFor = function (ws) {
  if (ws && ws.colorId != null && window.TILES[ws.colorId]) return window.TILES[ws.colorId];
  return window.hashTile(ws ? ws.name : '');
};

// ── Theme (system / light / dark, default system) ──
window.Theme = {
  KEY: 'ns_theme',
  _mql: function () {
    try { return window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return null; }
  },
  get: function () {
    try { var v = localStorage.getItem(this.KEY); return (v === 'light' || v === 'dark') ? v : 'system'; }
    catch (e) { return 'system'; }
  },
  resolved: function () {
    var t = this.get();
    if (t === 'system') { var m = this._mql(); return (m && m.matches) ? 'dark' : 'light'; }
    return t;
  },
  apply: function () {
    if (this.resolved() === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    document.dispatchEvent(new CustomEvent('themechange', { detail: { mode: this.get(), resolved: this.resolved() } }));
  },
  set: function (mode) {
    try { localStorage.setItem(this.KEY, mode); } catch (e) {}
    this.apply();
  },
  init: function () {
    this.apply();
    if (window.__themeBound) return;
    window.__themeBound = true;
    var self = this, m = this._mql();
    if (m) {
      var fn = function () { if (self.get() === 'system') self.apply(); };
      if (m.addEventListener) m.addEventListener('change', fn);
      else if (m.addListener) m.addListener(fn);
    }
    // react to changes from the other extension page (popup ↔ dashboard)
    window.addEventListener('storage', function (e) { if (e.key === self.KEY) self.apply(); });
  }
};

// ── Color swatches ──
window.buildSwatches = function (container, selectedId) {
  container.innerHTML = '';
  var auto = document.createElement('button');
  auto.type = 'button';
  auto.className = 'swatch-auto' + (selectedId == null ? ' is-sel' : '');
  auto.textContent = '자동';
  auto.dataset.color = '';
  container.appendChild(auto);

  window.TILES.forEach(function (t, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (selectedId === i ? ' is-sel' : '');
    b.dataset.color = String(i);
    b.style.background = t[0];
    b.style.boxShadow = 'inset 0 0 0 1px ' + t[1] + '55';
    b.title = t[1];
    container.appendChild(b);
  });

  container.onclick = function (e) {
    var b = e.target.closest('[data-color]');
    if (!b) return;
    container.querySelectorAll('[data-color]').forEach(function (x) { x.classList.remove('is-sel'); });
    b.classList.add('is-sel');
  };
};

window.getSwatch = function (container) {
  var sel = container.querySelector('.swatch.is-sel, .swatch-auto.is-sel');
  if (!sel) return null;
  var v = sel.dataset.color;
  return v === '' ? null : parseInt(v, 10);
};

// ── Custom select (styled replacement for native <select>) ──
window.CustomSelect = {
  enhance: function (select) {
    if (!select || select.__enhanced) return;
    select.__enhanced = true;

    var wrap = document.createElement('div');
    wrap.className = 'cselect';
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cselect-trigger';
    trigger.innerHTML = '<span class="cselect-label"></span><span class="cselect-chev">▼</span>';
    var pop = document.createElement('div');
    pop.className = 'cselect-pop';

    var parent = select.parentNode;
    parent.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.style.display = 'none';
    wrap.appendChild(trigger);
    wrap.appendChild(pop);

    function syncLabel() {
      var opt = select.options[select.selectedIndex];
      trigger.querySelector('.cselect-label').textContent = opt ? opt.textContent : '';
    }
    function rebuild() {
      pop.innerHTML = '';
      Array.prototype.forEach.call(select.options, function (o, i) {
        var item = document.createElement('div');
        item.className = 'cselect-item' +
          (o.value === '__new__' ? ' is-new' : '') +
          (i === select.selectedIndex ? ' is-sel' : '');
        item.textContent = o.textContent;
        item.addEventListener('click', function () {
          select.value = o.value;
          syncLabel();
          close();
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        pop.appendChild(item);
      });
    }
    function open() {
      rebuild();
      // flip up if not enough room below
      var r = trigger.getBoundingClientRect();
      wrap.classList.toggle('up', window.innerHeight - r.bottom < 200 && r.top > 200);
      wrap.classList.add('open');
      document.addEventListener('mousedown', outside, true);
    }
    function close() {
      wrap.classList.remove('open');
      document.removeEventListener('mousedown', outside, true);
    }
    function outside(e) { if (!wrap.contains(e.target)) close(); }

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      wrap.classList.contains('open') ? close() : open();
    });

    var mo = new MutationObserver(function () {
      syncLabel();
      if (wrap.classList.contains('open')) rebuild();
    });
    mo.observe(select, { childList: true });
    select.addEventListener('change', syncLabel);
    syncLabel();
  }
};
