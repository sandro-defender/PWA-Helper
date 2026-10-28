# AGENTS.md — AI integration guide

This file is written for an AI coding agent that has to move this PWA kit into
another web project. Follow it in order. It describes **what exists**, **where it
goes**, **what must not be renamed**, and **how to prove the integration works**.

The kit is a self-hosted, dependency-free replacement for the hosted Progressier
client. It is plain ES5/ES2017 JavaScript, one stylesheet, one manifest, one
service worker, and static icons. There is no build step and no package install.

Current kit version: **1.0.4** (`PWA.version` and `VERSION` in
`progressier.js`).

---

## 1. Runtime model

Four files do all the work at runtime:

```
<head>
  <link rel="manifest" href="/manifest.webmanifest">
  <script src="/pwa.js" defer></script>
        |
        |  injects /pwa.css and missing meta tags
        |  registers /progressier.js
        |  mounts buttons, banners, modals, QR
        v
  /pwa.js  --------------------------->  /progressier.js
  page-side client                       service worker
  UI + install + push + share            cache + push + share + badge
        |
        +--> /manifest.webmanifest   (install identity, icons, share target)
        +--> /qrcode.js              (optional, only when a QR is opened)
        +--> /offline.html/.css/.js  (offline fallback)
        +--> /icons/*                (manifest, banner and splash images)
```

`pwa.js` is the only script a page needs. It is safe to load with `defer`, and
it is idempotent: a second copy exits immediately (`window.PWA.__pwaKit`).

---

## 2. Non-negotiable rules

An agent must preserve these or the migration will break existing installs:

1. **Do not load the old Progressier script and `pwa.js` together.** Remove
   `https://progressier.app/<id>/script.js` and the hosted manifest link.
2. **Keep the service worker path at `/progressier.js` when migrating an
   existing site.** Browsers that already registered the hosted worker update it
   in place only if the script URL is unchanged.
3. **Keep the manifest `id` stable** for an existing app. For a brand-new app,
   choose a new stable id. Changing `id` creates a second installed app.
4. **Serve `progressier.js` from the site root**, or set `data-sw` and
   `data-sw-scope` to the real location. The worker resolves precache assets
   relative to its own directory (which is the root for the standard deployment).
   `offline.html` currently has root-absolute links, so rewrite those when serving
   the kit from a project subpath such as GitHub Pages.
5. **Do not rename `pwa.css` classes** listed in §6; they are the public styling
   and markup contract.
6. **Upload assets before changing HTML**, so the first page load never asks for
   a missing worker or manifest.
7. **HTTPS is required** for service workers, install prompts, and push.
   `localhost` is the only exception.

---

## 3. File map

| File | Required | Role |
| --- | --- | --- |
| `pwa.js` | yes | Client SDK: config, SW registration, install/push UI, floating toolbox, QR, banners, meta, splash |
| `pwa.css` | yes (unless `data-no-css`) | All component styles and Progressier CSS variables |
| `progressier.js` | yes | Service worker: offline cache, push display, share target, badge |
| `manifest.webmanifest` | yes | App identity, icons, share target, protocol handlers |
| `qrcode.js` | only for QR | Vendored MIT `qrcode-generator` 2.0.4 |
| `offline.html`, `offline.css`, `offline.js` | yes | Offline fallback page |
| `icons/icon-192.png`, `icon-512.png` | yes | Manifest icons |
| `icons/icon-maskable-192.png`, `icon-maskable-512.png` | yes | Maskable icons |
| `icons/apple-touch-icon.png` | recommended | iOS home-screen icon (180×180) |
| `icons/favicon-32.png`, `favicon.ico` | recommended | Browser favicon |
| `icons/icon-144.png`, `icon-150.png`, `browserconfig.xml` | optional | Windows tiles |
| `snippet.html` | reference | Copy-paste `<head>` block |
| `INTEGRATION.md` | reference | Deployment checklist for `staff.you.ge` |
| `README.md` | reference | Full API and server config |
| `PARITY.md` | reference | What matches the original Progressier client |
| `reference/` | research only | Original manifest/client source and readable copies; never deploy |
| `scripts/check.mjs` | tool | Static checker: syntax, manifest, icon sizes, version, leftovers |
| `scripts/verify-deployment.mjs` | tool | Live deployment checker |
| `scripts/generate-vapid-keys.mjs` | tool | VAPID key generator |
| `examples/push-server/` | example | Minimal Node push sender |
| `LICENSE`, `package.json` | repo | MIT license and `npm run check` / `verify` / `keys` scripts |
| `demo/` | example | Full-feature GitHub Pages playground for testing the helper |
| `example/` | example | Polished, user-facing sample integration and subpath-safe manifest |
| `.github/workflows/` | repo | `check.yml` static checks, `pages.yml` playground + example deploy |

Keep the directory shape when copying. If the target project uses a `public/`
folder (Next.js, Vite, CRA), copy the **contents** of this repo into `public/`
so the URLs stay root-relative.

---

## 4. Integration playbook

### Step 1 — copy the runtime files

Copy into the target web root:

```
pwa.js
pwa.css
progressier.js
manifest.webmanifest
qrcode.js
offline.html
offline.css
offline.js
browserconfig.xml
favicon.ico
icons/
```

Do not copy `.git`, `examples/`, `scripts/`, or the markdown docs unless the
target project wants them.

### Step 2 — adapt the manifest

Edit `manifest.webmanifest`:

| Field | What to do |
| --- | --- |
| `name`, `short_name` | Target app name |
| `id` | Keep the existing id when migrating; otherwise a new stable path such as `/` |
| `start_url` | Usually `/?launchedfrom=homescreen`; must be inside `scope` |
| `scope` | `/` for a root app, or the subpath the app is served from |
| `display` | `standalone` (default), `fullscreen`, or `minimal-ui` |
| `theme_color`, `background_color` | Match the target brand |
| `icons` | Replace the PNGs, keep 192/512 and both maskable entries |
| `share_target.action` | Must be `/share-target` (the worker handles that POST) |
| `protocol_handlers` | Keep if the app uses `web+pwa:` links; remove otherwise |
| `categories` | Optional |

The manifest is static. `pwa.js` only injects a link if the page has none and
replaces a link that still points at `progressier.app`.

### Step 3 — add the head block

Minimum:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#ffffff" />
<script src="/pwa.js" defer></script>
```

Recommended, with explicit configuration:

```html
<script
  src="/pwa.js"
  defer
  data-sw="/progressier.js"
  data-sw-scope="/"
  data-manifest="/manifest.webmanifest"
  data-app-name="My App"
  data-theme-color="#ffffff"
  data-icon="/icons/icon-192.png"
  data-splash-icon="/icons/icon-512.png"
  data-start-url="/?launchedfrom=homescreen"
></script>
```

`pwa.js` fills in `application-name`, Apple meta, Windows tile meta, the
manifest link if missing, and the iOS splash links. Do not duplicate those tags
unless you set `data-no-meta`.

### Step 4 — server headers

```
/manifest.webmanifest
  Content-Type: application/manifest+json

/progressier.js
  Content-Type: application/javascript
  Cache-Control: no-cache
  Service-Worker-Allowed: /
```

Serve `pwa.js`, `pwa.css`, `offline.*` and `qrcode.js` with `no-cache` or a
short max-age. The worker's own `VERSION` controls its caches; do not add a
long-lived immutable cache to `progressier.js`.

### Step 5 — optional push

Generate a VAPID pair:

```bash
node scripts/generate-vapid-keys.mjs --write
```

Then load the client with:

```html
<script
  src="/pwa.js"
  defer
  data-vapid-public-key="THE_PUBLIC_KEY"
  data-push-endpoint="/api/push/subscribe"
></script>
```

Server contract:

- `POST /api/push/subscribe` — body is the browser subscription JSON
  (`endpoint`, `keys.p256dh`, `keys.auth`). Return any `2xx`.
- `DELETE /api/push/subscribe` — body is `{ "endpoint": "..." }`.
- Sending is server-side; see `examples/push-server/server.js`.

Without both attributes, subscribe buttons remain visible but report that push
is not configured instead of asking for permission.

### Step 6 — Content Security Policy

| Need | CSP |
| --- | --- |
| Load `pwa.js` / worker | `script-src 'self'`; `worker-src 'self'` |
| Inline styles injected by install help | add `data-csp-nonce="..."` and allow that nonce in `style-src` |
| iOS splash images (generated `data:` PNGs) | allow `data:` in `img-src`, or set `data-no-splash` |
| `data-analytics` beacon | allow the endpoint in `connect-src` |
| QR library | `script-src 'self'` is enough; it is a local file |

### Step 7 — verify

Static checks:

```bash
node scripts/check.mjs      # or: npm run check
```

It verifies JS syntax, manifest JSON, real PNG sizes against the declared
`icons[].sizes`, precache assets, `VERSION` consistency between the worker and
`pwa.js`, and leftover hosted Progressier URLs.

Live checks:

```bash
node scripts/verify-deployment.mjs https://your-domain.example
```

It checks the HTML for leftover `progressier.app` tags, manifest MIME type,
real PNG dimensions, service-worker headers, offline assets, and Windows tiles.
Exit code `1` is a hard failure.

Browser acceptance:

1. DevTools → Application → Manifest: no errors, installable.
2. Application → Service Workers: `/progressier.js` is activated.
3. Install, close, relaunch from the icon.
4. iOS Safari: Share → Add to Home Screen → launch.
5. Offline reload shows `/offline.html`.
6. No console errors; no requests to `progressier.app`.

---

## 5. Configuration reference

All options are optional `data-*` attributes on the `pwa.js` script tag. Path
defaults are resolved against the directory that serves `pwa.js`, so they work
unchanged at a domain root and under a subpath.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-sw` | `progressier.js` | Service worker URL |
| `data-sw-scope` | worker's directory | Service worker scope |
| `data-manifest` | `manifest.webmanifest` | Manifest URL |
| `data-css` | `pwa.css` | Stylesheet URL |
| `data-icon` | `icons/icon-192.png` | Icon in banners/modals |
| `data-splash-icon` | `icons/icon-512.png` | Source for generated iOS splash |
| `data-qr-library` | `qrcode.js` | Local QR library URL |
| `data-qr-logo` | app icon | Logo drawn in the QR center |
| `data-desktop-qr` | off | On desktop, install buttons open the QR dialog |
| `data-app-name` | `document.title` | Name in injected meta tags |
| `data-theme-color` | existing meta or `#ffffff` | Theme color and splash background |
| `data-start-url` | `?launchedfrom=homescreen` | Windows tile start URL |
| `data-itunes-app-id` | — | Adds `apple-itunes-app` |
| `data-analytics` | — | Beacon endpoint for install/launch events |
| `data-push-endpoint` | — | Receives push subscriptions |
| `data-vapid-public-key` | — | Enables push subscribe UI |
| `data-install-banner` | off | Auto-show install banner |
| `data-push-banner` | off | Auto-show push banner |
| `data-offline-alert` | off | Auto-show offline alert |
| `data-toolbox` | off | Show the floating app-icon install launcher |
| `data-toolbox-off` | off | Suppress the launcher |
| `data-toolbox-position` | `right` | Position: `left`, `right`, `center`; optional `-top` / `-middle` |
| `data-toolbox-color` | theme color | Launcher background color |
| `data-toolbox-img` | app icon | Custom launcher image, relative to `pwa.js` |
| `data-toolbox-use-logo` | off | Force the app icon instead of the custom image |
| `data-toolbox-hide-standalone` | on | Hide inside standalone mode; `false` keeps it visible |
| `data-toolbox-show-platforms` | `all` | Restrict to `mobile` or `desktop` |
| `data-toolbox-show-urls` | all | JSON array or comma-separated match patterns |
| `data-welcome` | off | Show welcome modal once per browser |
| `data-auto-update` | off | Activate updates without asking |
| `data-no-meta` | off | Skip manifest/Apple/Windows meta injection |
| `data-no-css` | off | Do not inject `pwa.css` |
| `data-no-splash` | off | Do not generate iOS splash links |
| `data-viewport-fit` | off | Add `viewport-fit=cover` on iOS standalone |
| `data-allow-external-protocol` | off | Allow `web+pwa:` redirects to other origins |
| `data-csp-nonce` | — | Nonce for injected styles |
| `data-debug` | off | Verbose console logging |

Booleans are presence-based: `data-debug` means on; omit it for off. The
floating launcher also stays hidden in iframes and when `body.no-toolbox` is
present; it waits for the service worker registration before appearing.

---

## 6. HTML contract

These selectors and attributes are compatible with the original Progressier
client. Existing markup keeps working without changes.

| Markup | Behaviour |
| --- | --- |
| `.progressier-install-button` | Captured and rendered automatically; opens install prompt or help |
| `.progressier-subscribe-button` | Captured; requests push permission/subscription |
| `data-behavior="disable"` / `"hide"` | Disable or hide when installed |
| `data-hide-standalone` | Hide in standalone mode (default `true`) |
| `data-allow-ios` | Allow the iOS path (default `true`) |
| `data-allow-samsung` | Allow the Samsung path (default `true`) |
| `data-install`, `data-installed` | Custom labels; default English values localize |
| `data-icons` | Show the install icon next to the label |
| `data-eligible`, `data-subscribed`, `data-blocked` | Subscribe-button labels |
| `.captured`, `.initialized` | Added by the kit; same names as the original |
| `[data-pwa-install]` | Local alias for an install trigger |
| `[data-pwa-qr]` | Opens the QR dialog; value may be a custom URL |
| `[data-pwa-hide-standalone]` | Hidden when standalone |
| `[data-pwa-show-standalone]` | Hidden when not standalone |

Example:

```html
<button class="progressier-install-button" data-icons="true">Install</button>
<button class="progressier-subscribe-button" data-icons="true"
        data-eligible="Get notifications"
        data-subscribed="Notifications enabled"
        data-blocked="Notifications blocked"></button>
```

The scanner runs every 150 ms and captures new nodes, so client-rendered
buttons work without a manual call. `PWA.scanButtons()` forces a scan.

---

## 7. JavaScript API

`window.PWA` is always defined. `window.progressier` is also defined with a
compatibility shim (`install`, `prompt`, `isStandalone`,
`checkIfStandalone`, `register`, `ready`, `setAppBadge`, `clearAppBadge`,
`track`, `wording`, `detection`, `push`, `installBanner`, `pushBanner`,
`showWelcome`, `utils.wait`, `utils.vibrate`).

| Method | Returns / effect |
| --- | --- |
| `PWA.promptInstall(options)` / `PWA.install()` | `{ outcome }`: `accepted`, `dismissed`, `instructions`, `qr`, `already-installed` |
| `PWA.showInstallRequest()` | Show the local install flow (or desktop QR dialog) |
| `PWA.canInstall()` | `true` when `beforeinstallprompt` is captured |
| `PWA.isStandalone()` | Running as installed app |
| `PWA.isInstalled()` | Installed or standalone |
| `PWA.isIOS()`, `PWA.isSafari()` | Platform checks |
| `PWA.getState()` | `{ standalone, installed, canInstall, hasUpdate, ios, safari, launchSource, pushSupported, pushPermission }` |
| `PWA.onChange(fn)` | Subscribe to state; returns unsubscribe |
| `PWA.refresh()` | Re-apply hidden states |
| `PWA.ready` | Promise of the service-worker registration |
| `PWA.register()` | Register if needed; same promise |
| `PWA.applyUpdate()` | Activate waiting worker and reload |
| `PWA.hasUpdate()` | A waiting worker exists |
| `PWA.postToWorker(message)` | MessageChannel request/response to the worker |
| `PWA.subscribePush({ vapidPublicKey, endpoint })` | Permission + subscribe + POST |
| `PWA.unsubscribePush({ endpoint })` | Unsubscribe + DELETE |
| `PWA.requestPushPermission()` | Permission only |
| `PWA.setBadge(n)`, `PWA.clearBadge()` | App icon badge |
| `PWA.getNotifications()` | Push history array |
| `PWA.markNotificationsRead()` | Mark history read |
| `PWA.getSharedFile()` / `consumeSharedFile()` | Promise of the shared payload |
| `PWA.clearCaches({ includeStatic })` | Clear page cache (and optionally assets) |
| `PWA.showInstallHelp('ios' \| 'generic')` | Instructions sheet |
| `PWA.showInstallBanner(options)` / `hideInstallBanner()` | Top banner |
| `PWA.showPushBanner(options)` / `hidePushBanner()` | Top push banner |
| `PWA.showFlow(options)` | Generic modal |
| `PWA.showWelcome(options)` | Welcome modal |
| `PWA.showQRCode(url \| { url, text, installHere })` | QR dialog |
| `PWA.showReloadPrompt()` / `enableReloadPrompt()` | Reload prompt |
| `PWA.showOfflineAlert()` / `enableOfflineAlert()` | Offline alert |
| `PWA.createAppleSplashScreens()` | Regenerate iOS splash links |
| `PWA.notify(message, options)` | Toast |
| `PWA.wording.get(key)` / `setLanguage('fr')` | UI wording |
| `PWA.applyTheme({ background, text, element, border, hover, shadow, ... })` | Set CSS variables |
| `PWA.scanButtons()` | Force button scan |
| `PWA.track(name, detail)` | Emit event and optional beacon |
| `PWA.urlBase64ToUint8Array()`, `PWA.arrayBufferToBase64()` | Helpers |
| `PWA.config` | Resolved configuration object |
| `PWA.version` | Kit version |

`showFlow` accepts:
`title`, `text`, `items[]`, `app` (boolean), `icon`, `appName`, `appHint`,
`button`, `secondary`, `onPrimary`, `onSecondary`, `dismissible`.

`showQRCode` accepts a URL string or
`{ url, title, text, installHere, dismissible, logo }`.

---

## 8. Events

Listen on `document`:

| Event | Detail |
| --- | --- |
| `pwa:installable` | Install prompt captured |
| `pwa:installed` | App installed or entered standalone |
| `pwa:update` | New service worker waiting |
| `pwa:share` | `{ id, url, title, text, file, blob }` |
| `pwa:event` | `{ name, detail }` for every `PWA.track()` call |

The `progressier` shim also exposes `progressier.ready` and the push helpers,
so legacy code such as `progressier.push.isSubscribed()` keeps working.

---

## 9. Storage and state

| Key | Type | Purpose |
| --- | --- | --- |
| `progressierinstallbanner` + host + path | Cookie | Install banner dismissal timestamp |
| `progressierpushbanner` + host + path | Cookie | Push banner dismissal timestamp |
| `progressierSavedPushNotifications` | IndexedDB | Notification history (same name as original) |
| `progressiersharedfiles` | IndexedDB | Shared files from the share target |
| `pwakit` / `meta` | IndexedDB | Worker metadata (badge state) |
| `pwa-static-<VERSION>` | Cache | Precached shell, CSS, QR library, icons |
| `pwa-pages-<VERSION>` | Cache | Network-first page cache |
| `pwakit:welcome` | localStorage | Welcome modal shown once |

Do not rename the Progressier IndexedDB stores if migrating an existing site;
old history and shared files live there.

---

## 10. Theming

`pwa.css` reads Progressier variables from `:root`:

```
--progressierBg
--progressierElement
--progressierTxt
--progressierBorderColor
--progressierHover
--progressierBackdrop
--progressierBoxShadow
--progressierIconShadow
--progressierFont
--progressierLetterSpacing
--progressierTextFontWeight
--progressierHeadingFontWeight
--progressierBtnFontWeight
```

Set them in CSS or at runtime:

```js
PWA.applyTheme({
  background: '#ffffff',
  element: '#fafafa',
  text: '#142a37',
  border: '#eaeaea',
  hover: '#f6f6f6',
  shadow: '0 2px 8px rgba(15,41,14,.08), 0 3px 35px rgba(7,21,41,.20)',
  font: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
});
```

For dark mode, override the same variables under
`@media (prefers-color-scheme: dark)` or a `.dark` class on `<html>`. The kit's
components inherit whatever the page sets.

---

## 11. Framework notes

- **Static HTML / PHP / Rails / Django:** use the head block in `snippet.html`.
- **Next.js (App Router):** put the runtime files in `public/`, add the script
  with `next/script` (`strategy="afterInteractive"`) or a plain `<script defer>`
  in `app/layout.tsx`, and keep `manifest.webmanifest` in `public/`.
- **Next.js (Pages Router):** add the script in `pages/_document.tsx` and the
  manifest link in `<Head>`.
- **Vite / CRA / SvelteKit:** copy runtime files to `public/`; add the script to
  `index.html` or `app.html`.
- **SPA routers:** the service worker caches navigations network-first and
  falls back to `/offline.html`. Do not register a second worker at the same
  scope.
- **Subpath deployment (`/app/`):** copy the files into that folder and point
  the script at it (`src="/app/pwa.js"`). Nothing else is needed: `pwa.js`
  resolves the worker, manifest, CSS, icons and QR library relative to its own
  URL, and `progressier.js` resolves its precache and offline paths relative to
  its own directory (normally the worker scope directory). Only the manifest
  needs relative `scope`/`start_url`
  (`"./"` and `"./?launchedfrom=homescreen"`) and `offline.html` needs its
  root-absolute asset paths rewritten — see `.github/workflows/pages.yml` for a
  worked example.
- **GitHub Pages:** `.github/workflows/pages.yml` builds `_site/` from the
  runtime files, publishes `demo/` as the root feature-test playground, and
  publishes `example/` at `/example/` with its own worker scope and offline page.
  Enable Pages
  with **Source: GitHub Actions** once. The pages are
  <https://sandro-defender.github.io/PWA-Helper/> and
  <https://sandro-defender.github.io/PWA-Helper/example/>.

---

## 12. Updating and rollback

When any cached file changes:

1. Bump `VERSION` in `progressier.js` (`1.0.4` → `1.0.5`).
2. Bump `PWA.version` in `pwa.js` to match.
3. Upload the changed files.
4. Reload. With `data-auto-update` the new worker activates automatically;
   otherwise `PWA.showReloadPrompt()` or the built-in prompt asks the user.

The old worker is replaced because the script URL is unchanged. Keep the worker
file in place during rollback; restore the previous files and bump `VERSION`
again. To remove the PWA entirely, serve a worker at `/progressier.js` that
calls `self.registration.unregister()` and remove the manifest/script tags.

---

## 13. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Manifest ignored | Wrong MIME type; serve `application/manifest+json` |
| Install prompt never appears | Chrome requires HTTPS, a valid manifest, icons, and a controlling worker; use `PWA.promptInstall()` or the markup |
| Worker not updating | `Cache-Control` too long on `progressier.js`; bump `VERSION` |
| Buttons do nothing | Old Progressier script still loaded, or `.progressier-*` node added before `pwa.js`; the scanner retries every 150 ms |
| Push says not configured | Missing `data-vapid-public-key` or `data-push-endpoint` |
| Push permission denied | Browser/site settings; `PWA.unsubscribePush()` then reset site permissions |
| iOS splash missing | Generated only in iOS Safari (not standalone); allow `data:` in `img-src` or supply static links |
| CSP blocks install help | Pass `data-csp-nonce` and allow it in `style-src` |
| QR blank | `/qrcode.js` not uploaded or blocked; check the Network panel |
| Share target 404 | `share_target.action` must be `/share-target`; the worker handles the POST |
| Offline page missing | Upload `offline.html`, `offline.css`, `offline.js`; the worker precaches them |

---

## 14. Included vs backend-only

Included and self-hosted:

- install buttons, banners, welcome/flow modal, iOS help
- QR install dialog with local QR generation and logo
- push permission/subscription UI and service-worker display
- notification history storage, badge, share target
- offline caching and offline page
- meta tags, Apple splash generation, Windows tiles
- theming variables and 10-language wording
- protocol redirects (`web+pwa:`, `pwaredirect`, `pwaprotocolredirect`)

Not included because they were Progressier services, not client code:

- hosted push campaigns, scheduling, segments, delivery
- analytics dashboard, A/B tests, funnel reports
- dashboard-managed announcements/newsfeed content
- user accounts, billing, subscription management
- App Store / Play Store / TWA packaging
- Progressier attribution/promo mode

Do not tell a user these are "implemented" by copying files. They need a
backend or a separate service.

Client-side Progressier features that are **not** in this kit (add them in the
target project if the design calls for them):

- pull-to-refresh indicator
- cookie-consent banner (only banner-dismissal cookies exist)
- Progressier's backend-driven toolbox promo/install-page routing; the local
  `data-toolbox` icon opens the local `PWA.showInstallRequest()` flow instead
- newsfeed/announcement feed UI (notification history is stored and exposed via
  `PWA.getNotifications()`, but there is no rendered feed)
- platform-specific install instruction screens for every OS; the kit ships a
  generic sheet plus the iOS path

---

## 15. Agent acceptance checklist

Before reporting the integration complete, confirm all of these:

- [ ] Old `progressier.app` script and manifest tags removed.
- [ ] `pwa.js`, `pwa.css`, `progressier.js`, manifest, offline files, QR library, icons uploaded.
- [ ] Manifest `name`, `short_name`, `id`, `start_url`, `scope`, colors, icons adapted.
- [ ] Manifest served as `application/manifest+json`.
- [ ] `progressier.js` served from the expected path with `no-cache` and correct scope.
- [ ] `node scripts/check.mjs` exits `0` (syntax, manifest, icons, version).
- [ ] Manifest parses as JSON and every icon path exists with the declared size.
- [ ] `scripts/verify-deployment.mjs` exits `0` against the deployed URL.
- [ ] Browser: manifest valid, worker activated, install works, relaunch works.
- [ ] Browser: offline reload shows the offline page.
- [ ] Browser: no console errors and no `progressier.app` requests.
- [ ] If push is enabled: VAPID keys set, subscribe POST reaches the server, a test notification displays.
- [ ] If the app is on a subpath: worker paths and manifest scope updated.
- [ ] Version bumped if any cached file changed.

---

## 16. Copy-ready prompt for another agent

Paste this into the target project's AI agent and fill in the two placeholders:

> Integrate the self-hosted PWA kit located at `<KIT_PATH>` into this project.
>
> 1. Read `<KIT_PATH>/AGENTS.md` first and follow it exactly.
> 2. Copy the runtime files into the web root (or `public/`): `pwa.js`,
>    `pwa.css`, `progressier.js`, `manifest.webmanifest`, `qrcode.js`,
>    `offline.html`, `offline.css`, `offline.js`, `browserconfig.xml`,
>    `favicon.ico`, and `icons/`.
> 3. Remove any existing `progressier.app` script and manifest tags.
> 4. Add the manifest link, icons, theme-color meta, and
>    `<script src="/pwa.js" defer></script>` to the document head.
> 5. Adapt `manifest.webmanifest` for this app: name, short_name, id, start_url,
>    scope, colors, and icons. Keep `share_target.action` as `/share-target`.
> 6. Configure the server to serve the manifest as
>    `application/manifest+json` and `progressier.js` with
>    `Cache-Control: no-cache` and `Service-Worker-Allowed: /`.
> 7. If push is required, generate VAPID keys with
>    `node scripts/generate-vapid-keys.mjs --write`, add
>    `data-vapid-public-key` and `data-push-endpoint` to the script tag, and
>    implement `POST`/`DELETE` on that endpoint.
> 8. Run `node --check pwa.js`, `node --check progressier.js`, validate the
>    manifest JSON, then run
>    `node <KIT_PATH>/scripts/verify-deployment.mjs <DEPLOYED_URL>`.
> 9. Report the checklist results from §15, including any backend-only features
>    that were not part of the kit.

Replace `<KIT_PATH>` with the path or repository URL of this kit and
`<DEPLOYED_URL>` with the target deployment URL.
