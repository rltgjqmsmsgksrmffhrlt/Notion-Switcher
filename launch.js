'use strict';
/* Item types + launcher shared by popup + dashboard (loaded after ui.js).
 *
 * An item's `url` can be:
 *   - a web page      https://docs.google.com/...
 *   - an app deep link notion://..., vscode://file/..., obsidian://open?..., ms-word:ofe|u|https://...
 *   - a local file    file:///C:/Users/me/plan.pdf  (pasted as C:\Users\me\plan.pdf or /Users/me/plan.pdf)
 * `type` is derived from the url at read time, so data saved by older versions needs no migration.
 */
(function (root) {
  // Schemes that are dangerous or meaningless as a saved link.
  var BLOCKED = ['javascript', 'data', 'vbscript', 'blob', 'about'];
  // App schemes that are valid without "//" (e.g. mailto:a@b.c, ms-word:ofe|u|https://...).
  var OPAQUE = ['mailto', 'tel', 'sms', 'msteams', 'spotify', 'ms-word', 'ms-excel', 'ms-powerpoint',
    'ms-visio', 'ms-access', 'ms-project', 'onenote', 'skype', 'facetime', 'callto', 'magnet'];

  // Known desktop apps reachable by deep link: scheme → display label.
  var APPS = {
    notion: 'Notion', vscode: 'VS Code', 'vscode-insiders': 'VS Code', cursor: 'Cursor',
    obsidian: 'Obsidian', figma: 'Figma', slack: 'Slack', zoommtg: 'Zoom', zoomus: 'Zoom',
    msteams: 'Teams', 'ms-word': 'Word', 'ms-excel': 'Excel', 'ms-powerpoint': 'PowerPoint',
    onenote: 'OneNote', spotify: 'Spotify', discord: 'Discord', linear: 'Linear',
    jetbrains: 'JetBrains', idea: 'IntelliJ', things: 'Things', bear: 'Bear', craftdocs: 'Craft',
    mailto: 'Mail', tel: 'Phone', 'x-github-client': 'GitHub Desktop', github: 'GitHub Desktop',
    sourcetree: 'Sourcetree', hwp: '한글'
  };

  // Web hosts grouped into document types. First match wins.
  var WEB = [
    { type: 'notion', re: /(^|\.)(notion\.so|notion\.site|notion\.com)$/ },
    { type: 'google', re: /^(docs|drive|sheets|slides|forms)\.google\.com$/ },
    { type: 'office', re: /(^|\.)(office\.com|sharepoint\.com|onedrive\.live\.com|1drv\.ms)$/ },
    { type: 'design', re: /(^|\.)(figma\.com|miro\.com|canva\.com|framer\.com|whimsical\.com)$/ },
    { type: 'code', re: /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|vercel\.app|codesandbox\.io)$/ },
    { type: 'task', re: /(^|\.)(linear\.app|atlassian\.net|trello\.com|asana\.com|clickup\.com|jira\.com)$/ }
  ];

  var TYPES = {
    web:    { icon: '🌐', key: 'typeWeb' },
    notion: { icon: '📓', key: 'typeNotion' },
    google: { icon: '📄', key: 'typeGoogle' },
    office: { icon: '📊', key: 'typeOffice' },
    design: { icon: '🎨', key: 'typeDesign' },
    code:   { icon: '💻', key: 'typeCode' },
    task:   { icon: '✅', key: 'typeTask' },
    app:    { icon: '🖥️', key: 'typeApp' },
    file:   { icon: '📁', key: 'typeFile' }
  };

  function schemeOf(url) {
    var m = /^([a-z][a-z0-9+.-]*):/i.exec(url);
    return m ? m[1].toLowerCase() : '';
  }

  function encodePath(path) {
    return path.split('/').map(function (seg) {
      // keep drive letters ("C:") readable
      return /^[a-z]:$/i.test(seg) ? seg : encodeURIComponent(seg);
    }).join('/');
  }

  /** Turn user input into a launchable URL, or null if it can't/shouldn't be saved. */
  function normalize(input) {
    var s = String(input || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!s) return null;

    // Windows drive path: C:\dir\file.pdf or C:/dir/file.pdf
    if (/^[a-z]:[\\/]/i.test(s)) return 'file:///' + encodePath(s.replace(/\\/g, '/'));
    // UNC path: \\server\share\file
    if (/^\\\\[^\\]/.test(s)) return 'file://' + encodePath(s.slice(2).replace(/\\/g, '/'));
    // POSIX absolute path: /Users/me/file.md
    if (/^\/[^/]/.test(s)) return 'file://' + encodePath(s);

    var scheme = schemeOf(s);
    if (scheme && BLOCKED.indexOf(scheme) >= 0) return null;
    // "scheme://..." is always a scheme; "word:..." only for known opaque schemes
    // (so "localhost:3000" or "example.com:8080/x" still become https URLs).
    if (scheme && (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || OPAQUE.indexOf(scheme) >= 0)) return s;

    return 'https://' + s;
  }

  /** Item type id for a saved url. */
  function detect(url) {
    var scheme = schemeOf(url);
    if (scheme === 'file') return 'file';
    if (scheme === 'http' || scheme === 'https') {
      var host = '';
      try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) {}
      for (var i = 0; i < WEB.length; i++) if (WEB[i].re.test(host)) return WEB[i].type;
      return 'web';
    }
    return scheme ? 'app' : 'web';
  }

  /** Short label for the type chip, e.g. "VS Code", "Google", "File". */
  function label(url) {
    var type = detect(url);
    if (type === 'app') {
      var s = schemeOf(url);
      return APPS[s] || s;
    }
    return root.t ? root.t(TYPES[type].key) : type;
  }

  function icon(url) { return TYPES[detect(url)].icon; }

  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  /** Human-readable, shortened location for list/card subtitles. */
  function display(url, max) {
    max = max || 34;
    var out;
    var scheme = schemeOf(url);
    if (scheme === 'file') {
      // file:///C:/x → C:/x, file:///Users/x → /Users/x, file://nas/x → //nas/x
      out = safeDecode(url.replace(/^file:/i, '')).replace(/^\/\/\/([a-z]:)/i, '$1').replace(/^\/\/\//, '/');
    } else if (scheme === 'http' || scheme === 'https') {
      try {
        var u = new URL(url);
        out = u.host.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
      } catch (e) { out = url; }
    } else {
      out = safeDecode(url.replace(/^[a-z][a-z0-9+.-]*:(\/\/)?/i, ''));
    }
    if (out.length > max) {
      // paths are most recognisable by their tail (file name), urls by their head
      out = scheme === 'file' ? '…' + out.slice(-(max - 1)) : out.slice(0, max - 1) + '…';
    }
    return out;
  }

  /** Suggested name when the user leaves the name blank; null if nothing useful. */
  function suggestName(url) {
    var scheme = schemeOf(url);
    try {
      var path;
      if (scheme === 'file') {
        path = safeDecode(url.replace(/^file:\/\/\/?/i, '')).replace(/\/$/, '');
        var file = path.split('/').pop();
        return file ? file.replace(/\.[a-z0-9]{1,5}$/i, '') : null;
      }
      if (scheme !== 'http' && scheme !== 'https') return APPS[scheme] || null;
      path = new URL(url).pathname.replace(/^\//, '').replace(/-/g, ' ').replace(/\/$/, '');
      if (path) {
        var segments = path.split('/');
        var last = segments[segments.length - 1].replace(/[a-f0-9]{32}$/i, '').replace(/-+$/, '').trim();
        if (last) return last.charAt(0).toUpperCase() + last.slice(1);
      }
    } catch (e) {}
    return null;
  }

  /**
   * Open an item. Web pages and files open in a new tab; app deep links are handed to
   * the OS by navigating the active tab (Chrome shows its "Open app?" prompt and the
   * page stays put), so no blank tab is left behind.
   * Returns a Promise resolving to 'opened' | 'needs-file-access'.
   */
  function open(url) {
    var c = root.chrome;
    var scheme = schemeOf(url);

    if (scheme === 'file') {
      return new Promise(function (resolve) {
        var go = function () { c.tabs.create({ url: url }); resolve('opened'); };
        if (!c.extension || !c.extension.isAllowedFileSchemeAccess) return go();
        c.extension.isAllowedFileSchemeAccess(function (allowed) {
          if (allowed) return go();
          c.tabs.create({ url: 'chrome://extensions/?id=' + c.runtime.id });
          resolve('needs-file-access');
        });
      });
    }

    if (scheme === 'http' || scheme === 'https') {
      c.tabs.create({ url: url });
      return Promise.resolve('opened');
    }

    return new Promise(function (resolve) {
      c.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (tab && tab.id != null) c.tabs.update(tab.id, { url: url });
        else c.tabs.create({ url: url });
        resolve('opened');
      });
    });
  }

  root.Launch = {
    TYPES: TYPES,
    normalize: normalize,
    detect: detect,
    label: label,
    icon: icon,
    display: display,
    suggestName: suggestName,
    open: open
  };
})(typeof window !== 'undefined' ? window : globalThis);
