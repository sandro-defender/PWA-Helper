# `@youge/assistant-sdk`

Framework-independent SDK core for **You.Ge Assistant**: centralized state,
multi-domain resolution, data-only configuration validation with Last-Known-Good
fallback, explicit on-demand DNS diagnostics integration, and existing PWA
installation integration.

> **Package status (0.1.0 — release-ready):** `@youge/assistant-sdk@0.1.0`
> is extracted, tested, validated and prepared for publication to the public
> npm registry (org `youge`, scope `@youge`). The release is **prepared but
> not yet published**: publication is executed by the repository owner via
> the approved runbook ([`RELEASE.md`](RELEASE.md) §4 steps 3–5) and is gated
> by the manual-only `sdk-release-prep` workflow. Until then, consume it
> locally via `"file:../packages/assistant-sdk"` or workspace linking.
> Release procedure and registry decision: [`RELEASE.md`](RELEASE.md).
> Vendored-copy → package migration (staff.you.ge): [`MIGRATION.md`](MIGRATION.md).

---

## Architecture & Separation of Concerns

| Layer | Responsibility | Dependencies |
| --- | --- | --- |
| **SDK core** (`@youge/assistant-sdk`) | Public initialization (`create`, `attach`), data-only config & LKG validation, multi-domain resolution & manifest generation, centralized assistant state & subscriptions, connectivity/endpoint/session updates, explicit diagnostics & install delegation, `.d.ts` TypeScript contracts | **Zero** runtime dependencies (no React, Vue, Angular, or bundler runtime) |
| **PWA toolkit** (`pwa.js`, `/progressier.js`, `dns-diagnostics.js`) | `window.PWA` APIs, `beforeinstallprompt` / iOS / QR install UI, single `/progressier.js` service worker, host+scope+version cache isolation, offline fallback, Cloudflare DoH A/AAAA checks | Dependency-free classic browser scripts |
| **UI / Widget layer** (`assistant-widget.js`, `example/`) | Floating assistant DOM renderer (`assistant-widget.js`) and optional React external-store adapter (`@youge/assistant-sdk/react` + `example/`) | SDK works independently of any widget or UI framework |

---

## Installation & Consumption

### From npm (after publication)

```bash
npm install @youge/assistant-sdk@0.1.0
```

Pin the **exact version** (no `^`/`~`) if you want vendor-pin semantics — the
same deliberate-upgrade workflow as a vendored copy. See
[`MIGRATION.md`](MIGRATION.md) for replacing a vendored `packages/assistant-sdk`
copy.

The package is **ESM-only** (`"type": "module"`) and ships native ESM with
paired `.d.ts` declarations — no build step, no transpiled CommonJS. Vite,
Next, webpack, Rollup and esbuild consume it directly; Node ≥ 18 can
`import` it (CommonJS hosts can `await import('@youge/assistant-sdk')`).
The `exports` map is the only import surface: deep paths like
`@youge/assistant-sdk/src/...` are intentionally blocked.

### Local (repository checkout / vendored copy)

Inside another package in this repository or a sibling local project:

```json
{
  "dependencies": {
    "@youge/assistant-sdk": "file:../packages/assistant-sdk"
  }
}
```

### Subpath Exports

| Import path | Purpose |
| --- | --- |
| `@youge/assistant-sdk` | Full public API (`YouGeAssistant`, `createAssistant`, `attachAssistant`, config, domain, diagnostics, installation, toolkit bridge) |
| `@youge/assistant-sdk/domain` | Multi-domain resolution, validation, and scoped Web App Manifest generation |
| `@youge/assistant-sdk/config` | Data-only `publishedConfig` validator, Last-Known-Good storage helpers, and override resolver |
| `@youge/assistant-sdk/diagnostics` | Single-flight diagnostics integration controller and classification helpers |
| `@youge/assistant-sdk/installation` | `window.PWA` state reader and install prompt delegation |
| `@youge/assistant-sdk/react` | Optional React 18/19 `useSyncExternalStore` adapter (zero runtime `react` import in SDK) |

All entry points ship paired `.d.ts` TypeScript declarations.

---

## Quick Start

### 1. Isolated instance (`YouGeAssistant.create`)

Works in any JavaScript runtime (browser ESM, Vite/Next/SvelteKit, or Node/SSR tests):

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const assistant = YouGeAssistant.create({
  projectId: 'my-project',
  domain: window.location.hostname,
});

const state = assistant.getState();

const unsubscribe = assistant.subscribe((nextState) => {
  console.log('Badge:', nextState.badge.count, nextState.badge.label);
});

// Clean up listeners when unmounting or tearing down:
unsubscribe();
assistant.destroy();
```

### 2. Shared page singleton (`YouGeAssistant.attach`)

When a page also loads `pwa.js`, `assistant-state.js`, or `assistant-widget.js`,
use `YouGeAssistant.attach()` so ESM modules and classic `<script>` tags share
**one** centralized state instance and **zero** duplicate listeners:

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const assistant = YouGeAssistant.attach({
  projectId: 'workspace-web',
  position: 'bottom-right',
});
```

### 3. Optional React 18/19 integration (`@youge/assistant-sdk/react`)

Inject `useSyncExternalStore` from the host app's `react` package — the SDK core
never imports React:

```tsx
import { useSyncExternalStore } from 'react';
import { YouGeAssistant } from '@youge/assistant-sdk';
import { createUseAssistant } from '@youge/assistant-sdk/react';

const useAssistant = createUseAssistant(
  useSyncExternalStore,
  () => YouGeAssistant.attach({ projectId: 'workspace-web' })
);

export function ConnectionPill() {
  const badge = useAssistant((state) => state.badge);
  return <span role="status">{badge.count ? badge.label : 'All clear'}</span>;
}
```

The getter is resolved **once per hook creation** (and re-resolved only if the
attached instance has been destroyed), because `useSyncExternalStore` calls
`getSnapshot` on every render. So it is a place to *attach* — not a place to
re-configure: a getter that calls `YouGeAssistant.attach({ ... })` with fresh
options on every render would re-configure the assistant on every render, and
`useAssistant` will not pick up new options passed that way after the first
resolution. To change configuration, call `attach({ ... })` (or
`assistant.configure({ ... })`) from an event handler or effect, then let the
state subscription re-render the component tree. Selectors are cached, so
`useAssistant((state) => state.badge)` only re-renders when the selected value
actually changes.

---

## Configuration & Last-Known-Good Pipeline

Configuration resolves deterministically in strict data-only order:

1. **Bundled defaults** (`BUNDLED_DEFAULTS`)
2. **Validated published revision** (`publishedConfig`, schema major `1`) — persisted per project under `localStorage["youge-assistant:lkg:<projectId>"]`
3. **Last-Known-Good fallback** — automatically loaded for the matching `projectId` if an incoming `publishedConfig` fails schema/security validation
4. **Explicit project overrides** — local options passed to `create()` / `attach()` / `configure()`

```js
const assistant = YouGeAssistant.create({
  projectId: 'portal-prod',
  publishedConfig: {
    schemaVersion: 1,
    revision: '2026-11-06.1',
    projectId: 'portal-prod',
    position: 'bottom-right',
    branding: {
      name: 'Customer Portal',
      shortName: 'Portal',
      themeColor: '#155eef',
    },
    modules: {
      installation: true,
      diagnostics: true,
      recovery: true,
      failover: true,
      help: true,
      updates: true,
    },
  },
  // Optional project-local override wins over published defaults:
  theme: 'auto',
});

console.log(assistant.getConfig().meta);
// { schemaVersion: 1, source: 'published', revision: '2026-11-06.1', usedLastKnownGood: false, warnings: [] }
```

### Configuration Security Rules

- **Data-only JSON:** Functions, `<script>` payloads, `javascript:`/`vbscript:` URLs, `eval()`, and `new Function()` are rejected by `validatePublishedConfig()` and stripped from local overrides.
- **No secrets in SDK config:** Keys matching credential patterns (`apiKey`, `secret`, `privateKey`, `password`, `accessToken`, `bearerToken`, `vapidPrivateKey`, etc.) are rejected in `publishedConfig` and stripped from local config so secrets never enter state snapshots or `localStorage`.
- **Same-origin branding icons:** Cross-origin icon URLs are rejected in favor of safe same-origin fallback icons.

---

## Public API Reference

### `AssistantInstance` methods

| Method | Signature / Return | Description |
| --- | --- | --- |
| `getState()` | `() => AssistantState` | Returns the current immutable-convention JSON-serializable state snapshot (`project`, `installation`, `network`, `capabilities`, `notifications`, `availableActions`, `badge`, `appearance`, `dismissed`, `acknowledged`). |
| `getConfig()` | `() => AssistantConfigSummary` | Returns resolved sanitized configuration plus `meta` (`source`, `revision`, `usedLastKnownGood`, `warnings`). |
| `configure(options)` | `(AssistantConfigInput) => AssistantState` | Re-runs configuration resolution, reloads project-scoped notice state, and emits an updated snapshot without duplicating listeners. |
| `subscribe(fn, opts?)` | `(fn, { immediate?: boolean }) => () => void` | Subscribes to state transitions. Calls `fn(state)` immediately unless `{ immediate: false }`. Returns an `unsubscribe` function. |
| `setConnectivity(online)` | `(boolean) => AssistantState` | Updates online/offline condition explicitly. |
| `setEndpointStatus(detail)` | `({ primary, backup, active, reason }) => AssistantState` | Reports host-app primary/backup API health. |
| `setSessionStatus(detail)` | `({ state, message }) => AssistantState` | Reports `'unknown' \| 'ok' \| 'issue'` session condition from the host app's own auth layer. |
| `setDnsResult(result)` | `(object) => AssistantState` | Records normalized DNS diagnostic status (`classification`, `message`, `checkedAt`). |
| `setUpdateAvailable(flag?)` | `(boolean) => AssistantState` | Marks a waiting service worker update ready to apply. |
| `runDiagnostics(opts?)` | `() => Promise<object>` | Single-flight on-demand diagnostics delegating to `services.diagnostics` → `window.PWA.runNetworkDiagnostics` → `window.YouGeDns.check`. Never polls automatically. |
| `requestInstall(opts?)` | `() => Promise<{ outcome: string }>` | Delegates installation to `window.PWA.promptInstall()`. Never registers a second install flow or service worker. |
| `dismiss(id)` | `(string) => boolean` | Dismisses a non-critical notification for the active `projectId`. Automatically resets once the underlying condition clears. |
| `acknowledge(id)` | `(string) => boolean` | Acknowledges a critical notification while keeping the condition visible in diagnostics. |
| `isDestroyed()` | `() => boolean` | Returns `true` after `destroy()` has been called. |
| `destroy()` | `() => void` | Removes all `window`/`document` event listeners, unsubscribes from `PWA.onChange`, and clears subscribers. |

### Notification Priority Ladder

1. **`1` (`critical`):** Offline (`network:offline`), DNS failure (`dns:failure`), host unreachable (`network:unreachable`), primary endpoint failed (`api:primary-failed`)
2. **`2` (`auth`):** Host-reported session attention (`session:issue`)
3. **`3` (`backup`):** Backup endpoint active (`api:backup-active`)
4. **`4` (`install`):** PWA installation available (`install:available`)
5. **`5` (`info`):** Primary endpoint restored (`api:primary-restored`), app update ready (`app:update`), configured feature announcements (`feature:<id>`)

---

## Illustrative Host-Project Integration Example

Below is an illustrative integration showing how any independent web application
(for example, `https://portal.example.com`) wires its own API health and session
events into `@youge/assistant-sdk` while keeping `pwa.js` and `/progressier.js`
responsible for installation and offline caching:

```js
import { YouGeAssistant, bridgePwaGlobals } from '@youge/assistant-sdk';

// 1. Register domain branding & attach singleton state before or alongside pwa.js
const { assistant } = bridgePwaGlobals({
  domainRegistry: {
    'portal.example.com': {
      identity: { name: 'Operations Portal', shortName: 'Ops Portal' },
      branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/', scope: './', startUrl: './?launchedfrom=homescreen' },
    },
  },
  assistantConfig: {
    projectId: 'ops-portal',
    actions: [
      { id: 'support', label: 'Contact support', kind: 'help', icon: 'help', message: 'Open support desk' },
    ],
  },
});

// 2. Report real endpoint or session transitions from the host app's own API client
export function onApiHealthChange({ primaryOk, usingBackup, reason }) {
  assistant.setEndpointStatus({
    primary: primaryOk ? 'healthy' : 'unavailable',
    backup: usingBackup ? 'active' : 'inactive',
    active: usingBackup ? 'backup' : 'primary',
    reason: reason || '',
  });
}

export function onSessionExpired() {
  assistant.setSessionStatus({
    state: 'issue',
    message: 'Please sign in again to sync changes.',
  });
}

// 3. Trigger diagnostics or install only from explicit user actions
document.querySelector('#check-network-btn')?.addEventListener('click', () => {
  assistant.runDiagnostics();
});

document.querySelector('#install-app-btn')?.addEventListener('click', () => {
  assistant.requestInstall();
});
```

---

## Security & Non-Goals

- **Domain detection is never authentication:** `resolveDomain()` selects public UI branding and manifest scope only. Unknown hosts receive `configured: false` and neutral defaults. Authentication and authorization always stay inside each host project.
- **Zero background network traffic:** The SDK core contains **no `fetch()` calls**, **no `setInterval()` polling**, **no telemetry**, and **no service worker registration**.
- **No sensitive caching or write replay:** Only public notice dismissal timestamps (`youge-assistant:notices:<projectId>`) and validated public data-only config (`youge-assistant:lkg:<projectId>`) touch `localStorage`.

---

## Versioning & Releases

- **Semver policy:** `patch` = fixes only · `minor` = additive API ·
  `major` = breaking API or config-schema change. Pre-1.0 (`0.x`) until the
  API is frozen by a public release.
- **Version sources are synchronized and machine-checked:** `package.json` ↔
  `SDK_VERSION` ↔ `KIT_COMPAT_VERSION` (the compatible You.Ge Assistant
  runtime line) ↔ the runtime version.
- **Publishing is gated, never automatic.** `0.1.0` is release-ready (the
  package-level `private` lock was removed in the approved release PR);
  publication happens only through the manual `sdk-release-prep` workflow with
  explicit authorization (`confirm_publish`, `SDK_RELEASE_ENABLED`, the
  protected `sdk-npm-publish` environment, an `NPM_TOKEN` secret, and the
  `SDK_RELEASE_CONFIRM` env that `prepublishOnly` requires — a stray direct
  `npm publish` is refused). The registry decision and release runbook live in
  [`RELEASE.md`](RELEASE.md).
- Replacing a vendored SDK copy (e.g. `staff.you.ge`): see
  [`MIGRATION.md`](MIGRATION.md).

---

## Testing & Verification

Run the standalone SDK test suite independently of the PWA application:

```bash
cd packages/assistant-sdk
npm test
node scripts/validate-package.mjs   # package metadata, export map, versions, contents
npm pack --dry-run                  # what a release would contain
```

From the repository root, `npm run check` runs the static contracts, this
package validation and the full test suites together.
