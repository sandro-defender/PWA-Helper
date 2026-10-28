# Parity report: Progressier vs this kit

Compared artifacts:

| Original | Size |
| --- | --- |
| `script.js` | 323,961 bytes, minified, 36 classes |
| `sw.js` | 5,193 bytes |
| `progressier.json` | 958 bytes |

Local implementation: `pwa.js`, `progressier.js`, `pwa.css`, `manifest.webmanifest`.
This is a clean-room reimplementation. The original bundle cannot be self-hosted
because it resolves a Progressier `appId` and loads configuration from their
backend; copying it would still require their service.

---

## Component sizing (matches original CSS)

| Component | Original | Local |
| --- | --- | --- |
| Install banner | full-width top bar, `padding:10px 0`, z `2147483644` | same |
| Install banner icon | `45×45`, radius `10px` | same |
| Install banner buttons | height `40px`, radius `30px`, padding `0 30px` | same |
| Install banner text | `15px`, `13px` under 550px | same |
| Install banner desktop | `max-height:100px`, single row | same |
| Push banner | `510px`, centered, slide from `top:-500px` | same |
| Push banner ≤991px | `450px`, radius `30px`, icon `50×50` | same |
| Push banner ≤550px | `95vw`, text `14px` | same |
| Push banner icon | `70×70`, radius `15px` | same |
| Push banner buttons | `min-height:50px`, radius `30px`, padding `0 20px` | same |
| Push banner z-index | `2147483645` | same |
| Install button inner | icon `20×20` + label `padding:0 15px` | same |
| Subscribe button states | eligible / subscribed / denied / incompatible | same |
| Reload prompt | full-screen `rgba(0,0,0,.33)`, z `2147483647`, bottom `20px` | same |
| Reload prompt button | padding `10px 20px`, radius `20px`, `12px/600` | same |
| Offline alert | bottom-left `470×150`, radius `10px`, border `2px #f5f5f5`, z `2147483647` | same (DOM instead of iframe) |
| Offline alert ≤991px | `calc(100vw - 20px) × 170px` | same |
| Offline alert text | `18px` title, `14px/300` body | same |
| Flow / welcome | `500px × 500px` max, radius `30px`, border `1px` | same |
| Flow header | width `90%`, padding `20px` | same |
| Flow close | `40×40`, circular | same |
| Flow title | `17px` | same |
| Flow body | `15px`, line-height `26px` | same |
| Offline page | — (original had none) | local page with an external CSS/JS so strict CSP works |

Breakpoints match the original: `992px`, `991px`, `800px`, `550px`.

---

## JavaScript API

| Original | Local |
| --- | --- |
| `progressier.install()` / `prompt()` | `PWA.promptInstall()` + shim |
| `progressier.checkIfStandalone()` | `PWA.isStandalone()` + shim |
| `progressier.register()` / `ready` | `PWA.register()` / `PWA.ready` + shim |
| `progressier.setAppBadge()` / `clearAppBadge()` | `PWA.setBadge()` / `PWA.clearBadge()` + shim |
| `progressier.push.isCompatible/isSubscribed/isDenied/prompt` | shim + `PWA.pushSupported()`, `PWA.subscribePush()` |
| `progressier.wording.get()` | `PWA.wording.get()` |
| `progressier.installBanner` / `pushBanner` | `PWA.showInstallBanner()` / `PWA.showPushBanner()` |
| `progressier.detection.*` | `PWA.getState()`, `isIOS()`, `isSafari()`, shim `detection` |
| `progressier.utils.wait()` | shim `utils.wait()` |
| `ProgressierReloadPrompt` | `PWA.showReloadPrompt()`, `PWA.enableReloadPrompt()` |
| `ProgressierFlow` / `WelcomeScreen` | `PWA.showFlow()`, `PWA.showWelcome()` |
| `ProgressierOfflineAlert` | `PWA.showOfflineAlert()`, `PWA.enableOfflineAlert()` |
| `ProgressierNewsfeed` data source | `PWA.getNotifications()` / `PWA.markNotificationsRead()` |
| `pwaredirect=` decoding | implemented, same-origin by default |
| Custom events | `pwa:installable`, `pwa:installed`, `pwa:update`, `pwa:share`, `pwa:event` |

### HTML compatibility

| Original attribute / class | Local |
| --- | --- |
| `.progressier-install-button` | auto-mounted, 150 ms scan |
| `.progressier-subscribe-button` | auto-mounted, 150 ms scan |
| `data-behavior` (`disable`/`hide`) | supported |
| `data-hide-standalone` | supported |
| `data-allow-ios` | supported |
| `data-allow-samsung` | supported |
| `data-install` / `data-installed` | supported; the default English values localize like the original |
| `data-icons` | supported; desktop/mobile icon chosen by `screen.width`, as before |
| `data-eligible` / `data-subscribed` / `data-blocked` | supported; default English values localize |
| `.captured` / `.initialized` classes | added, same names |

Local additions (not in the original): `[data-pwa-install]`,
`[data-pwa-hide-standalone]`, `[data-pwa-show-standalone]`, `PWA.onChange()`.

---

## Wording languages

Both support UI wording in English, French, Italian, German, Swedish, Dutch,
Norwegian, Danish, Estonian and Spanish. Local translations are original text,
not copied from Progressier. Unknown keys fall back to English.

---

## Meta tags and iOS splash

| Item | Original | Local |
| --- | --- | --- |
| Manifest link | injected / checked | injected / replaced if it points at Progressier |
| `theme-color` | injected | injected if missing, updated when configured |
| `application-name` | yes | yes |
| `apple-mobile-web-app-title` | yes | yes |
| `apple-mobile-web-app-capable` | yes | yes |
| `mobile-web-app-capable` | yes | yes |
| `apple-mobile-web-app-status-bar-style` | yes | yes (`default`) |
| `apple-touch-fullscreen` | yes | yes |
| Windows tile meta | yes | yes (`msapplication-*`) |
| Legacy X5 / full-screen meta | yes | yes |
| `al:web:url` | yes | yes |
| `viewport-fit=cover` | fullscreen + overwrite only | opt-in with `data-viewport-fit` |
| `apple-itunes-app` | when configured | `data-itunes-app-id` |
| Apple splash screens | generated per current device | generated per current device, portrait + landscape |
| `apple-touch-icon` | 180 px | 180 px local |
| `favicon.ico` / Windows tile image | backend icons | local multi-size ICO, 144/150 px tiles, `browserconfig.xml` |

The splash generator uses the current `screen.width`/`screen.height` and pixel
ratio, draws the icon at 20% (portrait) or 24% (landscape) of the screen on the
theme-color background, and adds `apple-touch-startup-image` links with the same
media-query format as the original. It runs only in iOS Safari (not standalone).
The generated image is a `data:` URL, so a strict CSP needs `data:` in `img-src`
or `data-no-splash`.

---

## Service worker

| Feature | Original | Local |
| --- | --- | --- |
| Share target | yes (`fileid`, `url`, `title`, `text`) | yes, both those names and `shared*` aliases |
| Push display | yes | yes |
| Notification history | IndexedDB `progressierSavedPushNotifications` | same database and store |
| Badge from `data.unread` | yes | yes |
| Badge from open notifications | yes | yes |
| Notification click focus/navigate | yes | yes |
| Action-specific URLs | yes | yes |
| Subscription renewal | no | yes (`pushsubscriptionchange`) |
| Offline caching | none | network-first pages, SWR assets, offline page |
| `skipWaiting` on install | yes (immediate) | waits for `applyUpdate()` to avoid mixed versions |

The original worker did no caching. Offline support is an intentional improvement,
not a parity gap.

---

## Feature matrix by original class

| Original class | Status |
| --- | --- |
| `ProgressierObj` | Core boot reimplemented |
| `ProgressierTheming` | CSS variables + `PWA.applyTheme()` |
| `ProgressierBackdrop` | Modal backdrop in install help; flow uses its own overlay |
| `ProgressierBanners` | Install/push banners, cookie intervals, platform targeting |
| `ProgressierPushBanner` | Implemented |
| `ProgressierInstallBanner` | Implemented |
| `ProgressierCustomEvents` | `pwa:*` events |
| `ProgressierBubbleData` | Not applicable (Progressier backend data) |
| `ProgressierDetection` | Standalone, iOS, Safari, desktop, push support |
| `ProgressierProtocol` | `web+pwa`, `web+loldwyhv`, `pwaprotocolredirect`, `pwaredirect` |
| `ProgressierText` | 10-language wording table |
| `ProgressierReloadPrompt` | Implemented |
| `ProgressierFlow` | Generic modal, iOS help sheet, QR install dialog; platform-specific instruction screens partial |
| `ProgressierWelcomeScreen` | Implemented (`data-welcome`) |
| `ProgressierOfflineAlert` | Implemented as DOM toast |
| `ProgressierToolbox` | Partial (icons inline, no Progressier toolbox) |
| `ProgressierMeta` | Manifest, Apple meta, Windows tiles, runtime splash screens |
| `ProgressierManifest` | Static manifest (original is also static) |
| `ProgressierAnalytics` | Optional beacon only, no dashboard |
| `ProgressierUtils` | Only utilities used by this kit |
| `ProgressierInvalid` | No |
| `ProgressierAttribution` | No (Progressier branding) |
| `ProgressierData` | No backend config store |
| `ProgressierPullToRefresh` | No |
| `ProgressierCookies` | Banner dismissal cookies only; no consent banner |
| `ProgressierAnnouncement` | No (backend campaign content) |
| `ProgressierNewsfeed` | Notification history, no feed UI |
| `ProgressierPushNotifications` | VAPID subscribe + send integration |
| `ProgressierUser` | No user accounts |
| `ProgressierNative` | Standalone/TWA detection only |
| `ProgressierSubscribeButtons` | Implemented |
| `ProgressierSubscribeButton` | Implemented |
| `ProgressierInstallButtons` | Implemented |
| `ProgressierInstallButton` | Implemented |
| `ProgressierSw` | Implemented + offline caching |
| `ProgressierForPromoOnly` | No (Progressier promo mode) |

---

## Genuine gaps (server-side or proprietary)

These cannot be reproduced by static files because they are Progressier services,
not client code:

- hosted push campaigns, scheduling, segments and delivery
- analytics dashboard, A/B tests, funnel reports
- dashboard-configured announcements / newsfeed content
- account/user APIs and billing
- App Store / Play Store / TWA packaging
- pull-to-refresh (site-specific; can be added on top)
- cookie-consent banner
- Progressier attribution/promo mode
- exact wording strings and translations from their dashboard

Everything else — install UI, buttons, banners, modal, welcome, offline alert,
reload prompt, QR install dialog (local `qrcode.js` + centered logo),
badges, share target, push display/history, protocol handlers, theming, meta
tags, splash screens, sizing and breakpoints — is implemented locally with no
third-party requests.

---

## Deployment tooling added for staff.you.ge

| File | Purpose |
| --- | --- |
| `snippet.html` | Copy-paste `<head>` block replacing the two Progressier tags |
| `INTEGRATION.md` | Upload order, headers, CSP, update and rollback steps |
| `scripts/verify-deployment.mjs` | Checks live HTML, manifest MIME, icon dimensions, SW headers, offline assets |
| `scripts/generate-vapid-keys.mjs` | Creates a P-256 VAPID pair for Web Push |
| `examples/push-server/` | Runnable Node sender with subscribe/send/delete endpoints |
| `browserconfig.xml`, `favicon.ico`, `icon-144.png`, `icon-150.png` | Windows tiles and favicon |
