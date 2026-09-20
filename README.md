# Nocturn Players

Live combined player count for the Nocturn Minecraft network across **Minehut** (`NocturnMH`) and **MineKeep** (`Nocturn`).

Zero dependencies. Plain HTML + CSS + JS frontend, Node built-in `http` backend. Fast, mobile-responsive, accessible.

## Run locally

```bash
npm install   # no dependencies — just verifies your Node setup
npm run dev   # serves http://localhost:3000
```

Requires Node 18+ (uses native `fetch`).

## How it works

```
Browser → GET /api/players → Minehut API + MineKeep API → normalized JSON → UI
```

`GET /api/players` returns:

```json
{
  "minehut": { "online": true, "players": 2, "maxPlayers": 10 },
  "minekeep": { "online": true, "players": 4, "maxPlayers": null },
  "total": 6,
  "partial": false,
  "complete": true,
  "timestamp": "..."
}
```

- Minehut count comes from `server.playerCount`.
- MineKeep count comes from the server whose name matches `Nocturn` case-insensitively (never by array position). If not found → `unavailable`, not another server's count.
- `total = minehut + minekeep` only when both are known. One provider down → `partial: true`, UI shows `6+` with a note. Both down → `total: null`, UI shows "temporarily unavailable" instead of pretending the server is empty.
- Frontend refreshes every `refreshInterval` (default 20s) and shows "Updated Xs ago". Only numbers update — no page flash.

## Configuration

All tunables live in `public/config.js`:

```js
refreshInterval       // ms between /api/players fetches
defaultAlertThreshold // default "notify me at N players" (3)
minehutServer / minekeepServer
playersEndpoint       // "/api/players"
links                 // discord / map / vote placeholders
```

Upstream URLs / names can also be overridden server-side via env:

```
PORT=3000  MINEHUT_API=…  MINEKEEP_API=…  MINEHUT_SERVER=…  MINEKEEP_SERVER=…
```

## Background image

Drop your art at:

```
public/assets/nocturn-background.jpg
```

That's it — the hero picks it up automatically with a readability overlay. No image? A night-gradient fallback shows instead.

## Adding the ~9–10 future features

The `#featureGrid` in `public/index.html` is a responsive grid (3 cols desktop → 2 tablet → 1 mobile) built for ~12 cards. To add one, copy this:

```html
<a class="feature-card" href="/your-page">
  <h3>Title</h3>
  <p>One-line description.</p>
  <span class="feature-link">Open →</span>
</a>
```

No layout changes needed. See the commented example in `index.html`.

## Player alerts

Settings live in the "Player alert" card and persist in `localStorage` (`nocturn.alertThreshold`, `nocturn.notifyEnabled`). Notifications:

- apply to the **combined** total,
- are requested only when the user clicks Enable,
- fire only when crossing from below to at/above the threshold (never every refresh).

## Deploy

- **Any Node host:** `npm start` (uses `$PORT`).
- **Vercel:** included `api/players.js` serverless function + `vercel.json` work with `vercel` out of the box.
