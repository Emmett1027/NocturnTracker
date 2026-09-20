# Nocturn Tracker

An unofficial live viewer for the combined player count of the Nocturn Minecraft network across **Minehut** (`NocturnMH`) and **MineKeep** (`Nocturn`).

Not affiliated with Nocturn — just a thing to view Nocturn players.

Zero dependencies, zero build step, zero backend. Plain HTML + CSS + JS. Fast, mobile-responsive, accessible.

## View it — no server needed

Just open `public/index.html` in any browser (double-click it). That's the whole setup.

Your browser calls the Minehut + MineKeep APIs directly — both allow it (`Access-Control-Allow-Origin: *`).

## Publish it (GitHub Pages)

1. Create a repo on GitHub (public), without adding a README.
2. Push this folder:
   ```
   git remote add origin https://github.com/YOUR-USERNAME/NocturnPlayers.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Every push to `main` redeploys. Site appears at `https://YOUR-USERNAME.github.io/NocturnPlayers/`.

(Any static host works — Netlify Drop, itch.io, plain web space. Upload the contents of `public/`.)

## How it works

```
Browser → Minehut API + MineKeep API (direct, in parallel) → normalize → UI
```

- Minehut count comes from `server.playerCount`.
- MineKeep count comes from the server whose name matches `Nocturn` case-insensitively (never by array position). If not found → `unavailable`, not another server's count.
- `total = minehut + minekeep` only when both are known. One provider down → partial total shown as `6+` with a note. Both down → `total: null`, UI shows "temporarily unavailable" instead of pretending the server is empty.
- The page refreshes every `refreshInterval` (default 20s) and shows "Updated Xs ago". Only the numbers update — no page flash.

## Configuration

All tunables live in `public/config.js`:

```js
refreshInterval       // ms between refreshes
defaultAlertThreshold // default "notify me at N players" (3)
minehutServer / minekeepServer
minehutApi / minekeepApi
links                 // discord / map / vote placeholders
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
<a class="feature-card" href="./your-page">
  <h3>Title</h3>
  <p>One-line description.</p>
  <span class="feature-link">Open →</span>
</a>
```

No layout changes needed. See the commented example in `index.html`.

## Player alerts

Settings live in the "Player alert" card and persist in `localStorage`. Notifications:

- apply to the **combined** total,
- are requested only when the user clicks Enable,
- fire only when crossing from below to at/above the threshold (never every refresh).
