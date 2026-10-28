# Integrating into staff.you.ge

This is the short version for the real deployment. `README.md` has the full API;
`PARITY.md` explains what matches the old Progressier client.

## 1. What to upload

Keep the paths exactly as-is:

```
/manifest.webmanifest
/progressier.js          <- service worker, do not rename
/pwa.js
/pwa.css
/offline.html
/offline.css
/offline.js
/browserconfig.xml
/favicon.ico
/icons/
  icon-192.png
  icon-512.png
  icon-144.png
  icon-150.png
  icon-maskable-192.png
  icon-maskable-512.png
  apple-touch-icon.png
  favicon-32.png
```

`progressier.js` must stay at the root so the registration that old visitors
already have is replaced in place. Upload assets before changing the HTML.

## 2. Replace the old tags

Remove these two lines:

```html
<link rel="manifest" href="https://progressier.app/HIPSBNVemXtM8VMwRfWs/progressier.json"/>
<script defer src="https://progressier.app/HIPSBNVemXtM8VMwRfWs/script.js"></script>
```

Use the block in `snippet.html`. Minimum version:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<meta name="theme-color" content="#ffffff" />
<script src="/pwa.js" defer></script>
```

`pwa.js` fills in the rest of the meta tags, adds the manifest if it is missing,
and mounts the Progressier-compatible buttons. Do not load the old script and
`pwa.js` on the same page.

## 3. Server headers

The two that matter:

```
/manifest.webmanifest   Content-Type: application/manifest+json
/progressier.js         Content-Type: application/javascript
                        Cache-Control: no-cache
                        Service-Worker-Allowed: /
```

Also serve `/pwa.js`, `/pwa.css` and the offline files with `no-cache` or a
short max-age. nginx/Apache blocks are in `README.md`.

## 4. Verify the live site

```bash
node scripts/verify-deployment.mjs https://staff.you.ge
```

It checks the HTML for leftover `progressier.app` tags, the manifest MIME type,
every icon's real PNG dimensions, the service worker headers, the offline page,
and the Windows tile assets. Exit code `1` means a hard failure.

## 5. Install test

1. Open `https://staff.you.ge` in Chrome/Edge on desktop and Android.
2. Check DevTools → Application → Manifest: no errors, installable.
3. Check Application → Service Workers: `/progressier.js` is activated.
4. Install, close, relaunch from the icon.
5. On iOS Safari: Share → Add to Home Screen, then launch. The splash screen is
   generated on the first Safari visit and used on the next launch.
6. Turn the network off and reload: the offline page should appear.

Chrome only shows its own install prompt after it decides the site is eligible.
That is normal; it is not controlled by this kit. Use `PWA.promptInstall()` from
your own button, or the `.progressier-install-button` markup.

## 6. Push (optional)

Generate keys:

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

A runnable sender lives in `examples/push-server/`. Without those two
attributes, subscribe buttons stay visible but show “notifications are not
configured” instead of asking for permission.

## 7. Content Security Policy

- The install-help sheet uses a shadow root with an inline `<style>`. If your CSP
  blocks inline styles, pass `data-csp-nonce="..."` to `pwa.js`.
- iOS splash screens are generated as `data:` images. Allow `data:` in `img-src`
  if you want them, or set `data-no-splash` and supply static
  `apple-touch-startup-image` links yourself.
- `pwa.js` and `progressier.js` are external files, so `script-src 'self'` is
  enough for them.
- If you use `data-analytics`, allow that endpoint in `connect-src`.
- Push requires `worker-src 'self'` (or `script-src 'self'`) plus the normal
  `connect-src` for your push service if you ever call it from the page.

## 8. Updating later

The service worker uses `VERSION` in `progressier.js`. When you change any
cached file:

1. Bump `VERSION` (`1.0.1` → `1.0.2`).
2. Upload the changed files.
3. Reload. With `data-auto-update`, the new worker activates automatically;
   otherwise `PWA.showReloadPrompt()` / the built-in prompt asks the user.

The old worker is replaced automatically because the script path is unchanged.

## 9. Rollback

Keep a copy of the current files. To roll back, restore the files and bump
`VERSION` again so browsers fetch the restored worker. Do not delete
`/progressier.js`: visitors would keep the last worker until their next visit.
If you must remove the PWA entirely, restore the old Progressier tags and keep a
worker at `/progressier.js` that calls `self.registration.unregister()`.

## 10. Still backend/proprietary

Not included, because they were Progressier services rather than client code:

- hosted push campaigns, scheduling, segments
- analytics dashboard, A/B tests
- dashboard announcements / newsfeed
- user accounts and billing
- App Store / Play Store / TWA packaging
- QR install flow, cookie consent, pull-to-refresh

See `PARITY.md` for the full list and the sizing/feature comparison.
