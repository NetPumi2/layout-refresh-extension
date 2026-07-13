(() => {
  const ERROR_TEXT = "Layout not found";
  const REFRESH_FLAG_KEY = "justRefreshedByExtension";
  const LAST_REFRESH_KEY = "lastRefreshTimestamp";
  const RATE_LIMIT_MS = 1500;
  const FLAG_FRESHNESS_MS = 5000;
  const TOAST_ID = "layout-refresh-extension-toast";
  const TOAST_DURATION_MS = 3000;
  const SPA_NAV_RECHECK_DELAY_MS = 250;
  const DEBUG = true;
  const LOG_PREFIX = "[LayoutRefreshExtension]";

  function log(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }

  // Watched entries are matched against the domain:port only (window.location.host),
  // never against the full URL or path — this is intentional so that one watched
  // entry (e.g. "localhost:4200") applies to every route/sub-page on that host
  // ("/full-page-layout", "/form-onboarding", ...), not just the root path.
  function normalizeHostEntry(value) {
    let normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "";
    normalized = normalized.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // strip "http://", "https://", ...
    normalized = normalized.split(/[/?#]/)[0]; // strip any trailing path, query, hash, or slash
    return normalized;
  }

  function currentHostMatches(watchedHosts) {
    const currentHost = window.location.host.toLowerCase(); // "hostname:port", no path
    const currentHostname = window.location.hostname.toLowerCase(); // "hostname" only, any port
    return watchedHosts.some((entry) => {
      const normalized = normalizeHostEntry(entry);
      if (!normalized) return false;
      return normalized === currentHost || normalized === currentHostname;
    });
  }

  function showToast(message) {
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "layout-refresh-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("layout-refresh-toast--visible");
    });

    setTimeout(() => {
      toast.remove();
    }, TOAST_DURATION_MS);
  }

  function checkAndShowRefreshToast() {
    chrome.storage.local.get([REFRESH_FLAG_KEY], (result) => {
      const flag = result[REFRESH_FLAG_KEY];
      if (flag && typeof flag.timestamp === "number") {
        const age = Date.now() - flag.timestamp;
        if (age >= 0 && age < FLAG_FRESHNESS_MS) {
          log(`Showing post-refresh toast (flag age ${age}ms).`);
          showToast("Refreshed");
        } else {
          log(`Found stale justRefreshedByExtension flag (age ${age}ms), ignoring.`);
        }
        chrome.storage.local.remove(REFRESH_FLAG_KEY);
      }
    });
  }

  function pageContainsError() {
    return !!document.body && document.body.innerText.includes(ERROR_TEXT);
  }

  function triggerRefresh(source) {
    chrome.storage.local.get([LAST_REFRESH_KEY], (result) => {
      const lastRefresh = result[LAST_REFRESH_KEY] || 0;
      const now = Date.now();
      const elapsed = now - lastRefresh;

      if (elapsed < RATE_LIMIT_MS) {
        log(
          `Refresh skipped (rate limited): source="${source}", only ${elapsed}ms since last refresh (limit ${RATE_LIMIT_MS}ms). Still watching.`
        );
        return;
      }

      log(`Refresh triggered: source="${source}", ${elapsed}ms since last refresh.`);
      chrome.storage.local.set(
        {
          [LAST_REFRESH_KEY]: now,
          [REFRESH_FLAG_KEY]: { timestamp: now },
        },
        () => {
          window.location.reload();
        }
      );
    });
  }

  // Observe document.body rather than a specific #root node: some SPA route
  // changes replace the #root element itself (not just its children), which
  // would leave a MutationObserver attached to a detached, dead node. body is
  // effectively never replaced wholesale, so the observer keeps working across
  // client-side navigation.
  function startWatching() {
    const target = document.body || document.documentElement;
    if (!target) {
      log("startWatching: no document.body/documentElement available, aborting.");
      return;
    }

    const observer = new MutationObserver(() => {
      if (pageContainsError()) {
        log('MutationObserver detected "Layout not found".');
        triggerRefresh("mutation-observer");
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    log("MutationObserver attached to document.body.");

    if (pageContainsError()) {
      log('Initial check found "Layout not found" already present on load.');
      triggerRefresh("initial-check");
    }
  }

  // Redundant, MutationObserver-independent safety net: Angular's router (and
  // SPA routers in general) drive navigation through pushState/replaceState,
  // optionally followed by popstate on back/forward. Re-checking shortly after
  // any of these fires catches cases where the DOM mutation sequence around a
  // route change is missed or coalesced in a way the observer doesn't see.
  function scheduleSpaNavRecheck(source) {
    setTimeout(() => {
      log(`SPA navigation recheck ("${source}") running after ${SPA_NAV_RECHECK_DELAY_MS}ms delay.`);
      if (pageContainsError()) {
        log(`SPA navigation recheck ("${source}") detected "Layout not found".`);
        triggerRefresh(`spa-nav:${source}`);
      }
    }, SPA_NAV_RECHECK_DELAY_MS);
  }

  function installSpaNavigationWatchers() {
    window.addEventListener("popstate", () => scheduleSpaNavRecheck("popstate"));

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      scheduleSpaNavRecheck("pushState");
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      scheduleSpaNavRecheck("replaceState");
      return result;
    };

    log("Installed popstate/pushState/replaceState navigation watchers.");
  }

  function init() {
    checkAndShowRefreshToast();

    chrome.storage.local.get(
      { watchingEnabled: true, watchedHosts: [] },
      (settings) => {
        if (!settings.watchingEnabled) {
          log("Watching disabled (watchingEnabled=false).");
          return;
        }
        if (!currentHostMatches(settings.watchedHosts)) {
          log(
            `Host "${window.location.host}" not in watchedHosts, extension inactive on this page.`,
            settings.watchedHosts
          );
          return;
        }
        log(`Host "${window.location.host}" matched watchedHosts, activating.`);
        startWatching();
        installSpaNavigationWatchers();
      }
    );
  }

  init();
})();
