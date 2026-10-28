# Self-hosted PWA kit

A dependency-free, Progressier-compatible PWA layer you can drop into any web
project: manifest, service worker, install UI, offline support, share target,
push notifications, app badge, a QR install dialog and a floating install launcher.

Everything runs from your own domain — no third-party script, no account, no
external requests, no build step, no `npm install`.

**Origin.** This kit was written to replace the hosted Progressier client on
`staff.you.ge`. That site is the worked reference deployment; the runtime is
generic, while each deployment supplies its app identity through the manifest
and optional `pwa.js` configuration.

**Live playground:** <https://sandro-defender.github.io/PWA-Helper/> — the full
feature-test page for install, toolbox, QR, offline, push, share, caches, theme, wording and UI events.

**User-facing example:** <https://sandro-defender.github.io/PWA-Helper/example/> —
a cleaner sample staff workspace showing how the helper can feel inside a real app.
Its schedule/checklist interactions use sample data stored only in the visitor’s browser.

> **For AI coding agents:** start with [`AGENTS.md`](AGENTS.md). It is a
> step-by-step integration playbook — file placement, manifest adaptation,
> server headers, CSP, push, verification, an acceptance checklist and a
> copy-ready prompt you can paste into another project's agent.

---

## Quick start

```bash
git clone https://github.com/sandro-defender/PWA-Helper.git
```

Then copy what you need into your project (or use **Use this template** on
GitHub to start from a clean copy).

**1. Copy the runtime files to your web root** (or `public/` in Next.js, Vite,
CRA, SvelteKit):

```
pwa.js  pwa.css  progressier.js  manifest.webmanifest  qrcode.js
offline.html  offline.css  offline.js  browserconfig.xml  favicon.ico  icons/
```

**2. Add to `<head>`** — replace any `progressier.app` tags:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#ffffff" />
<script src="/pwa.js" defer></script>
```

**3. Set two response headers** — the manifest MIME type and a non-cached
worker:

```
/manifest.webmanifest   Content-Type: application/manifest+json
/progressier.js         Cache-Control: no-cache
                        Service-Worker-Allowed: /
```

Then check the result:

```bash
node scripts/check.mjs                              # static files
node scripts/verify-deployment.mjs https://you.example  # live deployment
```

`npm run check` and `npm run verify` do the same thing.

---

## Documentation map

| File | Read it when |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | you are an AI agent integrating this into a project |
| `README.md` | you need the full API, config and server setup (this file) |
| [`INTEGRATION.md`](INTEGRATION.md) | you want a worked deployment example, upload order and rollback |
| [`PARITY.md`](PARITY.md) | you need to know what matches the original Progressier client |
| [`snippet.html`](snippet.html) | you want to copy the complete `<head>` block |
| [`examples/push-server/`](examples/push-server/) | you need a runnable Web Push sender |
| [`reference/`](reference/) | you want to inspect the original manifest and client bundle (reference-only; never deployed) |
| `demo/` | you want to test the helper's full feature set in the playground |
| `example/` | you want a polished, user-facing sample integration |

---

## Why this is a reimplementation, not a copy

The Progressier `script.js` is a 324 KB minified proprietary bundle. It is not a
standalone PWA library: it resolves your `appId`, fetches configuration from
`progressier.com`, and is licensed for use with their service. Hosting it on your
server would still depend on their backend. A user-supplied copy is kept under
`reference/` only for parity research; `reference/Script.decompiled.js` is its
pretty-printed reading copy. Neither file is used by the runtime or deployed by
GitHub Pages. The local runtime is a separate clean-room implementation.

Their service worker (`sw.js`, 5 KB) only handles push, share target and the app
badge — it does **no offline caching**. This kit implements the same public
behaviour in readable code and adds proper offline support.

---

## Files

```
manifest.webmanifest      Web app manifest (from your progressier.json)
progressier.js            Service worker — keep this exact path
pwa.js                    Client SDK — replaces Progressier's script.js
pwa.css                   Progressier-compatible component styles
qrcode.js                 Vendored MIT QR generator (QR install dialog)
offline.html              Offline fallback page
offline.css               Offline page styles
offline.js                Offline page status script
browserconfig.xml         Windows tile configuration
favicon.ico               Multi-size favicon (16/32/48)
snippet.html              Copy-paste head block
AGENTS.md                 AI-agent integration playbook
INTEGRATION.md            Worked deployment example (staff.you.ge)
PARITY.md                 Original vs local feature/sizing report
reference/                Original manifest/client bundle + readable copies (research only; not deployed)
demo/                     Full-feature GitHub Pages test playground + manifest
example/                  Polished user-facing sample integration + manifest
.github/workflows/        check.yml (static checks), pages.yml (playground + example deploy)
scripts/
  check.mjs               Static checks: syntax, manifest, icons, version
  verify-deployment.mjs   Check a live deployment
  generate-vapid-keys.mjs Create Web Push keys
examples/push-server/     Runnable push sender (Node + web-push)
icons/                    Sample icons — replace with your own
  icon-192.png
  icon-512.png
  icon-144.png
  icon-150.png
  icon-maskable-192.png
  icon-maskable-512.png
  apple-touch-icon.png
  favicon-32.png
```

---

## Install

### 1. Upload

Copy the files to your web root, keeping the paths above:

```
/ manifest.webmanifest
/ progressier.js
/ pwa.js
/ pwa.css
/ offline.html
/ offline.css
/ offline.js
/ browserconfig.xml
/ favicon.ico
/ icons/...
```

Keep the service worker at **`/progressier.js`**. Browsers that already have the
old Progressier worker registered will update it in place, with no duplicate
worker.

### 2. Replace the Progressier tags in your HTML

Remove:

```html
<link rel="manifest" href="https://progressier.app/.../progressier.json" />
<script defer src="https://progressier.app/.../script.js"></script>
```

Add:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#ffffff" />

<script src="/pwa.js" defer></script>
```

The script can inject the manifest and Apple meta tags itself if you prefer a
one-line install, but declaring them in HTML is more reliable (Chrome can miss
dynamically added manifests on first load).

`snippet.html` contains the full head block, including the optional push
attributes. `INTEGRATION.md` has the deployment order, headers, update and
rollback steps for `staff.you.ge`.

### 3. Add install buttons (optional)

Any element with `data-pwa-install` opens the browser prompt, or iOS instructions:

```html
<button type="button" data-pwa-install>Install app</button>
```

Related attributes:

| Attribute | Behaviour |
| --- | --- |
| `data-pwa-install` | Click triggers install; hidden once installed/standalone |
| `data-pwa-hide-standalone` | Hidden when running as an installed app |
| `data-pwa-show-standalone` | Hidden when running in a browser tab |

You can also drive your own UI:

```js
PWA.onChange((state) => {
  // state: { standalone, installed, canInstall, hasUpdate, ios, safari, pushSupported, ... }
  installButton.hidden = !state.canInstall && !state.ios;
});
```

### Progressier-compatible buttons

Markup from the original Progressier install keeps working. Both classes are
auto-detected (150 ms scan) and wired up:

```html
<button type="button" class="progressier-install-button"
        data-icons="true"
        data-install="Install"
        data-installed="Launch the app"></button>

<button type="button" class="progressier-subscribe-button"
        data-icons="true"
        data-eligible="Get notifications"
        data-subscribed="Notifications enabled"
        data-blocked="Notifications blocked"></button>
```

| Attribute | Behaviour |
| --- | --- |
| `data-behavior` | `disable` (default) or `hide` when install is unavailable |
| `data-hide-standalone` | Hide inside an installed app (default `true`) |
| `data-allow-ios` | Treat iOS as installable via instructions (default `true`) |
| `data-allow-samsung` | Allow Samsung Internet (default `true`) |
| `data-install` / `data-installed` | Button labels |
| `data-icons` | Show the inline icon |
| `data-eligible` / `data-subscribed` / `data-blocked` | Subscribe labels |

The kit adds `.captured` and `.initialized` classes, exactly like the original.

### Floating install toolbox

`data-toolbox` adds the original-style floating app-icon launcher. Clicking it
opens the local install flow (`PWA.showInstallRequest()`), which leads to the
native prompt when available or the install instructions otherwise. It is hidden
in iframes, when there is no registered service worker, by `data-toolbox-off` or
`body.no-toolbox`, and—by default—in
standalone mode.

```html
<script
  src="/pwa.js"
  defer
  data-toolbox
  data-toolbox-position="right"
  data-toolbox-color="#ffffff"
  data-toolbox-img="/icons/icon-192.png"
></script>
```

The button can also be managed at runtime:

```js
PWA.enableToolbox({ position: 'left-top', color: '#ffffff', image: '/icons/icon-192.png' });
PWA.hideToolbox();    // hide without removing the widget
PWA.showToolbox();    // show it again, subject to platform/URL rules
PWA.disableToolbox(); // remove and clean up the widget
```

Supported positions are `left`, `right`, or `center`, with optional `-top` or
`-middle` vertical placement. `data-toolbox-show-platforms` can limit it to
`mobile` or `desktop`; `data-toolbox-show-urls` accepts a JSON array or
comma-separated path/URL patterns (`*` wildcard). Query parameters included in a
pattern are matched as a subset, so extra parameters on the current URL do not
prevent a match. Prefix a pattern with `%&%` to hide the widget on matching
pages. The standalone default can be overridden
with `data-toolbox-hide-standalone="false"`.

### Banners, modal, offline alert

```js
PWA.showInstallBanner({ text, icon, color, btnColor, platforms: 'all' | 'mobile' | 'desktop' });
PWA.showPushBanner({ text, icon, color, btnColor });
PWA.showWelcome({ title, text, items: ['Step one', 'Step two'] });
PWA.showFlow({ title, text, button: 'Continue' });
PWA.showReloadPrompt({ color });
PWA.enableReloadPrompt({ minutes: 60 });
PWA.showOfflineAlert();
PWA.enableOfflineAlert();
PWA.notify('Saved');
```

Auto-show them from the script tag with `data-install-banner`, `data-push-banner`,
`data-offline-alert` or `data-welcome` (shown once, remembered in `localStorage`).

### Theming

Every component reads the original Progressier CSS variables:

```js
PWA.applyTheme({
  background: '#ffffff',
  text: '#051b2c',
  accent: '#1a73e8',
  accentText: '#ffffff',
  font: 'Inter, system-ui, sans-serif',
  border: 'rgba(0,0,0,.09)',
});
```

`pwa.css` loads automatically. Set `data-no-css` to opt out and style the
components yourself.

### iOS splash screens and meta tags

On iOS Safari (not inside the installed app), `pwa.js` generates the splash
image for the current iPhone/iPad screen and adds the matching
`apple-touch-startup-image` link for portrait and landscape. It also fills in
`application-name`, `apple-mobile-web-app-title`, theme color, Windows tiles and
the legacy browser meta tags if the HTML does not already have them.

The splash is generated from `data-splash-icon` (default
`/icons/icon-512.png`) on the theme color background. Because it is a `data:`
image, allow `data:` in `img-src` if you use a strict CSP, or set
`data-no-splash` and provide your own static links. The link is added on a normal
Safari visit and is used the next time the app launches from the home screen.

```js
// Force a refresh after changing the theme or icon at runtime.
PWA.createAppleSplashScreens();
```

---

## Configuration

All options are optional `data-*` attributes on the script tag. Paths are
resolved against the directory that serves `pwa.js`, so the defaults work at a
domain root (`/`) and under a subpath (`/app/`, GitHub Pages project sites)
without changes.

```html
<script
  src="/pwa.js"
  defer
  data-sw="/progressier.js"
  data-sw-scope="/"
  data-manifest="/manifest.webmanifest"
  data-analytics="/api/pwa-events"
  data-push-endpoint="/api/push/subscribe"
  data-vapid-public-key="BEl62i..."
  data-csp-nonce="..."
></script>
```

| Attribute | Default | Purpose |
| --- | --- | --- |
| `data-sw` | `progressier.js` | Service worker URL (next to `pwa.js`) |
| `data-sw-scope` | worker's directory | Service worker scope |
| `data-manifest` | `manifest.webmanifest` | Manifest URL (also injected if missing) |
| `data-css` | `pwa.css` | Component stylesheet URL |
| `data-icon` | `icons/icon-192.png` | Icon used by banners/modals |
| `data-splash-icon` | `icons/icon-512.png` | Source image for iOS splash screens |
| `data-app-name` | `document.title` | Name used in meta tags |
| `data-theme-color` | `#ffffff` (or existing meta) | Theme color and splash background |
| `data-start-url` | `?launchedfrom=homescreen` | Windows tile start URL |
| `data-analytics` | — | Optional beacon endpoint for install/launch events |
| `data-push-endpoint` | — | Default endpoint that receives push subscriptions |
| `data-vapid-public-key` | — | Enables the subscribe buttons and push banner |
| `data-install-banner` | off | Show the install banner automatically |
| `data-push-banner` | off | Show the push banner automatically |
| `data-offline-alert` | off | Show the offline alert automatically |
| `data-toolbox` | off | Show the floating install launcher |
| `data-toolbox-off` | off | Suppress the launcher even when `data-toolbox` is set |
| `data-toolbox-position` | `right` | `left`, `right`, `center`, with optional `-top` / `-middle` |
| `data-toolbox-color` | theme color | Background color behind the floating app icon |
| `data-toolbox-img` | app icon | Custom launcher image URL (relative to `pwa.js`) |
| `data-toolbox-use-logo` | off | Force the app icon instead of `data-toolbox-img` |
| `data-toolbox-hide-standalone` | on | Hide in standalone mode; set to `false` to keep visible |
| `data-toolbox-show-platforms` | `all` | Limit visibility to `mobile` or `desktop` |
| `data-toolbox-show-urls` | all | JSON array or comma-separated path/URL patterns |
| `data-welcome` | off | Show the welcome modal once per browser |
| `data-auto-update` | off | Apply service worker updates without asking |
| `data-no-meta` | off | Do not inject manifest/Apple/Windows meta tags |
| `data-no-splash` | off | Do not generate iOS splash screens |
| `data-no-css` | off | Do not inject `pwa.css` |
| `data-viewport-fit` | off | Add `viewport-fit=cover` on iOS/standalone |
| `data-itunes-app-id` | — | Adds the `apple-itunes-app` meta tag |
| `data-allow-external-protocol` | off | Allow `web+pwa:` redirects to other origins |
| `data-csp-nonce` | — | Nonce for injected styles |
| `data-debug` | off | Console logging |

If your site uses a strict CSP without `'unsafe-inline'`, pass a nonce with
`data-csp-nonce` or add the nonce to your policy.

---

## JavaScript API

`window.PWA` is always available. `window.progressier` gets a compatibility shim
(`install`, `prompt`, `isStandalone`, `checkIfStandalone`, `register`, `ready`,
`setAppBadge`, `clearAppBadge`, `track`, `wording`, `detection`, `push`, banner
helpers) so existing calls keep working.

| Method | Description |
| --- | --- |
| `PWA.promptInstall()` / `PWA.install()` | Show native install prompt or iOS help. Resolves `{ outcome }` |
| `PWA.showInstallRequest()` | Show the full local install flow (or desktop QR dialog) |
| `PWA.canInstall()` | Browser prompt is available |
| `PWA.isStandalone()` | Running as an installed app |
| `PWA.isInstalled()` | Installed or standalone |
| `PWA.isIOS()` / `PWA.isSafari()` | Platform checks |
| `PWA.getState()` | Full state snapshot |
| `PWA.onChange(fn)` | Subscribe to state changes; returns unsubscribe |
| `PWA.refresh()` | Re-apply hidden states to the DOM |
| `PWA.ready` | Promise resolving to the service worker registration |
| `PWA.applyUpdate()` | Activate a waiting service worker and reload |
| `PWA.hasUpdate()` | Update is waiting |
| `PWA.subscribePush({ vapidPublicKey, endpoint })` | Ask permission, subscribe, POST to server |
| `PWA.unsubscribePush({ endpoint })` | Unsubscribe and notify server |
| `PWA.requestPushPermission()` | Permission only |
| `PWA.setBadge(n)` / `PWA.clearBadge()` | App icon badge |
| `PWA.getNotifications()` | Push history from the Progressier IndexedDB store |
| `PWA.markNotificationsRead()` | Mark the whole history as read |
| `PWA.getSharedFile()` | Promise resolving to a shared file/URL |
| `PWA.clearCaches({ includeStatic })` | Clear cached pages (and optionally static assets) |
| `PWA.track(name, detail)` | Fire an event (and beacon if configured) |
| `PWA.showInstallHelp('ios' \| 'generic')` | Show the instructions sheet |
| `PWA.showInstallBanner(options)` / `PWA.hideInstallBanner()` | Top install banner |
| `PWA.showPushBanner(options)` / `PWA.hidePushBanner()` | Top push banner |
| `PWA.showWelcome(options)` / `PWA.showFlow(options)` | Welcome and modal flows |
| `PWA.showReloadPrompt()` / `PWA.enableReloadPrompt()` | Reload prompt |
| `PWA.showOfflineAlert()` / `PWA.enableOfflineAlert()` | Offline alert |
| `PWA.enableToolbox(options)` / `PWA.showToolbox()` | Create/show the floating install launcher |
| `PWA.hideToolbox()` / `PWA.disableToolbox()` | Hide or remove the launcher |
| `PWA.createAppleSplashScreens()` | Regenerate iOS splash links for the current screen |
| `PWA.notify(message, options)` | Small toast |
| `PWA.wording.get(key)` / `PWA.wording.setLanguage('fr')` | UI wording |
| `PWA.applyTheme({ background, text, accent, ... })` | Set Progressier CSS variables |
| `PWA.scanButtons()` | Re-scan `.progressier-*` buttons |

### Wording

Bundled languages: English, French, Italian, German, Swedish, Dutch, Norwegian,
Danish, Estonian and Spanish. The language is auto-detected and can be overridden:

```js
PWA.wording.setLanguage('de');
console.log(PWA.wording.get('install'));
```

### Events

Listen on `document`:

```js
document.addEventListener('pwa:installable', () => {});
document.addEventListener('pwa:installed', () => {});
document.addEventListener('pwa:update', () => {});
document.addEventListener('pwa:share', (event) => {});
document.addEventListener('pwa:event', (event) => {
  console.log(event.detail.name, event.detail.detail);
});
```

`pwa:share` carries `{ id, url, title, text, file, blob }`.

### Logout

Clear cached pages and the push subscription when a user signs out:

```js
await PWA.clearCaches();        // cached pages; add { includeStatic: true } for assets
await PWA.unsubscribePush();
```

---

## Web Share Target

Receiving shares is handled by the service worker and requires no server route.
`manifest.webmanifest` exposes `POST /share-target`; the worker stores the payload
in IndexedDB and redirects to `/?launchedfrom=share&fileid=...`.

Read it in your app:

```js
PWA.getSharedFile().then(async (shared) => {
  if (!shared) return;
  if (shared.file) await uploadFile(shared.file);
  else if (shared.url) prefillComposer({ url: shared.url, title: shared.title, text: shared.text });
});
```

The `fileid`, `url`, `title`, `text` query parameters are removed from the
address bar automatically after reading (the Progressier names). The kit also
sets `sharedurl`, `sharedtitle` and `sharedtext` aliases for older code.

Limits: one file, up to 25 MB. Keep a server-side `POST /share-target` route that
redirects to `/` as a fallback for the very first visit, before the worker is active.

---

## Push notifications

The worker accepts standard Web Push payloads:

```json
{
  "title": "New message",
  "body": "You have a new message",
  "icon": "/icons/icon-192.png",
  "url": "/inbox",
  "tag": "message-42",
  "data": { "conversationId": "42" }
}
```

It also understands Declarative Web Push payloads (`{ "notification": { ... } }`),
`notificationclick` (focus + navigate), app badge counting and
`pushsubscriptionchange` renewal.

### Subscribe on the client

The call must happen from a user gesture (required by iOS):

```js
document.querySelector('#enable-push').addEventListener('click', async () => {
  const result = await PWA.subscribePush({
    vapidPublicKey: 'BEl62i...your-public-key',
    endpoint: '/api/push/subscribe',
  });
  if (!result.ok) console.log('Not subscribed:', result.permission);
});
```

### Minimal Node server

```bash
npm install express web-push
npx web-push generate-vapid-keys
```

```js
const express = require('express');
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const app = express();
app.use(express.json());

// Store subscriptions in your database, keyed by user id.
const subscriptions = new Map();

app.post('/api/push/subscribe', (req, res) => {
  if (!req.user) return res.sendStatus(401);
  subscriptions.set(req.user.id, req.body);
  res.sendStatus(201);
});

app.delete('/api/push/subscribe', (req, res) => {
  subscriptions.delete(req.user?.id);
  res.sendStatus(204);
});

app.post('/api/push/send', async (req, res) => {
  const subscription = subscriptions.get(req.body.userId);
  if (!subscription) return res.sendStatus(404);
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: 'staff.you.ge',
        body: req.body.message,
        url: '/',
      })
    );
    res.sendStatus(202);
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      subscriptions.delete(req.body.userId); // expired
    }
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000);
```

Notes:

- Never ship the VAPID **private** key to the browser.
- The subscribe endpoint receives cookies (`credentials: 'include'`), so protect it
  with your normal session auth.
- `pushsubscriptionchange` re-subscribes and POSTs the new subscription to the same
  endpoint. Use `upsert` semantics.
- Chrome/Edge on Android and desktop, and iOS 16.4+ for home-screen apps, support
  push. iOS requires the app to be installed and permission requested from a tap.

---

## App badge

```js
PWA.setBadge(3);     // show 3 on the app icon
PWA.clearBadge();    // clear
```

Notifications received via push increment the badge automatically; opening one
decrements it. Call `PWA.clearBadge()` when the user reads everything.

---

## Protocol handler

The manifest registers `web+pwa:` and points it at:

```
/?launchedfrom=homescreen&pwaprotocolredirect=%s
```

`pwa.js` redirects to the encoded URL. By default only same-origin URLs are
allowed; set `data-allow-external-protocol` if the app must handle external links.

---

## Offline behaviour

- Navigations: network-first, 5 s timeout, cached copy, then `/offline.html`.
- Static assets (CSS, JS, images, fonts, media, PDFs): stale-while-revalidate.
- `/api/*`, non-GET requests and cross-origin requests are never cached.
- Responses with `Cache-Control: no-store` or `private`, and requests carrying an
  `Authorization` header, are never cached.
- Bump `VERSION` in `progressier.js` on deploy to invalidate old caches.

The worker deliberately does **not** cache HTML indefinitely, so server-rendered
pages keep working. If your app is a single-page app that always serves the same
shell, routes the user already visited stay available; deep links that were never
visited fall back to `/offline.html`.

---

## Server configuration

HTTPS is mandatory for service workers and install prompts (`localhost` excluded).
Your CSP must allow the worker (`worker-src 'self'`, or `script-src 'self'` if
`worker-src` is not set).

### nginx

```nginx
# Manifest must use the manifest MIME type or Chrome ignores it.
location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
}

# Service worker: never cache aggressively.
location = /progressier.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/";
}

location = /pwa.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /pwa.css {
    default_type text/css;
    add_header Cache-Control "no-cache";
}

location = /offline.html {
    add_header Cache-Control "no-cache";
}

location = /offline.css {
    add_header Cache-Control "no-cache";
}

location = /offline.js {
    add_header Cache-Control "no-cache";
}
```

### Apache

```apache
AddType application/manifest+json .webmanifest
AddType application/javascript .js

<FilesMatch "^(progressier|pwa)\.js$">
    Header set Cache-Control "no-cache"
    Header set Service-Worker-Allowed "/"
</FilesMatch>

<Files "pwa.css">
    Header set Cache-Control "no-cache"
</Files>

<Files "manifest.webmanifest">
    Header set Cache-Control "no-cache"
</Files>
```

If the worker lives in a subdirectory but must control the root, set
`Service-Worker-Allowed: /` and register with `data-sw-scope="/"`.

---

## GitHub Pages

This repository publishes two GitHub Pages routes through
`.github/workflows/pages.yml`:

- <https://sandro-defender.github.io/PWA-Helper/> — the full feature-test playground.
- <https://sandro-defender.github.io/PWA-Helper/example/> — a polished sample
  staff workspace showing the helper in a user-facing page.

The workflow publishes `demo/` at `/` with the shared runtime at the Pages root.
It publishes `example/` at `/example/` with its own runtime copy, manifest,
service-worker scope and offline page so the user example behaves as a separate
installable app.

The project site is served from `/PWA-Helper/`. `pwa.js` resolves its files
relative to its own URL, and `progressier.js` resolves precache assets relative
to its own directory, so their paths remain inside that base. Both manifests use
relative `scope` and `start_url` values so each install has its own identity and
launch path. The example build copies the icons into `/example/icons/` so the
sample worker and offline page stay within the example app's own scope.

The one exception is `offline.html`: it uses root-absolute asset paths so it
works for deep offline navigations on a domain-root deployment. The Pages build
rewrites those links to the repository subpath.

To deploy your own copy on Pages:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main`, or run the `pages` workflow manually.
3. Open `https://<user>.github.io/<repo>/`.

At a domain root, nothing needs rewriting.

---

## Manifest notes

- `id` is `/HIPSBNVemXtM8VMwRfWs`, which resolves to
  `https://staff.you.ge/HIPSBNVemXtM8VMwRfWs` — the same identity as before, so
  existing installations are preserved. Change it only if you intentionally want a
  new app entry.
- `start_url` keeps `?launchedfrom=homescreen`, matching the previous setup.
- `protocol_handlers` registers both original schemes: `web+pwa:` and
  `web+loldwyhv:`. Both point at
  `/?launchedfrom=homescreen&pwaprotocolredirect=%s`, matching the old manifest.
- `scope` is `/`. If you deploy under a subpath, make it relative and update the
  icon paths.
- Icons are the originals from your Progressier manifest, now hosted locally.
  Replace them with your own artwork if needed.

---

## Migration checklist

1. Upload all files.
2. Replace the two Progressier tags with `/pwa.js` + `/manifest.webmanifest`.
3. Keep the worker at `/progressier.js`.
4. Test install in Chrome/Edge (desktop + Android) and Safari (iOS).
5. Delete any remaining `progressier.app` references.
6. Existing installed users receive the new manifest/worker on their next launch.
   Users whose app is open during deploy get the update prompt (`pwa:update`), or
   automatic update with `data-auto-update`.

---

## Testing

- **Chrome DevTools → Application**: Manifest (no errors), Service Workers (activated),
  Cache Storage (`pwa-static-*`, `pwa-pages-*`).
- **Lighthouse → PWA**: installability and offline checks.
- `chrome://web-app-internals`: installability diagnostics.
- Toggle **Offline** in DevTools and reload a visited page → offline page or cached
  shell should appear.
- Install on Android and use the system share sheet → the app should open with the
  shared file/URL.
- iOS: open in Safari → Share → Add to Home Screen; verify standalone launch and
  safe-area layout.
- Push: subscribe, send a test notification, click it, check badge count.
- Live deployment: `node scripts/verify-deployment.mjs https://staff.you.ge`.

---

## What this kit does not include

Progressier also provides hosted services that cannot be replicated by static
files:

| Progressier feature | Here |
| --- | --- |
| Install button, iOS instructions | Yes |
| Progressier button classes and attributes | Yes |
| Install banner / push banner | Yes |
| Welcome, flow and install modals | Yes |
| Offline alert and reload prompt | Yes |
| Offline caching | Yes (better than the original) |
| Share target | Yes |
| Push notifications | Yes — you supply VAPID keys and a sender |
| Push history (`progressierSavedPushNotifications`) | Yes |
| App badge | Yes |
| Protocol handlers | Yes |
| Theming and 10 languages | Yes |
| Apple splash screens | Yes — generated on iOS Safari |
| Windows tiles and favicon | Yes |
| Analytics dashboard | No — optional event beacon only |
| Push scheduling, segments, campaigns | No — your backend |
| App Store / Play Store / TWA packaging | No |
| QR-code install dialog | Yes — local `qrcode.js`, no external service |
| A/B tests, funnel reports | No — your backend |
| Announcements / newsfeed UI, cookie banner, pull-to-refresh | No |

See `PARITY.md` for the class-by-class breakdown and exact sizing table.

If you need push campaigns or analytics, the client API is already there; only the
server side is yours to run.

---

## License

MIT — see [`LICENSE`](LICENSE).

Bundled third-party code:

- `qrcode.js` — [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  2.0.4, MIT, © 2009 Kazuhiko Arase. Kept verbatim with its license header.
- `examples/push-server/` uses the `web-push` npm package at runtime; it is not
  vendored here.

The icons in `icons/` are sample artwork from the reference deployment. Replace
them with your own before shipping — they are not covered by the MIT grant.

