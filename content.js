(() => {
  const ERROR_TEXT = "Layout not found";
  const REFRESH_FLAG_KEY = "justRefreshedByExtension";
  const LAST_REFRESH_KEY = "lastRefreshTimestamp";
  const RATE_LIMIT_MS = 3000;
  const FLAG_FRESHNESS_MS = 5000;
  const TOAST_ID = "layout-refresh-extension-toast";
  const TOAST_DURATION_MS = 3000;

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
          showToast("Stránka obnovena: Layout not found");
        }
        chrome.storage.local.remove(REFRESH_FLAG_KEY);
      }
    });
  }

  function pageContainsError() {
    return !!document.body && document.body.innerText.includes(ERROR_TEXT);
  }

  function triggerRefresh(observer) {
    chrome.storage.local.get([LAST_REFRESH_KEY], (result) => {
      const lastRefresh = result[LAST_REFRESH_KEY] || 0;
      const now = Date.now();
      if (now - lastRefresh < RATE_LIMIT_MS) {
        return;
      }
      if (observer) observer.disconnect();
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

  function startWatching() {
    const target = document.getElementById("root") || document.body;
    if (!target) return;

    const observer = new MutationObserver(() => {
      if (pageContainsError()) {
        triggerRefresh(observer);
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    if (pageContainsError()) {
      triggerRefresh(observer);
    }
  }

  function init() {
    checkAndShowRefreshToast();

    chrome.storage.local.get(
      { watchingEnabled: true, watchedHosts: [] },
      (settings) => {
        if (!settings.watchingEnabled) return;
        if (!currentHostMatches(settings.watchedHosts)) return;
        startWatching();
      }
    );
  }

  init();
})();
