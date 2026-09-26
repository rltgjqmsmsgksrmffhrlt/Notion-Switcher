'use strict';
/* Backup file: export the forest to JSON and bring it back (loaded after launch.js).
 *
 * File shape (format "baobab-backup", version 1):
 *   { format, version, exportedAt, app: { name, version }, workspaces: [...], folders: [...], settings: {...} }
 * `workspaces` are leaves and `folders` are trees, named as in storage so nothing is renamed on the way.
 *
 * Everything read from a file is untrusted: each leaf's url goes through Launch.normalize
 * (so javascript:/data: links are dropped) and every field is type-checked and clamped.
 */
(function (root) {
  var FORMAT = 'baobab-backup';
  var VERSION = 1;
  var TILE_COUNT = 8;

  function str(v, max) {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
  }

  function newId(taken) {
    var id = String(Date.now());
    while (taken[id]) id = String(Number(id) + 1);
    taken[id] = true;
    return id;
  }

  function cleanFolder(f, taken) {
    if (!f || typeof f !== 'object') return null;
    var name = str(f.name, 100);
    if (!name) return null;
    var id = str(f.id, 64);
    if (!id || taken[id]) id = newId(taken); else taken[id] = true;
    return { id: id, name: name, emoji: str(f.emoji, 16) || null };
  }

  function cleanLeaf(w, taken, now) {
    if (!w || typeof w !== 'object') return null;
    var url = root.Launch.normalize(str(w.url, 4096));
    if (!url) return null;
    if (typeof w.expireAt === 'number' && w.expireAt <= now) return null;
    var id = str(w.id, 64);
    if (!id || taken[id]) id = newId(taken); else taken[id] = true;
    var colorId = (typeof w.colorId === 'number' && w.colorId >= 0 && w.colorId < TILE_COUNT) ? Math.floor(w.colorId) : null;
    return {
      id: id,
      name: str(w.name, 200) || root.Launch.suggestName(url) || url,
      url: url,
      emoji: str(w.emoji, 16) || null,
      folderId: str(w.folderId, 64) || null,
      colorId: colorId,
      expireAt: typeof w.expireAt === 'number' ? w.expireAt : null
    };
  }

  function cleanSettings(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    var out = {};
    if (typeof s.hideUncategorized === 'boolean') out.hideUncategorized = s.hideUncategorized;
    return out;
  }

  function fail(code) { var e = new Error(code); e.code = code; return e; }

  var Backup = {
    FORMAT: FORMAT,
    VERSION: VERSION,

    /** The backup object for the current lists. */
    build: function (workspaces, folders, settings, appVersion) {
      return {
        format: FORMAT,
        version: VERSION,
        exportedAt: new Date().toISOString(),
        app: { name: 'Baobab', version: appVersion || '' },
        workspaces: workspaces || [],
        folders: folders || [],
        settings: settings || {}
      };
    },

    /** "baobab-backup-2026-09-26.json" */
    fileName: function (date) {
      var d = date || new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return 'baobab-backup-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
    },

    /**
     * Parse and sanitize a backup file's text.
     * Returns { workspaces, folders, settings, skipped, exportedAt }.
     * Throws an Error whose `code` is 'notJson' | 'notBackup' | 'newerVersion'.
     */
    parse: function (text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { throw fail('notJson'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail('notBackup');
      if (data.format != null && data.format !== FORMAT) throw fail('notBackup');
      if (!Array.isArray(data.workspaces) && !Array.isArray(data.folders)) throw fail('notBackup');
      if (typeof data.version === 'number' && data.version > VERSION) throw fail('newerVersion');

      var now = Date.now();
      var folderIds = {}, leafIds = {};
      var rawFolders = Array.isArray(data.folders) ? data.folders : [];
      var rawLeaves = Array.isArray(data.workspaces) ? data.workspaces : [];

      var folders = rawFolders.map(function (f) { return cleanFolder(f, folderIds); }).filter(Boolean);
      var leaves = [], skipped = 0;
      rawLeaves.forEach(function (w) {
        var c = cleanLeaf(w, leafIds, now);
        if (c) leaves.push(c); else skipped++;
      });
      // a leaf pointing at a tree the file doesn't have becomes a seed
      leaves.forEach(function (w) { if (w.folderId && !folderIds[w.folderId]) w.folderId = null; });

      return {
        workspaces: leaves,
        folders: folders,
        settings: cleanSettings(data.settings),
        skipped: skipped,
        exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null
      };
    },

    /**
     * Add an imported backup to the current lists.
     * Trees are matched by id; leaves are skipped when their id or url is already there.
     * Returns { workspaces, folders, addedLeaves, addedTrees, duplicates }.
     */
    merge: function (curLeaves, curFolders, incoming) {
      var folders = curFolders.slice();
      var haveFolder = {};
      folders.forEach(function (f) { haveFolder[f.id] = true; });
      var addedTrees = 0;
      incoming.folders.forEach(function (f) {
        if (!haveFolder[f.id]) { folders.push(f); haveFolder[f.id] = true; addedTrees++; }
      });

      var leaves = curLeaves.slice();
      var haveId = {}, haveUrl = {};
      leaves.forEach(function (w) { haveId[w.id] = true; haveUrl[w.url] = true; });
      var addedLeaves = 0, duplicates = 0;
      incoming.workspaces.forEach(function (w) {
        if (haveId[w.id] || haveUrl[w.url]) { duplicates++; return; }
        var copy = {};
        Object.keys(w).forEach(function (k) { copy[k] = w[k]; });
        if (copy.folderId && !haveFolder[copy.folderId]) copy.folderId = null;
        leaves.push(copy);
        haveId[w.id] = true; haveUrl[w.url] = true;
        addedLeaves++;
      });

      return { workspaces: leaves, folders: folders, addedLeaves: addedLeaves, addedTrees: addedTrees, duplicates: duplicates };
    }
  };

  root.Backup = Backup;
})(typeof window !== 'undefined' ? window : globalThis);
