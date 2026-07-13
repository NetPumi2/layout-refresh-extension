(() => {
  const DEFAULT_HOSTS = ["localhost:4200"];

  const watchingEnabledInput = document.getElementById("watchingEnabled");
  const watchingLabel = document.getElementById("watchingLabel");
  const hostList = document.getElementById("hostList");
  const hostInput = document.getElementById("hostInput");
  const addHostBtn = document.getElementById("addHostBtn");

  function renderHosts(hosts) {
    hostList.innerHTML = "";

    if (hosts.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-hint";
      empty.textContent = "Žádné sledované adresy.";
      hostList.appendChild(empty);
      return;
    }

    hosts.forEach((host) => {
      const item = document.createElement("li");

      const label = document.createElement("span");
      label.textContent = host;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Smazat";
      removeBtn.addEventListener("click", () => removeHost(host));

      item.appendChild(label);
      item.appendChild(removeBtn);
      hostList.appendChild(item);
    });
  }

  function updateWatchingLabel(enabled) {
    watchingLabel.textContent = `Sledování aktivní: ${enabled ? "zapnuto" : "vypnuto"}`;
  }

  function loadSettings() {
    chrome.storage.local.get(
      { watchingEnabled: true, watchedHosts: DEFAULT_HOSTS },
      (settings) => {
        watchingEnabledInput.checked = settings.watchingEnabled;
        updateWatchingLabel(settings.watchingEnabled);
        renderHosts(settings.watchedHosts);
      }
    );
  }

  function addHost() {
    const value = hostInput.value.trim();
    if (!value) return;

    chrome.storage.local.get({ watchedHosts: DEFAULT_HOSTS }, (settings) => {
      const hosts = settings.watchedHosts;
      if (hosts.some((h) => h.toLowerCase() === value.toLowerCase())) {
        hostInput.value = "";
        return;
      }
      const updated = [...hosts, value];
      chrome.storage.local.set({ watchedHosts: updated }, () => {
        hostInput.value = "";
        renderHosts(updated);
      });
    });
  }

  function removeHost(host) {
    chrome.storage.local.get({ watchedHosts: DEFAULT_HOSTS }, (settings) => {
      const updated = settings.watchedHosts.filter((h) => h !== host);
      chrome.storage.local.set({ watchedHosts: updated }, () => {
        renderHosts(updated);
      });
    });
  }

  watchingEnabledInput.addEventListener("change", () => {
    const enabled = watchingEnabledInput.checked;
    updateWatchingLabel(enabled);
    chrome.storage.local.set({ watchingEnabled: enabled });
  });

  addHostBtn.addEventListener("click", addHost);
  hostInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addHost();
    }
  });

  loadSettings();
})();
