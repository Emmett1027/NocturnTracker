// Vercel / serverless adapter — same normalization as server.js.
// Deploy: `vercel` or connect repo; /api/players works automatically.
const MINEHUT_API = process.env.MINEHUT_API || "https://api.minehut.com/server/NocturnMH?byName=true";
const MINEKEEP_API = process.env.MINEKEEP_API || "https://api.minekeep.net/v1/servers";
const MINEKEEP_NAME = (process.env.MINEKEEP_SERVER || "Nocturn").toLowerCase();
const MINEHUT_NAME = process.env.MINEHUT_SERVER || "NocturnMH";

async function fetchJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "NocturnPlayers/1.0", Accept: "application/json" } });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
  if (req.method === "OPTIONS") return res.status(204).end();

  let minehut = { online: false, players: null, maxPlayers: null, name: MINEHUT_NAME, unavailable: true };
  let minekeep = { online: false, players: null, maxPlayers: null, name: "Nocturn", unavailable: true };

  const [mh, mk] = await Promise.allSettled([fetchJson(MINEHUT_API), fetchJson(MINEKEEP_API)]);

  if (mh.status === "fulfilled" && mh.value?.server && typeof mh.value.server.playerCount === "number") {
    minehut = {
      online: mh.value.server.online !== false,
      players: mh.value.server.playerCount,
      maxPlayers: typeof mh.value.server.maxPlayers === "number" ? mh.value.server.maxPlayers : null,
      name: mh.value.server.name || MINEHUT_NAME
    };
  }
  if (mk.status === "fulfilled" && Array.isArray(mk.value?.servers)) {
    const match = mk.value.servers.find((s) => typeof s?.name === "string" && s.name.toLowerCase() === MINEKEEP_NAME);
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
  let total = null, partial = false;
  if (mhOk && mkOk) total = minehut.players + minekeep.players;
  else if (mhOk || mkOk) { total = mhOk ? minehut.players : minekeep.players; partial = true; }

  return res.status(200).json({
    minehut: mhOk ? minehut : { ...minehut, unavailable: true },
    minekeep: mkOk ? minekeep : { ...minekeep, unavailable: true },
    total, partial, complete: mhOk && mkOk,
    timestamp: new Date().toISOString()
  });
}
