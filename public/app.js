/* CONFIG is defined in config.js, loaded as a classic script before this one.
   No modules, no backend — the page works from file:// or any static host. */

const $ = (id) => document.getElementById(id);

const els = {
  totalNumber: $("totalNumber"),
  totalLabel: $("totalLabel"),
  totalSub: $("totalSub"),
  mhWrap: $("mhWrap"),
  mhMeta: $("mhMeta"),
  mkWrap: $("mkWrap"),
  mkMeta: $("mkMeta"),
  totalWrap: $("totalWrap"),
  totalCardMeta: $("totalCardMeta"),
  liveLabel: $("liveLabel"),
  updatedAgo: $("updatedAgo"),
  headerDot: $("headerDot"),
  heroDot: $("heroDot"),
  headerStatusText: $("headerStatusText"),
  refreshBtn: $("refreshBtn"),
  refreshSpinner: $("refreshSpinner"),
  thresholdInput: $("thresholdInput"),
  notifyBtn: $("notifyBtn"),
  testBtn: $("testBtn"),
  alertStatus: $("alertStatus"),
  notifySupport: $("notifySupport"),
  alertForm: $("alertForm"),
  year: $("year")
};

els.year.textContent = String(new Date().getFullYear());

const memoryStore = {};
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch { return key in memoryStore ? memoryStore[key] : null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch { memoryStore[key] = value; }
}

const store = {
  get threshold() {
    const n = Number.parseInt(lsGet(CONFIG.storageKeys.threshold) ?? "", 10);
    return Number.isFinite(n) && n >= 1 ? n : CONFIG.defaultAlertThreshold;
  },
  set threshold(v) { lsSet(CONFIG.storageKeys.threshold, String(v)); },
  get notifyEnabled() { return lsGet(CONFIG.storageKeys.notifyEnabled) === "1"; },
  set notifyEnabled(v) { lsSet(CONFIG.storageKeys.notifyEnabled, v ? "1" : "0"); },
  get wasAbove() { return lsGet(CONFIG.storageKeys.wasAbove) === "1"; },
  set wasAbove(v) { lsSet(CONFIG.storageKeys.wasAbove, v ? "1" : "0"); }
};

els.thresholdInput.value = String(store.threshold);

let lastSuccessAt = null;
let fetching = false;

function plural(n) { return n === 1 ? "player" : "players"; }

function setDot(state) {
  // state: live | partial | down | connecting
  for (const dot of [els.headerDot, els.heroDot]) {
    dot.classList.remove("is-live", "is-partial", "is-down");
    if (state === "live") dot.classList.add("is-live");
    else if (state === "partial") dot.classList.add("is-partial");
    else if (state === "down") dot.classList.add("is-down");
  }
}

// Stable wrapper: never null, so any state can always transition to any other.
function setCount(wrapEl, value, unitText, unavailable) {
  wrapEl.classList.toggle("is-unavailable", unavailable === true);
  wrapEl.innerHTML = "";
  const num = document.createElement("span");
  num.textContent = value;
  wrapEl.append(num);
  if (unitText) {
    const unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = unitText;
    wrapEl.append(document.createTextNode(" "), unit);
  }
}

function renderProviderCard(wrapEl, metaEl, data, maxLabel) {
  if (!data || data.unavailable || typeof data.players !== "number") {
    setCount(wrapEl, "Unavailable", null, true);
    metaEl.textContent = "Couldn't reach this provider";
    return;
  }
  const max = typeof data.maxPlayers === "number" ? ` / ${data.maxPlayers} max` : "";
  setCount(wrapEl, String(data.players), " players", false);
  metaEl.textContent = data.online === false ? `Offline${max} ${maxLabel}` : `${maxLabel}${max}`;
}

function render(data) {
  const { minehut: mh, minekeep: mk, total, partial, complete } = data;

  renderProviderCard(els.mhWrap, els.mhMeta, mh, "Minehut");
  renderProviderCard(els.mkWrap, els.mkMeta, mk, "MineKeep");

  els.totalNumber.classList.toggle("is-partial", partial === true && total !== null);

  if (total === null || total === undefined) {
    els.totalNumber.textContent = "—";
    els.totalLabel.textContent = "Players online";
    els.totalSub.textContent = "Player count temporarily unavailable — both providers are unreachable.";
    setCount(els.totalWrap, "Unavailable", null, true);
    els.totalCardMeta.textContent = "Waiting for Minehut + MineKeep";
    els.liveLabel.textContent = "Offline";
    els.headerStatusText.textContent = "Offline";
    setDot("down");
  } else if (partial) {
    els.totalNumber.textContent = String(total);
    els.totalLabel.textContent = `${plural(total)} online`;
    const missing = mh?.unavailable ? "Minehut" : "MineKeep";
    els.totalSub.textContent = `${missing} is unreachable — showing a partial total from the other server.`;
    setCount(els.totalWrap, String(total), " players+", false);
    els.totalCardMeta.textContent = `Partial — ${missing} unavailable`;
    els.liveLabel.textContent = "Partially live";
    els.headerStatusText.textContent = `${total}+ online (partial)`;
    setDot("partial");
  } else {
    els.totalNumber.textContent = String(total);
    els.totalLabel.textContent = `${plural(total)} online`;
    els.totalSub.textContent = complete
      ? `Across Minehut + MineKeep · ${mh.players} + ${mk.players}`
      : `Combined Minehut + MineKeep total`;
    setCount(els.totalWrap, String(total), " players", false);
    els.totalCardMeta.textContent = "Minehut + MineKeep combined";
    els.liveLabel.textContent = "Live";
    els.headerStatusText.textContent = total === 0 ? "Live · empty" : `${total} online`;
    setDot("live");
  }

  maybeNotify(total);
}

// ---------- Live data: direct browser calls, no backend ----------
// Both upstream APIs allow CORS, so the page fetches them straight from
// the visitor's browser. Same rules as before: Minehut count from
// server.playerCount; MineKeep count from the server named "Nocturn"
// (case-insensitive, never by array position); failures stay
// `unavailable` and are never silently treated as zero.
async function fetchJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchPayload() {
  const [mh, mk] = await Promise.allSettled([
    fetchJson(CONFIG.minehutApi),
    fetchJson(CONFIG.minekeepApi)
  ]);

  let minehut = { online: false, players: null, maxPlayers: null, name: CONFIG.minehutServer, unavailable: true };
  let minekeep = { online: false, players: null, maxPlayers: null, name: CONFIG.minekeepServer, unavailable: true };

  if (mh.status === "fulfilled" && mh.value?.server && typeof mh.value.server.playerCount === "number") {
    minehut = {
      online: mh.value.server.online !== false,
      players: mh.value.server.playerCount,
      maxPlayers: typeof mh.value.server.maxPlayers === "number" ? mh.value.server.maxPlayers : null,
      name: mh.value.server.name || CONFIG.minehutServer
    };
  }
  if (mk.status === "fulfilled" && Array.isArray(mk.value?.servers)) {
    const want = CONFIG.minekeepServer.toLowerCase();
    const match = mk.value.servers.find((s) => typeof s?.name === "string" && s.name.toLowerCase() === want);
    if (match && typeof match.players?.online === "number") {
      minekeep = {
        online: true,
        players: match.players.online,
        maxPlayers: typeof match.players?.max === "number" ? match.players.max : null,
        name: match.name
      };
    }
  }

  const mhOk = typeof minehut.players === "number";
  const mkOk = typeof minekeep.players === "number";
  let total = null;
  let partial = false;
  if (mhOk && mkOk) total = minehut.players + minekeep.players;
  else if (mhOk || mkOk) {
    total = mhOk ? minehut.players : minekeep.players;
    partial = true;
  }
  return {
    minehut: mhOk ? minehut : { ...minehut, unavailable: true },
    minekeep: mkOk ? minekeep : { ...minekeep, unavailable: true },
    total, partial, complete: mhOk && mkOk,
    timestamp: new Date().toISOString()
  };
}

async function load({ manual = false } = {}) {
  if (fetching) return;
  fetching = true;
  els.refreshSpinner.classList.add("is-loading");
  els.refreshBtn.disabled = manual;
  try {
    // No backend: the browser calls the Minehut + MineKeep APIs directly.
    // Both allow CORS (Access-Control-Allow-Origin: *).
    const data = await fetchPayload();
    lastSuccessAt = Date.now();
    render(data);
  } catch {
    // Keep last good numbers on screen; only flip status to indicate staleness.
    if (lastSuccessAt === null) {
      render({ minehut: { unavailable: true }, minekeep: { unavailable: true }, total: null });
    } else {
      els.liveLabel.textContent = "Reconnecting";
      els.headerStatusText.textContent = "Reconnecting";
      setDot("partial");
    }
  } finally {
    fetching = false;
    els.refreshSpinner.classList.remove("is-loading");
    els.refreshBtn.disabled = false;
  }
}

function tickAgo() {
  if (!lastSuccessAt) { els.updatedAgo.textContent = "Updated just now"; return; }
  const s = Math.max(0, Math.round((Date.now() - lastSuccessAt) / 1000));
  els.updatedAgo.textContent = s < 3 ? "Updated just now" : `Updated ${s}s ago`;
}

// ---------- Player alert / notifications ----------
function notificationsSupported() {
  return "Notification" in window;
}

function refreshAlertUI() {
  const t = store.threshold;
  if (!notificationsSupported()) {
    els.notifyBtn.disabled = true;
    els.testBtn.disabled = true;
    els.notifySupport.textContent = "This browser doesn't support notifications — your threshold is still saved for the on-page status.";
  } else if (Notification.permission === "denied") {
    els.notifySupport.textContent = "Notifications are blocked in your browser settings for this site.";
  } else {
    els.notifySupport.textContent = "";
  }

  const enabled = store.notifyEnabled && notificationsSupported() && Notification.permission === "granted";
  els.notifyBtn.textContent = enabled ? "Disable notifications" : "Enable notifications";
  els.alertStatus.innerHTML = enabled
    ? `<strong>Notifications enabled.</strong> We'll ping you when ${t} or more ${plural(t)} are online.`
    : `Notifications off. We'll watch for <strong>${t} or more ${plural(t)}</strong> once enabled.`;
}

function maybeNotify(total) {
  const threshold = store.threshold;
  if (typeof total !== "number") return;
  const above = total >= threshold;
  const wasAbove = store.wasAbove;
  store.wasAbove = above;
  // Only notify on crossing below -> at/above, never on every refresh.
  if (above && !wasAbove && store.notifyEnabled && notificationsSupported() && Notification.permission === "granted") {
    try {
      new Notification("Nocturn has players online!", {
        body: `${total} ${plural(total)} currently playing across Minehut + MineKeep.`,
        tag: "nocturn-players"
      });
    } catch { /* Notification constructor can throw in some contexts — ignore */ }
  }
}

els.thresholdInput.addEventListener("change", () => {
  const n = Number.parseInt(els.thresholdInput.value, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 999) {
    store.threshold = n;
    store.wasAbove = false; // re-arm crossing detection for the new threshold
  } else {
    els.thresholdInput.value = String(store.threshold);
  }
  refreshAlertUI();
});

els.notifyBtn.addEventListener("click", async () => {
  if (store.notifyEnabled) {
    store.notifyEnabled = false;
    refreshAlertUI();
    return;
  }
  // Ask for permission only when the user enables the feature.
  if (!notificationsSupported()) { refreshAlertUI(); return; }
  let perm = Notification.permission;
  if (perm === "default") {
    try { perm = await Notification.requestPermission(); } catch { perm = "denied"; }
  }
  if (perm === "granted") {
    store.notifyEnabled = true;
    store.wasAbove = false;
  }
  refreshAlertUI();
});

els.testBtn.addEventListener("click", () => {
  if (notificationsSupported() && Notification.permission === "granted") {
    try {
      new Notification("Nocturn test ping", { body: "Notifications are working. We'll ping you at your threshold.", tag: "nocturn-test" });
    } catch { /* ignore */ }
  } else {
    els.alertStatus.textContent = "Enable notifications first, then send a test ping.";
  }
});

els.alertForm.addEventListener("submit", (e) => e.preventDefault());
els.refreshBtn.addEventListener("click", () => load({ manual: true }));

// ---------- Boot ----------
refreshAlertUI();
load();
setInterval(load, CONFIG.refreshInterval);
setInterval(tickAgo, 1000);
tickAgo();
