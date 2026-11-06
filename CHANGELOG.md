# Changelog

## 0.1.0 — 2026-11-06 (initial release)

First release of **`@youge/assistant-sdk`** — the framework-independent SDK
core for You.Ge Assistant (npm org `youge`, scope `@youge`; corrects the
never-published working name `@you-ge/assistant-sdk`).

- **Public API:** `YouGeAssistant.create()` / `.attach()` / `.getGlobal()`
  shared-singleton lifecycle with `getState`, `subscribe`, `configure`,
  `runDiagnostics`, `requestInstall`, `dismiss`, `acknowledge`, `destroy`;
  subpath exports `./domain`, `./config`, `./diagnostics`, `./installation`,
  `./react`, each with paired TypeScript declarations. Notification priority
  ladder frozen: `1 critical → 2 auth → 3 backup → 4 install → 5 info`.
- **Configuration:** data-only `publishedConfig` validation (schema `1`) with
  bundled defaults → validated published revision → project overrides →
  Last-Known-Good fallback; executable-JS payloads, dangerous URLs and
  secret-shaped keys are rejected before they reach state or storage.
- **Architecture:** zero runtime dependencies (`react` optional peer for the
  `useSyncExternalStore` adapter only), ESM-only, buildless `src/` runtime,
  wildcard-free `exports` map (internal sources unreachable), `sideEffects:
  false`, no `fetch`, no polling, no telemetry, no service-worker registration.
- **Packaging:** MIT license, progressive-disclosure README (quick start →
  subpath table → config/security pipeline → API reference → host-integration
  example), `files` whitelist (19 files, ~33 kB packed / ~132 kB unpacked),
  `publishConfig.access: "public"`, `prepublishOnly` validation gate.
- **Release engineering:** `packages/assistant-sdk/scripts/validate-package.mjs`
  (identity, version sync, export map + declarations, tarball contents,
  dependency policy, source hygiene, publishing-gate checks) wired into
  `npm run check`, the `check` workflow and `prepublishOnly`; manual-only
  `sdk-release-prep.yml` release workflow with explicit-authorization publish
  gates; release runbook and registry decision in
  [`packages/assistant-sdk/RELEASE.md`](packages/assistant-sdk/RELEASE.md);
  vendored-copy migration guide in
  [`packages/assistant-sdk/MIGRATION.md`](packages/assistant-sdk/MIGRATION.md).

Release prepared per [`RELEASE.md`](packages/assistant-sdk/RELEASE.md) §4;
npm publication is executed separately by the repository owner (runbook
steps 3–5) and is **not** claimed by this entry. The detailed development log
follows under *Unreleased*.

## Unreleased

- **Package rename:** the SDK's npm identity is corrected to
  **`@youge/assistant-sdk`** (was `@you-ge/assistant-sdk`, based on an
  incorrect assumption about the organization scope). The final identity is
  confirmed by the project owner: npm user `you-ge`, npm org `youge`, scope
  `@youge`. Nothing was ever published under the old name, so the rename is
  pre-publication and breaks no consumer. Registry verification (2026-11-06):
  `@youge/assistant-sdk` unpublished (404), zero packages under `@youge/*`
  (no third-party conflict), org/scope `youge` exists. Updated consistently
  across package metadata, validation scripts and contracts
  (`validate-package.mjs`, `scripts/check.mjs`), the generated-bundle sync
  script and source headers, tests, the React example (imports, dependency
  key and lockfile), the release workflow header, and all documentation
  (README, RELEASE, MIGRATION, AGENTS, architecture/audit docs, design-skill
  record). Unrelated You.Ge branding is untouched (`you-ge-assistant` root
  package, `YouGeAssistant` API, `youge-assistant:*` storage keys, product
  name You.Ge, `staff.you.ge`). At that point the package still carried
  `"private": true` with all publishing guards intact (the lock is removed
  later, in the 0.1.0 release PR); nothing was published, released or tagged.

- Prepared `@youge/assistant-sdk` for versioned distribution (**release
  preparation only — publishing stays disabled, nothing was published, no
  release or tag created**):
  - Package metadata reviewed and extended (`packages/assistant-sdk/package.json`):
    kept `@youge/assistant-sdk@0.1.0`, ESM-only with paired `.d.ts` per export
    entry, explicit subpath `exports` map with no wildcards (deep imports of
    internal sources stay blocked), `publishConfig.access: "public"`,
    `homepage`/`bugs` added, zero runtime dependencies preserved (`react`
    remains an optional peer). The `"private": true` flag served as the
    accidental-publish lock at the time and is documented as such (removed in
    the 0.1.0 release PR per the runbook).
  - New release gate `packages/assistant-sdk/scripts/validate-package.mjs`
    (zero dependencies, offline): package identity, semver, version
    synchronization (`package.json` ↔ `SDK_VERSION` ↔ `KIT_COMPAT_VERSION` ↔
    runtime version), export-map targets + TypeScript declarations, `files`
    whitelist and `npm pack --dry-run` contents (runtime files only), README/
    LICENSE presence, dependency policy, source hygiene (package-relative
    imports only), and the `private: true` guard. Wired into `npm run check`,
    the `check` workflow and as `prepublishOnly` on the package.
  - Publishing-destination evaluation documented in
    `packages/assistant-sdk/RELEASE.md` with the recommendation **public npm**
    (Cloudflare builds need no auth; GitHub Packages would force a
    `@sandro-defender` scope rename, auth on every install, and token plumbing
    into Cloudflare builds — the secure configuration required for that path is
    recorded there). The registry/name situation recorded at preparation time
    (old scope unregistered) was superseded by the confirmed identity — see the
    package-rename entry below.
  - Release procedure documented (`RELEASE.md`): release runbook with
    version-bump rules, guard-removal checklist and post-publish smoke tests,
    plus the three independent publishing locks (package `private` flag,
    manual-only `workflow_dispatch` release workflow with explicit-approval
    gates, no registry credentials).
  - New `.github/workflows/sdk-release-prep.yml` (**manual dispatch only**, no
    push/PR/merge triggers): full release checklist — SDK tests, build/sync
    verification, package + version validation, "version not already published"
    check and consumer build. The `publish` job is structure-only and requires
    action=publish + confirm input + `SDK_RELEASE_ENABLED` repo variable
    (unset) + protected `sdk-npm-publish` environment + `NPM_TOKEN` secret
    (not configured).
  - Consumer migration guide `packages/assistant-sdk/MIGRATION.md`: how
    `staff.you.ge` replaces its vendored `packages/assistant-sdk` copy (the
    PR #249 vendor pin recorded in its `VENDORING.md`) with the published
    package — drop-in import mapping, exact-version pin, verification
    checklist, stateless rollback and compatibility guarantees (SDK `0.1.0`,
    kit compat `1.0.5`, config schema `1`). `staff.you.ge` was not modified.
  - SDK README updated: release status, registry consumption (ESM-only policy),
    versioning policy, and the validation commands.

- Refined the floating assistant entry point (visual only, no API change):
  - `assistant-widget.css`: `.youge-fab` is now a **true circle**
    (`border-radius: 50%` on a square 56px box, 54px below 480px) with a calm,
    low-saturation fill, a hairline ring, one short elevation shadow and a soft
    inner sheen that is itself circular — no glow, no blur, no `@keyframes`.
    Measured glyph contrast: 9.45:1 (light) and 11.01:1 (dark/auto-dark), up
    from 5.41:1 and **2.23:1** (the old light-blue dark fill was below the 3:1
    non-text floor).
  - The button turns the toolkit's **red only for actionable events**: its
    `data-tone` is the existing `state.badge.tone`, and `critical`, `auth` and
    `install` (connection loss, DNS failure, dead primary endpoint, session
    attention, an available install) paint it with `--youge-critical`. `info`,
    `backup` and `none` stay neutral, so an optional update, a restored
    connection, a feature announcement, a backup endpoint already serving the
    app, a diagnostic in progress, an idle or dismissed assistant never read as
    urgent. No new state, no second source of truth, no polling; the count badge
    (inverted for legibility on red) and the `aria-label` phrase repeat the
    message so color is never the only signal.
  - Two shared motion tokens replace one duration everywhere
    (`--youge-motion-fast: 160ms` for hover/press feedback,
    `--youge-motion-state: 240ms` for the state color/border/shadow change);
    hover travel dropped to 1px and press to `scale(0.98)`;
    `prefers-reduced-motion` removes both durations and the travel while the
    color state still changes.
  - `example/`: the sample launcher keeps its circular geometry but clips the
    `ElectricLogo` layer to the disc (`inset: 0` + `overflow: hidden` +
    `border-radius: 50%`, no `filter: drop-shadow`), loses its blurred outer
    halo, dims the spotlight/glow/flicker/strands and the `GlareHover`
    highlight, no longer chases the cursor, and mounts only while hovered,
    focused or open — an idle assistant now runs no animation loop at all. Its
    fill follows the same actionable-tone list as the shipped widget, asserted by
    a parity test.
  - Tests: `tests/assistant-widget.test.mjs` gained 7 and
    `tests/example-ui.test.mjs` 4 assertions covering the circle, the subdued
    resting state, computed WCAG contrast of the FAB tokens in light/dark/
    auto-dark, the actionable-tone list (and that `info`/`backup`/`none` never
    match), the motion tokens, reduced-motion behavior, the tone following real
    state through dismiss/connectivity changes, and the accessibility contract.
- Fixed the defects found by the November 2026 audit (full findings table in the
  bug-fix pull request). Summary by area:
  - **React adapter**: `getExternalStoreBindings` memoizes the resolved assistant
    instance and caches selector results, so a getter that attaches/configures no
    longer re-configures on every render (`useSyncExternalStore` calls
    `getSnapshot` per render) and subscribers stop re-rendering on unchanged
    state. Selector identity is now stable across emits.
  - **Toolkit rendering**: install-button labels (from `data-install`,
    `data-installed` or config) are HTML-escaped before being composed into the
    button's `innerHTML`, so an untrusted attribute value can no longer inject
    markup into the install button or the push subscribe button. The icon markup
    stays a fixed internal SVG constant.
  - **Navigation safety**: new `safeNavigationUrl` guard (SDK root + `./domain` +
    `DomainResolver`, plus `window.YouGeDomain` in `domain-config.js`) accepts only
    http(s) absolute URLs and root/relative paths. The service worker routes every
    push-payload notification target (including per-action URLs) through it, so a
    payload can no longer drive `client.navigate()`/`openWindow()` into
    `javascript:`/`data:`/`vbscript:` or a protocol-relative cross-origin escape.
  - **Recovery data**: a Last-Known-Good record must declare the `projectId` it is
    read under; an unscoped or foreign record is refused instead of being trusted
    as this project's config, and cross-project config leakage is closed.
  - **Update notice**: the toolkit adapter seeds `network.updateAvailable` from
    `hasUpdate`, so the "apply update" notice and action appear for an already
    waiting worker instead of staying silent.
  - **Notifications**: `requestNotificationPermission` supports the callback-only
    `Notification.requestPermission` signature (older Safari/WebKit), resolves
    exactly once and never throws, so a granted permission is not read as
    `undefined` and subscription flows keep working.
  - **Widget**: notice action buttons reuse the toolkit's delegated hooks
    (`data-pwa-install`, `data-pwa-diagnostics`) and carry the action's real
    wording instead of an inert "Open"; Escape yields to an open toolkit dialog;
    host-supplied appearance values are re-validated before reaching the DOM (no
    `undefinedpx` offsets, only `#hex` brand colors, whitelisted positions/themes);
    `.youge-btn-small` meets the 44px touch-target floor; the auth badge gains
    AA-contrast ink in dark and auto-dark themes.
  - **Offline page**: the connection badge is now a polite atomic live region
    (`role="status" aria-live="polite" aria-atomic="true"`) with the decorative dot
    hidden from assistive tech, so "Connection restored" is announced.
  - **Example app**: the React notice actions use the same toolkit hooks and
    labels, replacing dead "Open" buttons.
  - **Tests/docs**: regression coverage for every item above (`npm test` now runs
    121 tests), README/`react.d.ts` wording on hook resolution, `WIDGET.md`
    interaction notes; the offline example (`example/example.js`) install-button and
    permission paths are covered by the vm-backed install-experience suite.
- Extracted the framework-independent **Phase 2 SDK package** locally at
  `packages/assistant-sdk/` (`@youge/assistant-sdk` v`0.1.0`, `"private": true`
  — prepared for future npm publishing without publishing, releasing or tagging):
  modular ESM core (`core`, `domain`, `config`, `diagnostics`, `installation`,
  `assistant`, `adapters`), subpath exports (`.`, `./domain`, `./config`,
  `./diagnostics`, `./installation`, `./react`), `.d.ts` TypeScript declarations,
  data-only `publishedConfig` + project-scoped Last-Known-Good (`LKG`) fallback
  with executable-code and secret rejection, deterministic browser state sync
  (`scripts/sync-sdk-browser.mjs` → `assistant-state.js`), `example/` consumption
  via `file:../packages/assistant-sdk`, standalone SDK tests
  (`packages/assistant-sdk/tests/`) and toolkit integration tests
  (`tests/sdk-integration.test.mjs`). All `window.PWA`, `/progressier.js`,
  manifest, DNS diagnostics and widget behaviors remain backward-compatible; no
  standalone dashboard, remote config fetch, production API failover or
  `staff.you.ge` change was added.
- Added the You.Ge Assistant platform foundation: a Phase 0 re-audit
  (`FOUNDATION_AUDIT.md`), the future dashboard/SDK/multi-domain/configuration/
  security/failover architecture with a diagram and phased roadmap
  (`ASSISTANT_ARCHITECTURE.md`), and a frozen installation experience record plus
  future SDK install contract (`INSTALLATION_EXPERIENCE.md`). No dashboard, SDK
  package, central config service, failover, `staff.you.ge` integration, npm
  publish or production deployment was added.
- Applied the ui-ux-pro-max-skill design system and adopted three zero-dependency
  React Bits TypeScript + CSS components (`SpotlightCard`, `GlareHover`,
  `LatticeLoader`) in the isolated example; documented every adoption decision
  in `DESIGN_FOUNDATION.md`. Incremental install-sheet and banner accessibility
  improvements (visible focus, 44px close target, contrast-safe note,
  `aria-labelledby`/`aria-describedby`, reduced motion) preserve all behavior.
- Implemented the **Intelligent Floating Assistant** as a reusable core widget:
  `assistant-state.js` (one centralized, event-driven state model and
  configurable SDK API), `assistant-widget.js` / `assistant-widget.css`
  (dependency-free DOM renderer), and a React renderer in `example/src/main.jsx`
  using `useSyncExternalStore` plus the already-vendored React Bits
  `GlareHover`, `SpotlightCard` and `LatticeLoader` sources. Real-condition
  badges, the fixed 1–5 priority ladder, in-place panel, dismissal/acknowledgement,
  project-scoped repeat suppression, safe-area/reduced-motion support and
  single-flight diagnostics are covered by `WIDGET.md` and 24 new tests in
  `tests/assistant-widget.test.mjs`. `pwa.js` install delegation and the single
  `progressier.js` worker remain intact; no dashboard, remote config service,
  production failover or `staff.you.ge` integration was added.
- Added `tests/install-experience.test.mjs` (DOM-harness verification of the
  existing install flow, platform detection, dismissal and worker registration)
  and `tests/foundation-contracts.test.mjs` (manifest, offline, identity,
  security and design contracts). Added an isolated `tsc --noEmit` type-check
  gate for the React example; extended `scripts/check.mjs` and CI accordingly.
  No existing tests were removed or weakened.

- Rebuilt the GitHub Pages user-facing example with an isolated React/Vite app and
  a fixed, interactive React Bits ElectricLogo assistant launcher, persistent
  logo mark, and quick actions; clarified local-storage failures in the sample
  check-in/checklist interactions and added UI regression tests. React, Vite and
  OGL remain out of the core toolkit dependencies.

## 1.0.5 — You.Ge Assistant multi-domain upgrade

- Rebranded the package and default application identity to You.Ge Assistant.
- Added centralized hostname/origin/subdomain/base-path detection and a validated,
  public domain/subdomain configuration registry with safe unknown-host defaults
  and per-domain installation/offline/sharing/push/badge/QR/diagnostic switches.
- Added a host-aware manifest response helper and Cloudflare Pages Functions
  adapter, retaining a static fallback and the existing legacy manifest ID.
- Kept the `/progressier.js` worker path, public PWA API, and legacy IndexedDB
  names. Added hostname/registered-scope/version cache namespaces and scoped
  cleanup; only explicitly public HTML is cached or migrated, and older
  shared-name caches are retained safely.
- Updated offline fallback branding/context, scoped retry URLs, and offline DNS
  recovery guidance.
- Added on-demand Cloudflare DoH A/AAAA diagnostics for the active hostname,
  response validation, bounded retries, deduplication, timeout handling and
  cautious classifications. Added Android Private DNS and iOS DNS-only recovery.
- Added Node unit tests for host resolution, manifest responses and mocked DNS
  outcomes; extended CI/static checks and refreshed multi-domain deployment docs.

### Validation status

The automated tests are mock/unit tests. They do not verify real ISP DNS
interference, deployed Cloudflare CORS behavior, production host routing, or
browser installation on physical Android/iOS devices. Those remain deployment
acceptance checks.
