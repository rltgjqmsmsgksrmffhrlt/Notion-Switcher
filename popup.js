'use strict';

function getInitial(name) {
  if (!name) return '?';
  var first = Array.from(name)[0];
  var code = first.charCodeAt(0) - 0xAC00;
  if (code >= 0 && code < 19 * 21 * 28) {
    var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    return CHO[Math.floor(code / (21 * 28))];
  }
  return first.toUpperCase();
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shortUrl(url) {
  try {
    var u = new URL(url);
    var path = u.pathname.replace(/\/$/, '');
    return (u.hostname.replace(/^www\./, '')) + path.slice(0, 26) + (path.length > 26 ? '…' : '');
  } catch (e) { return url.slice(0, 34); }
}

async function loadWorkspaces() {
  return new Promise(function (r) { chrome.storage.sync.get(['workspaces'], function (d) { r(d.workspaces || []); }); });
}

async function saveWorkspaces(list) {
  return new Promise(function (r) { chrome.storage.sync.set({ workspaces: list }, r); });
}

async function loadFolders() {
  return new Promise(function (r) { chrome.storage.sync.get(['folders'], function (d) { r(d.folders || []); }); });
}

async function saveFolders(list) {
  return new Promise(function (r) { chrome.storage.sync.set({ folders: list }, r); });
}

function populateFolderSelect(selectedFolderId) {
  var select = document.getElementById('f-folder');
  var html = '<option value="">📋 ' + esc(t('uncategorized')) + '</option>';
  folders.forEach(function (f) {
    var sel = selectedFolderId === f.id ? ' selected' : '';
    html += '<option value="' + esc(f.id) + '"' + sel + '>' + (f.emoji || '📁') + ' ' + esc(f.name) + '</option>';
  });
  html += '<option value="__new__">' + esc(t('newFolderOption')) + '</option>';
  select.innerHTML = html;
  document.getElementById('new-folder-row').style.display = 'none';
}

async function createNewFolder() {
  var name = document.getElementById('f-folder-name').value.trim();
  if (!name) { document.getElementById('f-folder-name').focus(); return; }

  var newFolder = { id: Date.now().toString(), name: name, emoji: null };
  folders.push(newFolder);
  await saveFolders(folders);

  populateFolderSelect(newFolder.id);
  document.getElementById('f-folder-name').value = '';
}

function smartOpen(url) {
  chrome.tabs.create({ url: url });
  window.close();
}

function loadSettings() {
  return new Promise(function (r) { chrome.storage.sync.get(['settings'], function (d) { r(d.settings || {}); }); });
}
function saveSettings(s) {
  return new Promise(function (r) { chrome.storage.sync.set({ settings: s }, r); });
}

function purgeExpired(list) {
  var now = Date.now();
  return list.filter(function (w) { return !w.expireAt || w.expireAt > now; });
}

function remainingDays(expireAt) {
  if (!expireAt) return null;
  var diff = expireAt - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

var RANDOM_ADJ = [
  '저멀리','반짝이는','달리는','춤추는','잠자는','날아가는','노래하는','꿈꾸는',
  '용감한','수줍은','신비로운','귀여운','느긋한','따뜻한','조용한','새벽의',
  '한밤의','구름위','바다건너','숲속의','빛나는','씩씩한','배고픈','졸린'
];
var RANDOM_NOUN = [
  '하와이','고양이','펭귄','우주선','바다','구름','별빛','무지개',
  '여우','토끼','커피','나비','오로라','돌고래','판다','코알라',
  '해바라기','북극곰','달팽이','불꽃','아이슬란드','라면','선인장','부엉이'
];

function randomName() {
  var a = RANDOM_ADJ[Math.floor(Math.random() * RANDOM_ADJ.length)];
  var n = RANDOM_NOUN[Math.floor(Math.random() * RANDOM_NOUN.length)];
  return a + ' ' + n;
}

var RANDOM_EMOJI = [
  '🚀','🌈','⭐','🔥','💎','🎯','📌','🏠','💡','🎨',
  '🌍','🌙','☀️','⚡','🍀','🎵','📚','🧩','🎲','🏆',
  '🦊','🐱','🐧','🦋','🐬','🐼','🦁','🐻','🦄','🐳',
  '🍕','🍩','☕','🍎','🌸','🌻','🌴','🍄','💜','💙',
  '👻','🤖','👾','🎃','🥸','🤡','🥳','😎','🫠','🤯',
  '💩','🧠','👁‍🗨','🫧','🪄','🛸','🎪','🧸','🪅','🎭',
  '🦑','🦖','🦩','🐸','🐙','🦔','🐝','🦜','🐢','🦀'
];

function randomEmoji() {
  return RANDOM_EMOJI[Math.floor(Math.random() * RANDOM_EMOJI.length)];
}

function autoName(url) {
  try {
    var u = new URL(url);
    var path = u.pathname.replace(/^\//, '').replace(/-/g, ' ').replace(/\/$/, '');
    if (path) {
      var segments = path.split('/');
      var last = segments[segments.length - 1].replace(/[a-f0-9]{32}$/i, '').replace(/-+$/, '').trim();
      if (last) return last.charAt(0).toUpperCase() + last.slice(1);
    }
  } catch (e) {}
  return randomName();
}

var workspaces = [];
var folders = [];
var filtered = [];
var displayOrder = [];
var currentTabUrl = '';
var editingId = null;
var dragId = null;
var appSettings = {};
var collapsedFolders = {};
var activeFilter = null;

async function init() {
  var results = await Promise.all([loadWorkspaces(), loadFolders(), loadSettings()]);
  workspaces = results[0];
  folders = results[1];
  appSettings = results[2];

  var before = workspaces.length;
  workspaces = purgeExpired(workspaces);
  if (workspaces.length < before) await saveWorkspaces(workspaces);

  filtered = workspaces.slice();

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tabs[0].url || '';
  } catch (e) {}

  try {
    var stored = await new Promise(function (r) { chrome.storage.local.get(['collapsedFolders'], function (d) { r(d); }); });
    collapsedFolders = stored.collapsedFolders || {};
  } catch (e) {}

  localizeHtml();
  renderFilterBar();
  renderList();
  updateCount();

  document.getElementById('btn-add-link').addEventListener('click', function () {
    var isOpen = addForm.classList.contains('open');
    if (isOpen && !editingId) {
      addForm.classList.remove('open');
      document.getElementById('form-extras').classList.remove('open');
      clearForm();
      return;
    }
    openAddForm();
  });

  document.getElementById('btn-more-options').addEventListener('click', function () {
    var extras = document.getElementById('form-extras');
    extras.classList.toggle('open');
    this.textContent = extras.classList.contains('open') ? t('lessOptions') : t('moreOptions');
  });

  document.addEventListener('keydown', onGlobalKey);

  document.getElementById('fa-save').addEventListener('click', saveFolderFromBar);
  document.getElementById('fa-cancel').addEventListener('click', function () {
    document.getElementById('folder-add-inline').classList.remove('open');
  });
  document.getElementById('fa-name').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveFolderFromBar();
    if (e.key === 'Escape') document.getElementById('folder-add-inline').classList.remove('open');
  });

  document.getElementById('btn-dashboard').addEventListener('click', openDashboard);
  Theme.init();
  Settings.mount(document.getElementById('btn-settings'));
  CustomSelect.enhance(document.getElementById('f-folder'));
  Onboarding.checkAndStart();
}

function openDashboard() {
  var url = chrome.runtime.getURL('dashboard.html');
  chrome.tabs.create({ url: url });
  window.close();
}

function updateCount() {
  document.getElementById('ws-count').textContent = workspaces.length > 0 ? t('countSuffix', [String(workspaces.length)]) : '';
}

function renderItem(ws, idx) {
  var tile = tileFor(ws);
  var icon = ws.emoji
    ? '<span>' + esc(ws.emoji) + '</span>'
    : '<span class="initial" style="color:' + tile[1] + '">' + esc(getInitial(ws.name)) + '</span>';
  var isActive = currentTabUrl && ws.url && currentTabUrl.startsWith(ws.url.split('?')[0]);
  var badge = (idx >= 0 && idx < 9) ? '<div class="ws-badge">' + (idx + 1) + '</div>' : '';
  var days = remainingDays(ws.expireAt);
  var expireBadge = days !== null
    ? '<span class="expire-badge">' + (days === 0 ? esc(t('expiresToday')) : esc(t('expiresIn', [String(days)]))) + '</span>'
    : '';

  return '<div class="workspace-item' + (isActive ? ' active-ws' : '') + '"' +
    ' data-id="' + esc(ws.id) + '" data-url="' + esc(ws.url) + '" data-idx="' + idx + '"' +
    ' data-folder="' + esc(ws.folderId || '') + '">' +
    '<div class="ws-gutter">' +
      '<button class="g-btn g-add" data-action="add" data-folder="' + esc(ws.folderId || '') + '" title="' + esc(t('addBelow')) + '" tabindex="-1">＋</button>' +
      '<span class="g-btn g-handle" draggable="true" title="' + esc(t('dragToSort')) + '" tabindex="-1">⠿</span>' +
    '</div>' +
    '<div class="ws-icon" style="background:' + tile[0] + '">' + icon + '</div>' +
    '<div class="ws-info">' +
      '<div class="ws-name">' + esc(ws.name) + expireBadge + '</div>' +
      '<div class="ws-url">' + esc(shortUrl(ws.url)) + '</div>' +
    '</div>' +
    '<div class="ws-meta">' +
      '<div class="ws-actions">' +
        '<button class="btn-sm edit" data-action="edit" data-id="' + esc(ws.id) + '" title="' + esc(t('editBtn')) + '" tabindex="-1">✎</button>' +
        '<button class="btn-sm del" data-action="delete" data-id="' + esc(ws.id) + '" title="' + esc(t('deleteBtn')) + '" tabindex="-1">✕</button>' +
      '</div>' +
      badge +
    '</div>' +
  '</div>';
}

function renderList() {
  renderFilterBar();
  var list = document.getElementById('ws-list');
  var isSearching = false;

  displayOrder = [];

  if (filtered.length === 0) {
    var isEmpty = workspaces.length === 0;
    list.innerHTML =
      '<div class="empty">' +
        (isEmpty ? esc(t('emptyNoWorkspaces')) : esc(t('emptyNoResults'))) +
        (isEmpty ? '<div class="empty-sub">' + esc(t('emptyAddHint')) + '</div>' : '') +
      '</div>';
    return;
  }

  if (isSearching || activeFilter || folders.length === 0) {
    displayOrder = filtered.slice();
    list.innerHTML = displayOrder.map(function (ws, i) { return renderItem(ws, i); }).join('');
  } else {
    var grouped = {};
    var unfiled = [];
    filtered.forEach(function (ws) {
      if (ws.folderId && folders.some(function (f) { return f.id === ws.folderId; })) {
        if (!grouped[ws.folderId]) grouped[ws.folderId] = [];
        grouped[ws.folderId].push(ws);
      } else {
        unfiled.push(ws);
      }
    });

    var hasFolderItems = folders.some(function (f) { return grouped[f.id] && grouped[f.id].length > 0; });

    if (!hasFolderItems) {
      displayOrder = filtered.slice();
      list.innerHTML = displayOrder.map(function (ws, i) { return renderItem(ws, i); }).join('');
    } else {
      var html = '';
      var idx = 0;

      folders.forEach(function (folder) {
        var items = grouped[folder.id] || [];
        if (items.length === 0) return;
        var col = collapsedFolders[folder.id];
        html += '<div class="folder-section' + (col ? ' collapsed' : '') + '">';
        html += '<div class="folder-label" data-folder-toggle="' + esc(folder.id) + '"><span class="fl-emoji">' + (folder.emoji || '📁') + '</span>' + esc(folder.name) + '<span class="fl-count">' + items.length + '</span><span class="fl-chevron">▾</span></div>';
        html += '<div class="folder-items">';
        items.forEach(function (ws) {
          if (col) {
            html += renderItem(ws, -1);
          } else {
            displayOrder.push(ws);
            html += renderItem(ws, idx);
            idx++;
          }
        });
        html += '</div></div>';
      });

      if (unfiled.length > 0 && !appSettings.hideUncategorized) {
        var uCol = collapsedFolders['__unfiled__'];
        html += '<div class="folder-section' + (uCol ? ' collapsed' : '') + '">';
        html += '<div class="folder-label" data-folder-toggle="__unfiled__"><span class="fl-emoji">📋</span>' + esc(t('uncategorized')) + '<span class="fl-count">' + unfiled.length + '</span><span class="fl-chevron">▾</span></div>';
        html += '<div class="folder-items">';
        unfiled.forEach(function (ws) {
          if (uCol) {
            html += renderItem(ws, -1);
          } else {
            displayOrder.push(ws);
            html += renderItem(ws, idx);
            idx++;
          }
        });
        html += '</div></div>';
      }

      list.innerHTML = html;
    }
  }

  list.querySelectorAll('.workspace-item').forEach(function (el) {
    el.addEventListener('click', onItemClick);
  });
  list.querySelectorAll('[data-folder-toggle]').forEach(function (el) {
    el.addEventListener('click', function () {
      var fid = el.dataset.folderToggle;
      collapsedFolders[fid] = !collapsedFolders[fid];
      if (!collapsedFolders[fid]) delete collapsedFolders[fid];
      chrome.storage.local.set({ collapsedFolders: collapsedFolders });
      renderList();
    });
  });
  if (!isSearching && !activeFilter) bindDrag(list);
}

// ── Drag to reorder ──
function bindDrag(list) {
  list.querySelectorAll('.g-handle').forEach(function (handle) {
    var item = handle.closest('.workspace-item');
    handle.addEventListener('dragstart', function (e) {
      dragId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
      try { e.dataTransfer.setDragImage(item, 20, 18); } catch (err) {}
    });
    handle.addEventListener('dragend', function () {
      item.classList.remove('dragging');
      clearDropMarks(list);
      dragId = null;
    });
  });

  list.querySelectorAll('.workspace-item').forEach(function (item) {
    item.addEventListener('dragover', function (e) {
      if (!dragId || item.dataset.id === dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var r = item.getBoundingClientRect();
      var below = e.clientY > r.top + r.height / 2;
      clearDropMarks(list);
      item.classList.add(below ? 'drop-below' : 'drop-above');
    });
    item.addEventListener('drop', function (e) {
      if (!dragId || item.dataset.id === dragId) return;
      e.preventDefault();
      var r = item.getBoundingClientRect();
      var below = e.clientY > r.top + r.height / 2;
      reorderWorkspace(dragId, item.dataset.id, below, item.dataset.folder || null);
    });
  });
}

function clearDropMarks(list) {
  list.querySelectorAll('.drop-above,.drop-below').forEach(function (el) {
    el.classList.remove('drop-above', 'drop-below');
  });
}

async function reorderWorkspace(draggedId, targetId, placeBelow, targetFolder) {
  if (draggedId === targetId) return;
  var dragged = workspaces.find(function (w) { return w.id === draggedId; });
  if (!dragged) return;

  workspaces = workspaces.filter(function (w) { return w.id !== draggedId; });
  dragged.folderId = targetFolder || null;

  var ti = workspaces.findIndex(function (w) { return w.id === targetId; });
  if (ti < 0) ti = workspaces.length - 1;
  workspaces.splice(ti + (placeBelow ? 1 : 0), 0, dragged);

  await saveWorkspaces(workspaces);
  applyFilter();
}

async function onItemClick(e) {
  var btn = e.target.closest('[data-action]');
  if (btn) {
    e.stopPropagation();
    var action = btn.dataset.action;
    if (action === 'delete') await deleteWs(btn.dataset.id);
    else if (action === 'edit') startEdit(btn.dataset.id);
    else if (action === 'add') openAddForm(btn.dataset.folder || null);
    return;
  }
  var item = e.currentTarget;
  item.classList.add('click-flash');
  var url = item.dataset.url;
  setTimeout(function () { smartOpen(url); }, 150);
}

function startEdit(id) {
  var ws = workspaces.find(function (w) { return w.id === id; });
  if (!ws) return;

  editingId = ws.id;
  document.getElementById('f-name').value = ws.name;
  document.getElementById('f-url').value = ws.url;
  buildSwatches(document.getElementById('f-colors'), ws.colorId != null ? ws.colorId : null);
  document.getElementById('btn-save').textContent = t('edit');
  populateFolderSelect(ws.folderId);

  if (ws.expireAt) {
    var days = remainingDays(ws.expireAt);
    document.getElementById('f-expire').value = 'custom';
    document.getElementById('custom-days-row').style.display = 'flex';
    document.getElementById('f-custom-days').value = days > 0 ? days : 1;
  } else {
    document.getElementById('f-expire').value = '';
    document.getElementById('custom-days-row').style.display = 'none';
  }

  addForm.classList.add('open');
  document.getElementById('form-extras').classList.add('open');
  document.getElementById('btn-more-options').textContent = t('lessOptions');
  document.getElementById('add-link-wrap').style.display = 'none';
  document.getElementById('f-name').focus();
}

async function deleteWs(id) {
  workspaces = workspaces.filter(function (w) { return w.id !== id; });
  await saveWorkspaces(workspaces);
  applyFilter();
  updateCount();
}

function onGlobalKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  if (e.key >= '1' && e.key <= '9') {
    var idx = parseInt(e.key) - 1;
    if (idx < displayOrder.length) {
      e.preventDefault();
      smartOpen(displayOrder[idx].url);
    }
    return;
  }
  if (e.key === 'Enter' && displayOrder.length > 0) {
    smartOpen(displayOrder[0].url);
  }
  if (e.key === 'Escape') {
    window.close();
  }
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    openDashboard();
  }
}

async function saveFolderFromBar() {
  var name = document.getElementById('fa-name').value.trim();
  if (!name) { document.getElementById('fa-name').focus(); return; }

  var newFolder = { id: Date.now().toString(), name: name, emoji: null };
  folders.push(newFolder);
  await saveFolders(folders);

  document.getElementById('fa-name').value = '';
  document.getElementById('folder-add-inline').classList.remove('open');
  renderFilterBar();
  renderList();
}

function applyFilter() {
  filtered = workspaces.filter(function (w) {
    if (activeFilter && activeFilter !== '__expiry__') {
      if (activeFilter === '__unfiled__') return !w.folderId || !folders.some(function (f) { return f.id === w.folderId; });
      return w.folderId === activeFilter;
    }
    return true;
  });
  if (activeFilter === '__expiry__') {
    filtered.sort(function (a, b) {
      var ra = a.expireAt ? (a.expireAt - Date.now()) : Infinity;
      var rb = b.expireAt ? (b.expireAt - Date.now()) : Infinity;
      if (ra === Infinity && rb === Infinity) return 0;
      if (ra === Infinity) return 1;
      if (rb === Infinity) return -1;
      return rb - ra;
    });
  }
  renderList();
}

function renderFilterBar() {
  var bar = document.getElementById('filter-bar');
  var hasTemp = workspaces.some(function (w) { return w.expireAt; });
  var html = '<button class="filter-pill' + (!activeFilter ? ' active' : '') + '" data-filter="">' + esc(t('filterAll')) + '</button>';
  folders.forEach(function (f) {
    html += '<button class="filter-pill' + (activeFilter === f.id ? ' active' : '') + '" data-filter="' + esc(f.id) + '">' +
      (f.emoji || '📁') + ' ' + esc(f.name) + '</button>';
  });
  if (hasTemp) {
    html += '<button class="filter-pill' + (activeFilter === '__expiry__' ? ' active' : '') + '" data-filter="__expiry__">⏳ ' + esc(t('expirySort')) + '</button>';
  }
  html += '<button class="filter-add-btn" id="filter-add-folder" title="' + esc(t('folderAdd')) + '">＋</button>';
  bar.innerHTML = html;
  bar.onclick = function (e) {
    if (filterDragged) { filterDragged = false; return; }
    if (e.target.closest('.filter-add-btn')) {
      var inline = document.getElementById('folder-add-inline');
      inline.classList.toggle('open');
      if (inline.classList.contains('open')) document.getElementById('fa-name').focus();
      return;
    }
    var pill = e.target.closest('.filter-pill');
    if (!pill) return;
    activeFilter = pill.dataset.filter || null;
    renderFilterBar();
    applyFilter();
  };
}

var filterDragged = false;
(function initFilterDrag() {
  var bar = document.getElementById('filter-bar');
  var startX, startScroll;

  bar.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    filterDragged = false;
    startX = e.clientX;
    startScroll = bar.scrollLeft;
    bar.style.cursor = 'grabbing';

    function onMove(ev) {
      var dx = ev.clientX - startX;
      if (Math.abs(dx) > 3) filterDragged = true;
      bar.scrollLeft = startScroll - dx;
    }
    function onUp() {
      bar.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// ── Add / Edit Form ──
var addForm = document.getElementById('add-form');

function openAddForm(folderId) {
  editingId = null;
  clearForm();
  document.getElementById('btn-save').textContent = t('save');
  populateFolderSelect(folderId || null);
  buildSwatches(document.getElementById('f-colors'), null);
  document.getElementById('form-extras').classList.remove('open');
  document.getElementById('btn-more-options').textContent = t('moreOptions');
  addForm.classList.add('open');
  document.getElementById('add-link-wrap').style.display = 'none';

  var urlInput = document.getElementById('f-url');
  if (currentTabUrl.includes('notion.so') || currentTabUrl.includes('notion.com')) {
    if (!urlInput.value) urlInput.value = currentTabUrl.split('?')[0];
  }
  urlInput.focus();
}

document.getElementById('btn-cancel').addEventListener('click', function () {
  editingId = null;
  document.getElementById('btn-save').textContent = t('save');
  addForm.classList.remove('open');
  document.getElementById('add-link-wrap').style.display = '';
  clearForm();
});

document.getElementById('btn-save').addEventListener('click', saveForm);

['f-name','f-url'].forEach(function (id) {
  document.getElementById(id).addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveForm();
    if (e.key === 'Escape') {
      editingId = null;
      document.getElementById('btn-save').textContent = t('save');
      addForm.classList.remove('open');
      clearForm();
    }
  });
});

async function saveForm() {
  var name  = document.getElementById('f-name').value.trim();
  var url   = document.getElementById('f-url').value.trim();

  var fUrl  = document.getElementById('f-url');
  fUrl.classList.remove('error');

  if (!url)  { fUrl.classList.add('error'); fUrl.focus(); return; }

  if (!/^https?:\/\//.test(url)) url = 'https://' + url;

  if (!name) name = autoName(url);

  var folderId = document.getElementById('f-folder').value || null;
  if (folderId === '__new__') folderId = null;

  var colorId = getSwatch(document.getElementById('f-colors'));

  var expireVal = document.getElementById('f-expire').value;
  var expireAt = null;
  if (expireVal === 'custom') {
    var customDays = parseInt(document.getElementById('f-custom-days').value);
    if (!customDays || customDays < 1) {
      document.getElementById('f-custom-days').classList.add('error');
      document.getElementById('f-custom-days').focus();
      return;
    }
    expireAt = Date.now() + customDays * 86400000;
  } else if (expireVal) {
    expireAt = Date.now() + parseInt(expireVal) * 86400000;
  }

  if (editingId) {
    var ws = workspaces.find(function (w) { return w.id === editingId; });
    if (ws) {
      ws.name = name;
      ws.url = url;
      ws.folderId = folderId;
      ws.colorId = colorId;
      ws.expireAt = expireAt;
      if (!ws.emoji) ws.emoji = randomEmoji();
    }
  } else {
    workspaces.push({ id: Date.now().toString(), name: name, url: url, emoji: randomEmoji(), folderId: folderId, colorId: colorId, expireAt: expireAt });
  }

  await saveWorkspaces(workspaces);

  editingId = null;
  document.getElementById('btn-save').textContent = t('save');
  addForm.classList.remove('open');
  document.getElementById('add-link-wrap').style.display = '';
  clearForm();
  applyFilter();
  updateCount();
}

function clearForm() {
  ['f-name','f-url'].forEach(function (id) {
    var el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
  document.getElementById('f-expire').value = '';
  document.getElementById('custom-days-row').style.display = 'none';
  var customDays = document.getElementById('f-custom-days');
  if (customDays) { customDays.value = ''; customDays.classList.remove('error'); }
  var folderName = document.getElementById('f-folder-name');
  if (folderName) folderName.value = '';
  var newFolderRow = document.getElementById('new-folder-row');
  if (newFolderRow) newFolderRow.style.display = 'none';
}

document.getElementById('f-expire').addEventListener('change', function () {
  document.getElementById('custom-days-row').style.display = this.value === 'custom' ? 'flex' : 'none';
  if (this.value === 'custom') document.getElementById('f-custom-days').focus();
});

document.getElementById('f-custom-days').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { saveForm(); return; }
  if (e.key === 'Escape') { editingId = null; addForm.classList.remove('open'); clearForm(); return; }
  if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
});
document.getElementById('f-custom-days').addEventListener('paste', function (e) {
  var text = (e.clipboardData || window.clipboardData).getData('text');
  if (!/^\d+$/.test(text)) e.preventDefault();
});

document.getElementById('f-folder').addEventListener('change', function () {
  if (this.value === '__new__') {
    document.getElementById('new-folder-row').style.display = 'flex';
    document.getElementById('f-folder-name').focus();
  } else {
    document.getElementById('new-folder-row').style.display = 'none';
  }
});

document.getElementById('btn-folder-create').addEventListener('click', createNewFolder);
document.getElementById('f-folder-name').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); createNewFolder(); }
});

init();
