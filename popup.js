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
  var html = '<option value="">📋 미분류</option>';
  folders.forEach(function (f) {
    var sel = selectedFolderId === f.id ? ' selected' : '';
    html += '<option value="' + esc(f.id) + '"' + sel + '>' + (f.emoji || '📁') + ' ' + esc(f.name) + '</option>';
  });
  html += '<option value="__new__">＋ 새 폴더...</option>';
  select.innerHTML = html;
  document.getElementById('new-folder-row').style.display = 'none';
}

async function createNewFolder() {
  var emoji = document.getElementById('f-folder-emoji').value.trim();
  var name = document.getElementById('f-folder-name').value.trim();
  if (!name) { document.getElementById('f-folder-name').focus(); return; }

  var newFolder = { id: Date.now().toString(), name: name, emoji: emoji || null };
  folders.push(newFolder);
  await saveFolders(folders);

  populateFolderSelect(newFolder.id);
  document.getElementById('f-folder-name').value = '';
  document.getElementById('f-folder-emoji').value = '';
}

async function smartOpen(url, forceNew) {
  if (forceNew) {
    chrome.tabs.create({ url: url });
    window.close();
    return;
  }
  try {
    var base = url.split('?')[0].replace(/\/$/, '');
    var all = await chrome.tabs.query({ url: ['https://www.notion.so/*', 'https://notion.so/*'] });
    var match = all.find(function (t) { return t.url && t.url.split('?')[0].replace(/\/$/, '').startsWith(base); });
    if (match) {
      await chrome.tabs.update(match.id, { active: true });
      await chrome.windows.update(match.windowId, { focused: true });
      window.close();
      return;
    }
  } catch (e) {}
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.update(tabs[0].id, { url: url });
  window.close();
}

var workspaces = [];
var folders = [];
var filtered = [];
var displayOrder = [];
var currentTabUrl = '';
var editingId = null;
var dragId = null;

async function init() {
  Theme.init();
  var results = await Promise.all([loadWorkspaces(), loadFolders()]);
  workspaces = results[0];
  folders = results[1];
  filtered = workspaces.slice();

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tabs[0].url || '';
  } catch (e) {}

  renderList();
  updateCount();

  var search = document.getElementById('search');
  search.focus();
  search.addEventListener('input', onSearch);
  search.addEventListener('keydown', onSearchKey);

  document.getElementById('btn-dashboard').addEventListener('click', openDashboard);
  Settings.mount(document.getElementById('btn-theme'));
  CustomSelect.enhance(document.getElementById('f-folder'));
}

function openDashboard() {
  var url = chrome.runtime.getURL('dashboard.html');
  chrome.tabs.create({ url: url });
  window.close();
}

function updateCount() {
  document.getElementById('ws-count').textContent = workspaces.length > 0 ? workspaces.length + '개' : '';
}

function renderItem(ws, idx) {
  var tile = tileFor(ws);
  var icon = ws.emoji
    ? '<span>' + esc(ws.emoji) + '</span>'
    : '<span class="initial" style="color:' + tile[1] + '">' + esc(getInitial(ws.name)) + '</span>';
  var isActive = currentTabUrl && ws.url && currentTabUrl.startsWith(ws.url.split('?')[0]);
  var badge = idx < 9 ? '<div class="ws-badge">' + (idx + 1) + '</div>' : '';

  return '<div class="workspace-item' + (isActive ? ' active-ws' : '') + '"' +
    ' data-id="' + esc(ws.id) + '" data-url="' + esc(ws.url) + '" data-idx="' + idx + '"' +
    ' data-folder="' + esc(ws.folderId || '') + '">' +
    '<div class="ws-gutter">' +
      '<button class="g-btn g-add" data-action="add" data-folder="' + esc(ws.folderId || '') + '" title="여기에 추가" tabindex="-1">＋</button>' +
      '<span class="g-btn g-handle" draggable="true" title="드래그하여 정렬" tabindex="-1">⠿</span>' +
    '</div>' +
    '<div class="ws-icon" style="background:' + tile[0] + '">' + icon + '</div>' +
    '<div class="ws-info">' +
      '<div class="ws-name">' + esc(ws.name) + '</div>' +
      '<div class="ws-url">' + esc(shortUrl(ws.url)) + '</div>' +
    '</div>' +
    '<div class="ws-meta">' +
      '<div class="ws-actions">' +
        '<button class="btn-sm edit" data-action="edit" data-id="' + esc(ws.id) + '" title="편집" tabindex="-1">✎</button>' +
        '<button class="btn-sm" data-action="newtab" data-url="' + esc(ws.url) + '" title="새 탭" tabindex="-1">↗</button>' +
        '<button class="btn-sm del" data-action="delete" data-id="' + esc(ws.id) + '" title="삭제" tabindex="-1">✕</button>' +
      '</div>' +
      badge +
    '</div>' +
  '</div>';
}

function renderList() {
  var list = document.getElementById('ws-list');
  var isSearching = document.getElementById('search').value.trim().length > 0;

  displayOrder = [];

  if (filtered.length === 0) {
    var isEmpty = workspaces.length === 0;
    list.innerHTML =
      '<div class="empty">' +
        (isEmpty ? '워크스페이스가 없습니다' : '검색 결과 없음') +
        (isEmpty ? '<div class="empty-sub">아래 + 버튼으로 추가해보세요</div>' : '') +
      '</div>';
    return;
  }

  if (isSearching || folders.length === 0) {
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
        html += '<div class="folder-label"><span class="fl-emoji">' + (folder.emoji || '📁') + '</span>' + esc(folder.name) + '</div>';
        items.forEach(function (ws) {
          displayOrder.push(ws);
          html += renderItem(ws, idx);
          idx++;
        });
      });

      if (unfiled.length > 0) {
        html += '<div class="folder-label"><span class="fl-emoji">📋</span>미분류</div>';
        unfiled.forEach(function (ws) {
          displayOrder.push(ws);
          html += renderItem(ws, idx);
          idx++;
        });
      }

      list.innerHTML = html;
    }
  }

  list.querySelectorAll('.workspace-item').forEach(function (el) {
    el.addEventListener('click', onItemClick);
  });
  if (!isSearching) bindDrag(list);
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
    if (action === 'newtab') await smartOpen(btn.dataset.url, true);
    else if (action === 'delete') await deleteWs(btn.dataset.id);
    else if (action === 'edit') startEdit(btn.dataset.id);
    else if (action === 'add') openAddForm(btn.dataset.folder || null);
    return;
  }
  var url = e.currentTarget.dataset.url;
  await smartOpen(url, e.shiftKey || e.ctrlKey);
}

function startEdit(id) {
  var ws = workspaces.find(function (w) { return w.id === id; });
  if (!ws) return;

  editingId = ws.id;
  document.getElementById('f-emoji').value = ws.emoji || '';
  document.getElementById('f-name').value = ws.name;
  document.getElementById('f-url').value = ws.url;
  buildSwatches(document.getElementById('f-colors'), ws.colorId != null ? ws.colorId : null);
  document.getElementById('btn-save').textContent = '수정';
  populateFolderSelect(ws.folderId);
  addForm.classList.add('open');
  document.getElementById('f-name').focus();
}

async function deleteWs(id) {
  workspaces = workspaces.filter(function (w) { return w.id !== id; });
  await saveWorkspaces(workspaces);
  applyFilter();
  updateCount();
}

function onSearch() { applyFilter(); }

function onSearchKey(e) {
  if (Settings.isOpen()) return;

  if (!document.getElementById('search').value && e.key >= '1' && e.key <= '9') {
    var idx = parseInt(e.key) - 1;
    if (idx < displayOrder.length) {
      e.preventDefault();
      smartOpen(displayOrder[idx].url, e.shiftKey);
    }
    return;
  }

  if (e.key === 'Enter' && displayOrder.length > 0) {
    smartOpen(displayOrder[0].url, e.shiftKey);
  }
  if (e.key === 'Escape') {
    var q = document.getElementById('search').value;
    if (q) {
      document.getElementById('search').value = '';
      applyFilter();
    } else {
      window.close();
    }
  }
  if (Settings.matches(e, Settings.get('openDashFromPopup')) && !document.getElementById('search').value) {
    e.preventDefault();
    openDashboard();
  }
}

function applyFilter() {
  var q = document.getElementById('search').value.toLowerCase().trim();
  filtered = q
    ? workspaces.filter(function (w) {
        return w.name.toLowerCase().includes(q) ||
               w.url.toLowerCase().includes(q) ||
               (w.emoji && w.emoji.includes(q));
      })
    : workspaces.slice();
  renderList();
}

// ── Add / Edit Form ──
var addForm = document.getElementById('add-form');

function openAddForm(folderId) {
  editingId = null;
  clearForm();
  document.getElementById('btn-save').textContent = '저장';
  populateFolderSelect(folderId || null);
  buildSwatches(document.getElementById('f-colors'), null);
  addForm.classList.add('open');

  if (currentTabUrl.includes('notion.so')) {
    var urlInput = document.getElementById('f-url');
    if (!urlInput.value) urlInput.value = currentTabUrl.split('?')[0];
  }
  document.getElementById('f-name').focus();
}

document.getElementById('btn-add').addEventListener('click', function () {
  var isOpen = addForm.classList.contains('open');
  if (isOpen && !editingId) {
    addForm.classList.remove('open');
    clearForm();
    return;
  }
  openAddForm(null);
});

document.getElementById('btn-cancel').addEventListener('click', function () {
  editingId = null;
  document.getElementById('btn-save').textContent = '저장';
  addForm.classList.remove('open');
  clearForm();
});

document.getElementById('btn-save').addEventListener('click', saveForm);

['f-emoji','f-name','f-url'].forEach(function (id) {
  document.getElementById(id).addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveForm();
    if (e.key === 'Escape') {
      editingId = null;
      document.getElementById('btn-save').textContent = '저장';
      addForm.classList.remove('open');
      clearForm();
    }
  });
});

async function saveForm() {
  var emoji = document.getElementById('f-emoji').value.trim();
  var name  = document.getElementById('f-name').value.trim();
  var url   = document.getElementById('f-url').value.trim();

  var ok = true;
  var fName = document.getElementById('f-name');
  var fUrl  = document.getElementById('f-url');
  fName.classList.remove('error');
  fUrl.classList.remove('error');

  if (!name) { fName.classList.add('error'); fName.focus(); ok = false; }
  if (!url)  { fUrl.classList.add('error');  if (ok) fUrl.focus(); ok = false; }
  if (!ok) return;

  if (!/^https?:\/\//.test(url)) url = 'https://' + url;

  var folderId = document.getElementById('f-folder').value || null;
  if (folderId === '__new__') folderId = null;

  var colorId = getSwatch(document.getElementById('f-colors'));

  if (editingId) {
    var ws = workspaces.find(function (w) { return w.id === editingId; });
    if (ws) {
      ws.name = name;
      ws.url = url;
      ws.emoji = emoji || null;
      ws.folderId = folderId;
      ws.colorId = colorId;
    }
  } else {
    workspaces.push({ id: Date.now().toString(), name: name, url: url, emoji: emoji || null, folderId: folderId, colorId: colorId });
  }

  await saveWorkspaces(workspaces);

  editingId = null;
  document.getElementById('btn-save').textContent = '저장';
  addForm.classList.remove('open');
  clearForm();
  applyFilter();
  updateCount();
}

function clearForm() {
  ['f-emoji','f-name','f-url'].forEach(function (id) {
    var el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
  var folderEmoji = document.getElementById('f-folder-emoji');
  var folderName = document.getElementById('f-folder-name');
  if (folderEmoji) folderEmoji.value = '';
  if (folderName) folderName.value = '';
  var newFolderRow = document.getElementById('new-folder-row');
  if (newFolderRow) newFolderRow.style.display = 'none';
}

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
