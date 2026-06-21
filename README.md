# Notion Switcher

> Quickly switch between Notion workspaces with a single click or keyboard shortcut.

Notion Switcher is a Chrome extension that lets you jump between Notion workspaces in under 2 seconds. No more digging through sidebars — just press `Alt+N` and go.

---

## Features

### Workspace Management
- **Add / Edit / Delete** workspaces with name, URL, emoji, and color
- **Folders** — organize workspaces into groups
- **Search** — real-time filtering by name, URL, or emoji
- **Drag & Drop** — reorder workspaces and move between folders

### Quick Switch
- Press `1`~`9` to jump to a workspace instantly
- `Enter` opens the first search result
- `Shift+click` opens in a new tab

### Two Views
- **Popup** (`Alt+N`) — compact 320px panel for fast switching
- **Dashboard** (`Alt+Shift+N`) — full-page grid for managing all workspaces

### Settings
- **Theme** — System / Light / Dark
- **Custom shortcuts** — remap in-app keyboard shortcuts with conflict detection
- **Feedback** — built-in Tally form for bug reports and feature requests

### Internationalization
- Auto-switches between **Korean** and **English** based on browser language
- All UI strings are localized via Chrome i18n API

---

## Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Alt+N` | Open popup | Global |
| `Alt+Shift+N` | Open dashboard | Global |
| `1`~`9` | Jump to workspace | Popup / Dashboard |
| `Enter` | Open first result | Search |
| `Escape` | Clear search / close | Popup / Dashboard |
| `/` | Focus search | Dashboard |
| `D` | Open dashboard | Popup (empty search) |

---

## Install

### From source (Developer mode)
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `notion-switcher` folder

### Chrome Web Store
Coming soon.

---

## Tech Stack

| | |
|---|---|
| Platform | Chrome Extension (Manifest V3) |
| Language | Vanilla JavaScript |
| Storage | chrome.storage.sync (cross-device sync) |
| Styling | CSS Custom Properties |
| i18n | Chrome i18n API (`_locales/`) |
| Build | None (no bundler) |

---

## File Structure

```
notion-switcher/
├── manifest.json          # Extension config
├── background.js          # Service worker
├── popup.html / popup.js  # Popup UI
├── dashboard.html / dashboard.js  # Dashboard UI
├── ui.js                  # Shared UI helpers
├── settings.js            # Settings panel
├── i18n.js                # i18n helper
├── theme-init.js          # Early theme application
├── styles/
│   ├── tokens.css         # Design tokens
│   └── components.css     # Shared component styles
├── icons/                 # Extension icons + QR images
├── _locales/
│   ├── ko/messages.json   # Korean
│   └── en/messages.json   # English
└── PRD.md                 # Product Requirements Document
```

---

## Permissions

| Permission | Usage |
|------------|-------|
| `storage` | Save workspaces, folders, and settings (synced across devices) |
| `tabs` | Detect active tab URL + open workspaces in new tabs |

---

## Feedback

Bug reports and feature requests: [Feedback Form](https://tally.so/r/9qxE61)

---

## License

MIT
