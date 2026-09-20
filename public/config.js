// Central configuration — change values here instead of hunting through code.
// Plain classic script (no modules), loaded before app.js, so the page works
// straight from file:// as well as any static host. No backend needed.
const CONFIG = {
  brand: "Nocturn Tracker",
  siteTitle: "Nocturn Players",

  // How often the page re-fetches both server APIs (ms). 15–30s recommended.
  refreshInterval: 20000,

  // Default "notify me when N or more players are online" threshold.
  defaultAlertThreshold: 3,

  // Canonical server names.
  minehutServer: "NocturnMH",
  minekeepServer: "Nocturn",

  // Upstream APIs, called directly from the visitor's browser.
  // Both allow CORS (Access-Control-Allow-Origin: *).
  minehutApi: "https://api.minehut.com/server/NocturnMH?byName=true",
  minekeepApi: "https://api.minekeep.net/v1/servers",

  // localStorage keys for alert prefs.
  storageKeys: {
    threshold: "nocturn.alertThreshold",
    notifyEnabled: "nocturn.notifyEnabled",
    wasAbove: "nocturn.wasAboveThreshold"
  },

  // Links — fill in later as needed.
  links: {
    discord: "#",
    map: "#",
    vote: "#"
  }
};
