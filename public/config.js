// Central configuration — change values here instead of hunting through code.
export const CONFIG = {
  brand: "Nocturn",
  siteTitle: "Nocturn Players",

  // How often the frontend re-fetches /api/players (ms). 15–30s recommended.
  refreshInterval: 20000,

  // Default "notify me when N or more players are online" threshold.
  defaultAlertThreshold: 3,

  // Canonical server names.
  minehutServer: "NocturnMH",
  minekeepServer: "Nocturn",

  // Upstream APIs (used server-side only; frontend talks to /api/players).
  minehutApi: "https://api.minehut.com/server/NocturnMH?byName=true",
  minekeepApi: "https://api.minekeep.net/v1/servers",

  // Internal normalized endpoint.
  playersEndpoint: "/api/players",

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
