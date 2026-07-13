![vibe coded](https://img.shields.io/badge/vibe%20coded-100%25-ff69b4)

# Layout Refresh Extension

Chrome extension (Manifest V3) that watches configured dev-server pages for a
`"Layout not found"` error appearing anywhere in the DOM and automatically
reloads the page when it does. After reload, a short toast confirms the
refresh happened.

## Features

- MutationObserver watches `document.body` (stable across SPA client-side
  navigation, unlike a specific `#root` node reference) for the text
  `"Layout not found"` appearing anywhere on the page.
- As a redundant safety net for single-page apps, `history.pushState` /
  `replaceState` are wrapped and `popstate` is also listened for; each
  triggers a delayed recheck in case a route change's DOM mutations are
  missed or coalesced past the observer.
- On detection, the page is reloaded via `location.reload()`.
- After reload, a green toast ("Refreshed") is shown for ~3 seconds, using a
  `sessionStorage`-independent flag stored in `chrome.storage.local` so it
  survives the full page reload.
- Rate-limited to at most one automatic refresh per 1.5 seconds, to avoid
  refresh loops if the error reappears immediately (e.g. backend still
  starting up).
- Only activates on hosts you explicitly add via the popup — nothing is
  hardcoded to a single port.
- Debug logging (`[LayoutRefreshExtension]` prefix) is always on in the
  Console — useful when diagnosing SPA navigation edge cases. Toggle it off
  by flipping the `DEBUG` constant at the top of `content.js`.

## Configuration (popup)

Click the extension icon to open the popup:

- **Sledování aktivní** toggle — globally enables/disables watching without
  clearing your host list.
- **Sledované adresy** — list of `hostname` or `hostname:port` entries (e.g.
  `localhost:4200`) the extension should be active on. Add/remove entries
  freely; changes apply on next page load/reload.

Settings are stored in `chrome.storage.local` under `watchingEnabled`
(boolean) and `watchedHosts` (array of strings). Default: watching enabled,
with `localhost:4200` pre-populated.

## Installation (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repository's folder.
4. Open the extension popup and confirm/add your dev server's
   `hostname:port` (e.g. `localhost:4200`) to the watched list.

## Manual testing

1. Open your dev server page (e.g. `http://localhost:4200`) that is listed in
   `watchedHosts`.
2. Open DevTools Console and simulate the error state:
   ```js
   document.getElementById("root").innerHTML =
     '<div style="z-index:0;position:relative;"><div>Layout not found</div></div>';
   ```
3. The page should reload automatically within a moment, and a green
   "Refreshed" toast should appear briefly in the bottom-right corner.
4. To verify the rate limit, repeat the console command again immediately
   after — it should not refresh a second time within 1.5 seconds (check the
   Console for a "Refresh skipped (rate limited)" log line).
5. To verify host filtering, remove the current host from `watchedHosts` in
   the popup, repeat step 2, and confirm no refresh happens.
6. To verify behavior across SPA client-side navigation, click between
   in-app routes a few times, then repeat step 2 on different routes — each
   should reload consistently, and the Console should show
   `[LayoutRefreshExtension]` logs for each detection/refresh/skip.
