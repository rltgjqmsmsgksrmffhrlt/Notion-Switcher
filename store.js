'use strict';
/* List storage shared by popup, dashboard and settings (loaded before ui.js).
 *
 * chrome.storage.sync allows 8KB per key and 100KB in total. v3 kept each list
 * (`workspaces`, `folders`) under one key, so saving failed after ~50 leaves.
 * A list is now split into chunks under `<name>.0`, `<name>.1`, … with the chunk
 * count in `<name>.n`, which lets it grow to the 100KB total.
 *
 * If even that is full, the list is saved to chrome.storage.local (this device only)
 * so nothing is lost, and `mode(name)` reports 'local'. Every later save tries sync
 * again first, so the list returns to syncing once it fits.
 *
 * The v3 single-key value is still read when no chunks exist and is removed on the
 * next save.
 */
(function (root) {
  var CHUNK_BYTES = 7900;            // under QUOTA_BYTES_PER_ITEM (8192) incl. key
  var MODE_KEY = 'storeMode';        // chrome.storage.local: { <name>: 'local' }
  var modes = {};

  function area(name) { return root.chrome.storage[name]; }

  function call(a, method, arg) {
    return new Promise(function (resolve, reject) {
      a[method](arg, function (res) {
        var err = root.chrome.runtime && root.chrome.runtime.lastError;
        if (err) reject(new Error(err.message || String(err)));
        else resolve(res);
      });
    });
  }

  function byteLen(str) {
    return root.TextEncoder ? new TextEncoder().encode(str).length : unescape(encodeURIComponent(str)).length;
  }

  // Drop null/undefined fields: every reader already treats a missing field as null.
  function compact(item) {
    if (!item || typeof item !== 'object') return item;
    var out = {};
    Object.keys(item).forEach(function (k) { if (item[k] != null) out[k] = item[k]; });
    return out;
  }

  /** Split a list into chunks whose stored size (key + JSON) stays under CHUNK_BYTES. */
  function chunk(name, list) {
    var chunks = [], cur = [], size = 2;
    list.forEach(function (item) {
      var b = byteLen(JSON.stringify(item)) + 1;
      var keyLen = byteLen(name + '.' + chunks.length);
      if (cur.length && keyLen + size + b > CHUNK_BYTES) {
        chunks.push(cur); cur = []; size = 2;
      }
      cur.push(item); size += b;
    });
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  function readFrom(all, name) {
    var n = all[name + '.n'];
    if (typeof n === 'number') {
      var out = [];
      for (var i = 0; i < n; i++) out = out.concat(all[name + '.' + i] || []);
      return out;
    }
    return Array.isArray(all[name]) ? all[name] : [];   // v3 single key
  }

  function keysOf(all, name) {
    return Object.keys(all).filter(function (k) {
      return k === name || k.indexOf(name + '.') === 0;
    });
  }

  function loadModes() {
    return call(area('local'), 'get', [MODE_KEY]).then(function (d) {
      modes = (d && d[MODE_KEY]) || {};
      return modes;
    }, function () { return modes; });
  }

  function setMode(name, mode) {
    if ((modes[name] || 'sync') === mode) return Promise.resolve();
    if (mode === 'sync') delete modes[name]; else modes[name] = mode;
    var v = {}; v[MODE_KEY] = modes;
    return call(area('local'), 'set', v).catch(function () {});
  }

  /** Write `list` as chunks into one area, then drop chunks the old value left behind. */
  function writeTo(areaName, name, list) {
    var a = area(areaName);
    return call(a, 'get', null).then(function (all) {
      var chunks = chunk(name, list.map(compact));
      var data = {};
      data[name + '.n'] = chunks.length;
      chunks.forEach(function (c, i) { data[name + '.' + i] = c; });
      return call(a, 'set', data).then(function () {
        var stale = keysOf(all || {}, name).filter(function (k) { return !(k in data); });
        return stale.length ? call(a, 'remove', stale).catch(function () {}) : null;
      });
    });
  }

  function removeFrom(areaName, name) {
    var a = area(areaName);
    return call(a, 'get', null).then(function (all) {
      var keys = keysOf(all || {}, name);
      return keys.length ? call(a, 'remove', keys) : null;
    }).catch(function () {});
  }

  var Store = {
    CHUNK_BYTES: CHUNK_BYTES,

    /** Resolve to the saved list (never rejects; an unreadable store reads as empty). */
    loadList: function (name) {
      return loadModes().then(function () {
        var from = modes[name] === 'local' ? 'local' : 'sync';
        return call(area(from), 'get', null).then(function (all) { return readFrom(all || {}, name); });
      }).catch(function () { return []; });
    },

    /** Save a list. Resolves to 'sync' or 'local' (the area it landed in). */
    saveList: function (name, list) {
      return writeTo('sync', name, list).then(function () {
        return removeFrom('local', name).then(function () { return setMode(name, 'sync'); }).then(function () { return 'sync'; });
      }, function (err) {
        // Over the sync quota (or sync unavailable): keep the data on this device.
        if (root.console) console.warn('[Baobab] sync save failed, keeping "' + name + '" on this device:', err.message);
        return writeTo('local', name, list).then(function () { return setMode(name, 'local'); }).then(function () { return 'local'; });
      });
    },

    /** Remove lists from both areas (used by "clear the whole forest"). */
    clearLists: function (names) {
      return Promise.all(names.map(function (n) {
        return Promise.all([removeFrom('sync', n), removeFrom('local', n), setMode(n, 'sync')]);
      }));
    },

    /** 'sync' or 'local' for a list, as of the last load or save. */
    mode: function (name) { return modes[name] === 'local' ? 'local' : 'sync'; },

    /** { bytes, quota } used in chrome.storage.sync, for the settings panel. */
    syncUsage: function () {
      var s = area('sync');
      var quota = s.QUOTA_BYTES || 102400;
      if (!s.getBytesInUse) return Promise.resolve({ bytes: null, quota: quota });
      return call(s, 'getBytesInUse', null).then(function (bytes) { return { bytes: bytes, quota: quota }; },
        function () { return { bytes: null, quota: quota }; });
    },

    /** Call `cb(list)` whenever a list changes in either area (debounced). */
    onListChange: function (name, cb) {
      var timer = null;
      root.chrome.storage.onChanged.addListener(function (changes) {
        var hit = Object.keys(changes).some(function (k) {
          return k === name || k.indexOf(name + '.') === 0 || k === MODE_KEY;
        });
        if (!hit) return;
        clearTimeout(timer);
        timer = setTimeout(function () { Store.loadList(name).then(cb); }, 60);
      });
    }
  };

  // exposed for tests
  Store._chunk = chunk;
  Store._readFrom = readFrom;

  root.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
