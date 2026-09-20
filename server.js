// Lightweight backend: serves /public statically + exposes GET /api/players.
// No dependencies — Node 18+ built-in http + fetch only.
// Architecture: Browser -> /api/players -> Minehut + MineKeep -> normalized JSON -> UI.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MINEHUT_API = process.env.MINEHUT_API || "https://api.minehut.com/server/NocturnMH?byName=true";
const MINEKEEP_API = process.env.MINEKEEP_API || "https://api.minekeep.net/v1/servers";
const MINEHUT_NAME = process.env.MINEHUT_SERVER || "NocturnMH";
const MINEKEEP_NAME = (process.env.MINEKEEP_SERVER || "Nocturn").toLowerCase();

// Short server-side cache so rapid refreshes / multiple visitors don't hammer upstreams.
const CACHE_TTL_MS = 10_000;
let cache = { at: 0, payload: null };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "NocturnPlayers/1.0", Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getMinehut() {
  try {
    const data = await fetchWithTimeout(MINEHUT_API);
    const s = data?.server;
    if (!s || typeof s.playerCount !== "number") throw new Error("Unexpected Minehut shape");
    return {
      online: s.online !== false,
      players: s.playerCount,
      maxPlayers: typeof s.maxPlayers === "number" ? s.maxPlayers : null,
      name: s.name || MINEHUT_NAME
    };
  } catch {
    return { online: false, players: null, maxPlayers: null, name: MINEHUT_NAME, unavailable: true };
  }
}

async function getMinekeep() {
  try {
    const data = await fetchWithTimeout(MINEKEEP_API);
    const list = Array.isArray(data?.servers) ? data.servers : null;
    if (!list) throw new Error("Unexpected MineKeep shape");
    // Never rely on array position — exact case-insensitive name match.
    const match = list.find((s) => typeof s?.name === "string" && s.name.toLowerCase() === MINEKEEP_NAME);
    if (!match) return { online: false, players: null, maxPlayers: null, name: "Nocturn", unavailable: true };
    const online = match?.players?.online;
    if (typeof online !== "number") throw new Error("Unexpected MineKeep players shape");
    return {
      online: true,
      players: online,
      maxPlayers: typeof match.players?.max === "number" ? match.players.max : null,
      name: match.name
    };
  } catch {
    return { online: false, players: null, maxPlayers: null, name: "Nocturn", unavailable: true };
  }
}

export async function buildPayload() {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_TTL_MS) return cache.payload;
  const [minehut, minekeep] = await Promise.all([getMinehut(), getMinekeep()]);
  const mhOk = !minehut.unavailable && typeof minehut.players === "number";
  const mkOk = !minekeep.unavailable && typeof minekeep.players === "number";
  let total = null;
  let partial = false;
  if (mhOk && mkOk) total = minehut.players + minekeep.players;
  else if (mhOk || mkOk) {
    total = mhOk ? minehut.players : minekeep.players;
    partial = true;
  }
  const payload = {
    minehut: { online: mhOk ? minehut.online : false, players: mhOk ? minehut.players : null, maxPlayers: minehut.maxPlayers ?? null, ...(mhOk ? {} : { unavailable: true }) },
    minekeep: { online: mkOk ? minekeep.online : false, players: mkOk ? minekeep.players : null, maxPlayers: minekeep.maxPlayers ?? null, ...(mkOk ? {} : { unavailable: true }) },
    total,
    partial,
    complete: mhOk && mkOk,
    timestamp: new Date().toISOString()
  };
  cache = { at: now, payload };
  return payload;
}

function serveStatic(req, res) {
  let urlPath = new URL(req.url, "http://x").pathname;
  if (urlPath === "/") urlPath = "/index.html";
  // Block path traversal.
  const filePath = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(urlPath)));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA-ish fallback for unknown non-api routes -> index.
      if (!urlPath.startsWith("/api/")) {
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, data) => {
          if (e2) { res.writeHead(404).end("Not found"); return; }
          res.writeHead(200, { "Content-Type": MIME[".html"] }).end(data);
        });
        return;
      }
      res.writeHead(404).end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS: same-origin by default; allow GET from anywhere for embed flexibility.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  const pathname = new URL(req.url, "http://x").pathname;
  if (pathname === "/api/players" && req.method === "GET") {
    try {
      const payload = await buildPayload();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(payload));
    } catch {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Upstream unavailable", total: null, timestamp: new Date().toISOString() }));
    }
    return;
  }
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Nocturn Players running at http://localhost:${PORT}`);
});
