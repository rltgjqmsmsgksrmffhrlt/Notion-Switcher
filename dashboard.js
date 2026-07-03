'use strict';

(function fallingCubes() {
  var container = document.getElementById('falling-cubes');
  if (!container) return;
  var COUNT = 12;
  for (var i = 0; i < COUNT; i++) {
    var cube = document.createElement('div');
    cube.className = 'falling-cube';
    var size = 16 + Math.random() * 20;
    var left = Math.random() * 100;
    var duration = 10 + Math.random() * 18;
    var delay = -(Math.random() * duration);
    cube.style.width = size + 'px';
    cube.style.height = size + 'px';
    cube.style.left = left + '%';
    cube.style.animationDuration = duration + 's';
    cube.style.animationDelay = delay + 's';
    container.appendChild(cube);
  }
})();

function getInitial(name) {
  if (!name) return '?';
  const first = [...name][0];
  const code = first.charCodeAt(0) - 0xAC00;
  if (code >= 0 && code < 19 * 21 * 28) {
    const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    return CHO[Math.floor(code / (21 * 28))];
  }
  return first.toUpperCase();
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 36) + (u.pathname.length > 36 ? '…' : '');
  } catch { return url.slice(0, 44); }
}

// ── Storage ──
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

function loadSettings() {
  return new Promise(function (r) { chrome.storage.sync.get(['settings'], function (d) { r(d.settings || {}); }); });
}
function saveSettingsData(s) {
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

// ── State ──
var workspaces = [];
var folders = [];
var filtered = [];
var displayOrder = [];
var editingWsId = null;
var editingFolderId = null;
var draggingFolderId = null;
var appSettings = {};

async function init() {
  var results = await Promise.all([loadWorkspaces(), loadFolders(), loadSettings()]);
  workspaces = results[0];
  folders = results[1];
  appSettings = results[2];

  var before = workspaces.length;
  workspaces = purgeExpired(workspaces);
  if (workspaces.length < before) await saveWorkspaces(workspaces);

  filtered = workspaces.slice();
  localizeHtml();
  renderFooter();
  render();
  updateTotal();

  document.getElementById('search').addEventListener('input', onSearch);
  document.getElementById('btn-add').addEventListener('click', function () { openWsModal(); });
  document.getElementById('btn-add-folder').addEventListener('click', function () { openFolderModal(); });
  document.getElementById('m-cancel').addEventListener('click', closeWsModal);
  document.getElementById('m-save').addEventListener('click', saveWs);
  document.getElementById('fm-cancel').addEventListener('click', closeFolderModal);
  document.getElementById('fm-save').addEventListener('click', saveFolder);

  Theme.init();
  Settings.mount(document.getElementById('btn-settings'));
  CustomSelect.enhance(document.getElementById('m-folder'));

  document.getElementById('m-expire').addEventListener('change', function () {
    document.getElementById('m-custom-days-row').style.display = this.value === 'custom' ? 'flex' : 'none';
    if (this.value === 'custom') document.getElementById('m-custom-days').focus();
  });
  document.getElementById('m-custom-days').addEventListener('keydown', function (e) {
    if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
  });
  document.getElementById('m-custom-days').addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (!/^\d+$/.test(text)) e.preventDefault();
  });

  document.addEventListener('keydown', onGlobalKey);

  document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target === this) closeWsModal();
  });
  document.getElementById('folder-modal').addEventListener('click', function (e) {
    if (e.target === this) closeFolderModal();
  });

  ['m-emoji', 'm-name', 'm-url', 'm-custom-days'].forEach(function (id) {
    document.getElementById(id).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveWs(); }
      if (e.key === 'Escape') { e.preventDefault(); closeWsModal(); }
    });
  });
  document.getElementById('m-folder').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closeWsModal(); }
  });
  ['fm-emoji', 'fm-name'].forEach(function (id) {
    document.getElementById(id).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveFolder(); }
      if (e.key === 'Escape') { e.preventDefault(); closeFolderModal(); }
    });
  });

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.workspaces) {
      workspaces = changes.workspaces.newValue || [];
      applyFilter();
      updateTotal();
    }
    if (changes.folders) {
      folders = changes.folders.newValue || [];
      applyFilter();
    }
    if (changes.settings) {
      appSettings = changes.settings.newValue || {};
      applyFilter();
    }
  });
}

function renderFooter() {
  document.getElementById('dash-footer').innerHTML =
    '<kbd>1</kbd>~<kbd>9</kbd> ' + t('dashFooter1') + ' &nbsp;&middot;&nbsp;' +
    '<kbd>Enter</kbd> ' + t('dashFooter2') + ' &nbsp;&middot;&nbsp;' +
    '<kbd>/</kbd> ' + t('dashFooter3') + ' &nbsp;&middot;&nbsp;' +
    '<kbd>Alt+N</kbd> ' + t('dashFooter4') + ' &nbsp;&middot;&nbsp;' +
    '<kbd>Alt+Shift+N</kbd> ' + t('dashFooter5');
}

function updateTotal() {
  var el = document.getElementById('ws-total');
  el.textContent = workspaces.length > 0 ? t('countWorkspaces', [String(workspaces.length)]) : '';
}

// ── Render ──
function render() {
  var content = document.getElementById('content');
  var isSearching = document.getElementById('search').value.trim().length > 0;

  displayOrder = [];

  if (filtered.length === 0 && workspaces.length === 0) {
    content.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📋</div>' +
        '<div class="empty-title">' + esc(t('emptyNoWorkspaces')) + '</div>' +
        '<div class="empty-desc">' + esc(t('emptyAddHintDash')) + '</div>' +
      '</div>';
    return;
  }

  if (filtered.length === 0) {
    content.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">🔍</div>' +
        '<div class="empty-title">' + esc(t('emptyNoResults')) + '</div>' +
        '<div class="empty-desc">' + esc(t('emptySearchHint')) + '</div>' +
      '</div>';
    return;
  }

  var html = '';

  if (isSearching || folders.length === 0) {
    displayOrder = filtered.slice();
    html = '<div class="grid">';
    displayOrder.forEach(function (ws, i) { html += renderCard(ws, i); });
    if (!isSearching) html += renderAddCard();
    html += '</div>';
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

    folders.forEach(function (f) {
      var items = grouped[f.id] || [];
      displayOrder = displayOrder.concat(items);
    });
    displayOrder = displayOrder.concat(unfiled);

    var idx = 0;
    folders.forEach(function (folder) {
      var items = grouped[folder.id] || [];
      html += renderFolderSection(folder, items, idx);
      idx += items.length;
    });
    html += renderUnfiledSection(unfiled, idx);
  }

  content.innerHTML = html;
  bindCardEvents();
  if (!isSearching && folders.length > 0) bindDragDrop();
}

function renderCard(ws, idx) {
  var tile = tileFor(ws);
  var icon = ws.emoji
    ? '<span class="emoji">' + esc(ws.emoji) + '</span>'
    : '<span class="initial" style="color:' + tile[1] + '">' + esc(getInitial(ws.name)) + '</span>';
  var badge = idx < 9 ? '<div class="card-badge">' + (idx + 1) + '</div>' : '';

  var days = remainingDays(ws.expireAt);
  var expireBadge = days !== null
    ? '<div class="expire-badge">' + (days === 0 ? esc(t('expiresToday')) : esc(t('expiresIn', [String(days)]))) + '</div>'
    : '';

  return '<div class="card" data-id="' + esc(ws.id) + '" data-url="' + esc(ws.url) + '" data-folder="' + esc(ws.folderId || '') + '" draggable="true">' +
    '<div class="card-handle" title="' + esc(t('dragToSort')) + '">⠿</div>' +
    '<div class="card-actions">' +
      '<button class="card-action-btn edit" data-action="edit" data-id="' + esc(ws.id) + '" title="' + esc(t('editBtn')) + '">✎</button>' +
      '<button class="card-action-btn del" data-action="delete" data-id="' + esc(ws.id) + '" title="' + esc(t('deleteBtn')) + '">✕</button>' +
    '</div>' +
    badge +
    '<div class="card-icon" style="background:' + tile[0] + '">' + icon + '</div>' +
    '<div class="card-name">' + esc(ws.name) + '</div>' +
    expireBadge +
    '<div class="card-url">' + esc(shortUrl(ws.url)) + '</div>' +
  '</div>';
}

function renderFolderSection(folder, items, startIdx) {
  var html = '<div class="folder-section" data-folder-id="' + esc(folder.id) + '">' +
    '<div class="folder-header" draggable="true" data-folder-drag-id="' + esc(folder.id) + '">' +
      '<div class="folder-drag-handle" title="' + esc(t('dragToReorder')) + '">⠿</div>' +
      '<div class="folder-title"><span class="ft-emoji">' + (folder.emoji ? esc(folder.emoji) : '📁') + '</span>' + esc(folder.name) + '</div>' +
      '<span class="folder-count">' + items.length + '</span>' +
      '<div class="folder-actions">' +
        '<button class="folder-btn" data-action="edit-folder" data-id="' + esc(folder.id) + '" title="' + esc(t('editBtn')) + '">✎</button>' +
        '<button class="folder-btn del" data-action="delete-folder" data-id="' + esc(folder.id) + '" title="' + esc(t('deleteBtn')) + '">✕</button>' +
      '</div>' +
    '</div>' +
    '<div class="folder-grid grid">';

  if (items.length === 0) {
    html += '<div class="folder-empty">' + esc(t('dragToFolder')) + '</div>';
  } else {
    items.forEach(function (ws, i) { html += renderCard(ws, startIdx + i); });
  }

  html += '</div></div>';
  return html;
}

function renderUnfiledSection(items, startIdx) {
  if (appSettings.hideUncategorized) return '';

  var html = '<div class="folder-section" data-folder-id="">' +
    '<div class="folder-header">' +
      '<div class="folder-title"><span class="ft-emoji">📋</span>' + esc(t('uncategorized')) + '</div>' +
      '<span class="folder-count">' + items.length + '</span>' +
    '</div>' +
    '<div class="folder-grid grid">';

  items.forEach(function (ws, i) { html += renderCard(ws, startIdx + i); });
  html += renderAddCard();
  html += '</div></div>';
  return html;
}

function renderAddCard() {
  return '<div class="card card-add" data-action="add-ws">' +
    '<div class="card-add-icon">＋</div>' +
    '<div class="card-add-text">' + esc(t('addWorkspace')) + '</div>' +
  '</div>';
}

function bindCardEvents() {
  document.querySelectorAll('.card:not(.card-add)').forEach(function (el) {
    el.addEventListener('click', onCardClick);
  });
  document.querySelectorAll('[data-action="add-ws"]').forEach(function (el) {
    el.addEventListener('click', function () { openWsModal(); });
  });
  document.querySelectorAll('[data-action="edit-folder"]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = e.currentTarget.dataset.id;
      var folder = folders.find(function (f) { return f.id === id; });
      if (folder) openFolderModal(folder);
    });
  });
  document.querySelectorAll('[data-action="delete-folder"]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteFolder(e.currentTarget.dataset.id);
    });
  });
}

// ── Drag & Drop ──
function bindDragDrop() {
  var cards = document.querySelectorAll('.card[draggable="true"]');
  var sections = document.querySelectorAll('.folder-section');
  var folderHeaders = document.querySelectorAll('.folder-header[data-folder-drag-id]');

  cards.forEach(function (card) {
    card.addEventListener('dragstart', function (e) {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      sections.forEach(function (s) { s.classList.remove('drag-over'); });
      clearCardMarks();
    });
    card.addEventListener('dragover', function (e) {
      if (draggingFolderId) return;
      var dragging = document.querySelector('.card.dragging');
      if (!dragging || dragging === card) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      var r = card.getBoundingClientRect();
      var after = e.clientX > r.left + r.width / 2;
      clearCardMarks();
      card.classList.add(after ? 'drop-right' : 'drop-left');
    });
    card.addEventListener('drop', function (e) {
      if (draggingFolderId) return;
      var draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === card.dataset.id) return;
      e.preventDefault();
      e.stopPropagation();
      var r = card.getBoundingClientRect();
      var after = e.clientX > r.left + r.width / 2;
      clearCardMarks();
      reorderCard(draggedId, card.dataset.id, after, card.dataset.folder || null);
    });
  });

  folderHeaders.forEach(function (header) {
    header.addEventListener('dragstart', function (e) {
      draggingFolderId = header.dataset.folderDragId;
      header.closest('.folder-section').classList.add('dragging');
      e.dataTransfer.setData('application/folder-id', draggingFolderId);
      e.dataTransfer.effectAllowed = 'move';
    });
    header.addEventListener('dragend', function () {
      draggingFolderId = null;
      document.querySelectorAll('.folder-section.dragging').forEach(function (s) { s.classList.remove('dragging'); });
      clearFolderMarks();
    });
  });

  sections.forEach(function (section) {
    section.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (draggingFolderId) {
        var targetId = section.dataset.folderId;
        if (!targetId || targetId === draggingFolderId) return;
        e.dataTransfer.dropEffect = 'move';
        clearFolderMarks();
        var r = section.getBoundingClientRect();
        var below = e.clientY > r.top + r.height / 2;
        section.classList.add(below ? 'folder-drop-below' : 'folder-drop-above');
      } else {
        e.dataTransfer.dropEffect = 'move';
        section.classList.add('drag-over');
      }
    });
    section.addEventListener('dragleave', function (e) {
      if (!section.contains(e.relatedTarget)) {
        section.classList.remove('drag-over', 'folder-drop-above', 'folder-drop-below');
      }
    });
    section.addEventListener('drop', function (e) {
      e.preventDefault();
      section.classList.remove('drag-over');
      if (draggingFolderId) {
        clearFolderMarks();
        var targetId = section.dataset.folderId;
        if (targetId && targetId !== draggingFolderId) {
          var r = section.getBoundingClientRect();
          var below = e.clientY > r.top + r.height / 2;
          reorderFolder(draggingFolderId, targetId, below);
        }
      } else {
        var wsId = e.dataTransfer.getData('text/plain');
        var folderId = section.dataset.folderId;
        moveToFolder(wsId, folderId || null);
      }
    });
  });
}

function clearFolderMarks() {
  document.querySelectorAll('.folder-drop-above,.folder-drop-below').forEach(function (el) {
    el.classList.remove('folder-drop-above', 'folder-drop-below');
  });
}

async function reorderFolder(draggedId, targetId, placeBelow) {
  if (draggedId === targetId) return;
  var dragged = folders.find(function (f) { return f.id === draggedId; });
  if (!dragged) return;
  folders = folders.filter(function (f) { return f.id !== draggedId; });
  var ti = folders.findIndex(function (f) { return f.id === targetId; });
  if (ti < 0) ti = folders.length - 1;
  folders.splice(ti + (placeBelow ? 1 : 0), 0, dragged);
  await saveFolders(folders);
  applyFilter();
}

async function moveToFolder(wsId, folderId) {
  var ws = workspaces.find(function (w) { return w.id === wsId; });
  if (!ws) return;
  var newFolderId = folderId || null;
  if ((ws.folderId || null) === newFolderId) return;
  ws.folderId = newFolderId;
  await saveWorkspaces(workspaces);
  applyFilter();
}

function clearCardMarks() {
  document.querySelectorAll('.card.drop-left,.card.drop-right').forEach(function (el) {
    el.classList.remove('drop-left', 'drop-right');
  });
}

async function reorderCard(draggedId, targetId, placeAfter, targetFolder) {
  if (draggedId === targetId) return;
  var dragged = workspaces.find(function (w) { return w.id === draggedId; });
  if (!dragged) return;
  workspaces = workspaces.filter(function (w) { return w.id !== draggedId; });
  dragged.folderId = targetFolder || null;
  var ti = workspaces.findIndex(function (w) { return w.id === targetId; });
  if (ti < 0) ti = workspaces.length - 1;
  workspaces.splice(ti + (placeAfter ? 1 : 0), 0, dragged);
  await saveWorkspaces(workspaces);
  applyFilter();
}

// ── Card Click ──
function onCardClick(e) {
  var actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    e.stopPropagation();
    var action = actionBtn.dataset.action;
    var id = actionBtn.dataset.id;
    if (action === 'delete') deleteWs(id);
    else if (action === 'edit') {
      var ws = workspaces.find(function (w) { return w.id === id; });
      if (ws) openWsModal(ws);
    }
    return;
  }
  var url = e.currentTarget.dataset.url;
  if (url) chrome.tabs.create({ url: url });
}

async function deleteWs(id) {
  workspaces = workspaces.filter(function (w) { return w.id !== id; });
  await saveWorkspaces(workspaces);
  applyFilter();
  updateTotal();
}

async function deleteFolder(id) {
  folders = folders.filter(function (f) { return f.id !== id; });
  workspaces.forEach(function (ws) {
    if (ws.folderId === id) ws.folderId = null;
  });
  await Promise.all([saveFolders(folders), saveWorkspaces(workspaces)]);
  applyFilter();
}

// ── Search ──
function onSearch() { applyFilter(); }

function applyFilter() {
  var q = document.getElementById('search').value.toLowerCase().trim();
  filtered = q
    ? workspaces.filter(function (w) {
        return w.name.toLowerCase().includes(q) ||
               w.url.toLowerCase().includes(q) ||
               (w.emoji && w.emoji.includes(q));
      })
    : workspaces.slice();
  render();
}

// ── Global Keys ──
function onGlobalKey(e) {
  var search = document.getElementById('search');
  var wsModal = document.getElementById('modal');
  var folderModalEl = document.getElementById('folder-modal');

  if (wsModal.classList.contains('open')) {
    if (e.key === 'Escape') closeWsModal();
    return;
  }
  if (folderModalEl.classList.contains('open')) {
    if (e.key === 'Escape') closeFolderModal();
    return;
  }

  if (e.key === '/' && document.activeElement !== search) {
    e.preventDefault();
    search.focus();
    return;
  }

  if (e.key >= '1' && e.key <= '9' && !search.value) {
    var idx = parseInt(e.key) - 1;
    if (idx < displayOrder.length) {
      e.preventDefault();
      chrome.tabs.create({ url: displayOrder[idx].url });
    }
    return;
  }

  if (e.key === 'Enter' && document.activeElement === search && displayOrder.length > 0) {
    chrome.tabs.create({ url: displayOrder[0].url });
  }

  if (e.key === 'Escape' && document.activeElement === search) {
    if (search.value) {
      search.value = '';
      applyFilter();
    } else {
      search.blur();
    }
  }
}

// ── Workspace Modal ──
function openWsModal(ws) {
  editingWsId = ws ? ws.id : null;
  document.getElementById('modal-title').textContent = ws ? t('editWorkspace') : t('addWorkspace');
  document.getElementById('m-save').textContent = ws ? t('edit') : t('save');

  document.getElementById('m-emoji').value = ws ? (ws.emoji || '') : '';
  document.getElementById('m-name').value = ws ? ws.name : '';
  document.getElementById('m-url').value = ws ? ws.url : '';
  buildSwatches(document.getElementById('m-colors'), ws && ws.colorId != null ? ws.colorId : null);

  if (ws && ws.expireAt) {
    var days = remainingDays(ws.expireAt);
    document.getElementById('m-expire').value = 'custom';
    document.getElementById('m-custom-days-row').style.display = 'flex';
    document.getElementById('m-custom-days').value = days > 0 ? days : 1;
  } else {
    document.getElementById('m-expire').value = '';
    document.getElementById('m-custom-days-row').style.display = 'none';
    document.getElementById('m-custom-days').value = '';
  }

  var select = document.getElementById('m-folder');
  var optionsHtml = '<option value="">📋 ' + esc(t('uncategorized')) + '</option>';
  folders.forEach(function (f) {
    var sel = ws && ws.folderId === f.id ? ' selected' : '';
    optionsHtml += '<option value="' + esc(f.id) + '"' + sel + '>' + (f.emoji || '📁') + ' ' + esc(f.name) + '</option>';
  });
  select.innerHTML = optionsHtml;

  document.getElementById('modal').classList.add('open');
  document.getElementById('m-name').focus();
}

function closeWsModal() {
  document.getElementById('modal').classList.remove('open');
  editingWsId = null;
  ['m-emoji', 'm-name', 'm-url'].forEach(function (id) {
    var el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
  document.getElementById('m-expire').value = '';
  document.getElementById('m-custom-days-row').style.display = 'none';
  document.getElementById('m-custom-days').value = '';
}

async function saveWs() {
  var emoji = document.getElementById('m-emoji').value.trim();
  var name = document.getElementById('m-name').value.trim();
  var url = document.getElementById('m-url').value.trim();
  var folderId = document.getElementById('m-folder').value || null;
  var colorId = getSwatch(document.getElementById('m-colors'));

  var fUrl = document.getElementById('m-url');
  fUrl.classList.remove('error');

  if (!url) { fUrl.classList.add('error'); fUrl.focus(); return; }

  if (!/^https?:\/\//.test(url)) url = 'https://' + url;

  if (!name) name = autoName(url);

  var expireVal = document.getElementById('m-expire').value;
  var expireAt = null;
  if (expireVal === 'custom') {
    var customDays = parseInt(document.getElementById('m-custom-days').value);
    if (!customDays || customDays < 1) {
      document.getElementById('m-custom-days').classList.add('error');
      document.getElementById('m-custom-days').focus();
      return;
    }
    expireAt = Date.now() + customDays * 86400000;
  } else if (expireVal) {
    expireAt = Date.now() + parseInt(expireVal) * 86400000;
  }

  if (editingWsId) {
    var ws = workspaces.find(function (w) { return w.id === editingWsId; });
    if (ws) {
      ws.name = name;
      ws.url = url;
      ws.emoji = emoji || null;
      ws.folderId = folderId;
      ws.colorId = colorId;
      ws.expireAt = expireAt;
    }
  } else {
    workspaces.push({
      id: Date.now().toString(),
      name: name,
      url: url,
      emoji: emoji || null,
      folderId: folderId,
      colorId: colorId,
      expireAt: expireAt
    });
  }

  await saveWorkspaces(workspaces);
  closeWsModal();
  applyFilter();
  updateTotal();
}

// ── Folder Modal ──
function openFolderModal(folder) {
  editingFolderId = folder ? folder.id : null;
  document.getElementById('folder-modal-title').textContent = folder ? t('folderEdit') : t('folderAdd');
  document.getElementById('fm-save').textContent = folder ? t('edit') : t('save');

  document.getElementById('fm-emoji').value = folder ? (folder.emoji || '') : '';
  document.getElementById('fm-name').value = folder ? folder.name : '';

  document.getElementById('folder-modal').classList.add('open');
  document.getElementById('fm-name').focus();
}

function closeFolderModal() {
  document.getElementById('folder-modal').classList.remove('open');
  editingFolderId = null;
  ['fm-emoji', 'fm-name'].forEach(function (id) {
    var el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
}

async function saveFolder() {
  var emoji = document.getElementById('fm-emoji').value.trim();
  var name = document.getElementById('fm-name').value.trim();

  var fName = document.getElementById('fm-name');
  fName.classList.remove('error');

  if (!name) { fName.classList.add('error'); fName.focus(); return; }

  if (editingFolderId) {
    var folder = folders.find(function (f) { return f.id === editingFolderId; });
    if (folder) {
      folder.name = name;
      folder.emoji = emoji || null;
    }
  } else {
    folders.push({
      id: Date.now().toString(),
      name: name,
      emoji: emoji || null
    });
  }

  await saveFolders(folders);
  closeFolderModal();
  applyFilter();
}

init();
