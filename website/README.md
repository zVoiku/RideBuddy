# ridebuddy.co.in

Two things live here:

| URL | What | Source |
|---|---|---|
| `/` | Holding page — "RideBuddy — Coming soon" | `src/index.html` |
| `/beta/` | The design-canvas artboard, shared by link | `../Webpage`, assembled by `build.mjs` |

From the repo root, `npm run build` installs this folder's dependencies and
writes `website/dist` — the directory Cloudflare uploads.
`npm run preview` (from here) builds and serves it on :8099.

## `../Webpage` is the source of truth

The artboard is authored in Claude Design and committed to `Webpage/`. **Never
edit the copy under `dist/`** — it is regenerated on every build. Re-export the
canvas into `Webpage/` and rebuild.

`build.mjs` fixes four things that matter in production and would otherwise
make the artboard a poor public page:

1. **`RideBuddy Website.dc.html` → `beta/index.html`.** The filename has a space
   in it; `/beta/` needs an index.
2. **Runtime CDN dependency removed.** `support.js` fetches React, ReactDOM and
   `@babel/standalone` from `unpkg.com` on load — the page renders *blank* if
   unpkg is unreachable. They are vendored from `node_modules` and the URLs
   rewritten to relative paths. The build fails loudly if those URLs ever change.
3. **Images re-encoded to WebP.** The three hero PNGs are 4.85 MB; at quality 82
   they are 374 KB with no visible difference. Most of our traffic is Indian
   mobile. References are rewritten `.png` → `.webp`.
4. **`noindex` injected into the beta page.** `src/_headers` also sends
   `X-Robots-Tag`, but Pages and Workers static assets do not honour that file
   identically — the meta tag works on both.

Net effect: first load drops from roughly 8 MB to under 0.3 MB, and the only
remaining third-party request is Google Fonts.

## Deploying (Cloudflare Workers Builds)

The Worker is static-assets-only — no server code. `wrangler.jsonc` lives at the
**repository root** because Workers Builds runs from there, and points at
`./website/dist`.

Dashboard settings:

| Field | Value |
|---|---|
| Repository | `zVoiku/RideBuddy` |
| Project name | `ridebuddy` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

Then add `ridebuddy.co.in` and `www.ridebuddy.co.in` as custom domains.

Validate config changes locally with `npx wrangler deploy --dry-run`, which
reports how many asset files it found without needing credentials.

## Known limitations of the beta

Deliberate, and the reason `/beta/` is served `noindex`:

- **Nothing is server-rendered.** The artboard is compiled in the browser by
  Babel, so `<body>` is empty until JS runs — no SEO, and a blank page with JS
  off. Fine for a link-shared preview; not fine for the production site.
- **The waitlist captures nothing.** There is no form target anywhere in the
  artboard; the only contact route is `mailto:support@ridebuddy.co.in`.
- **`.image-slots.state.json` 404s** in the console. It is an authoring-tool
  probe from `image-slot.js` and is harmless.
- App-store badges exist in the artboard but are gated behind its `phase` prop,
  which defaults to `1` (waitlist). Verified: zero badges render. Do not set
  `phase=2` until the apps are actually published.

The production site is a separate build — see `docs/hosting.md`.
