# `@youge/assistant-sdk` — Release Preparation & Publishing Decision

> **Status: release preparation only. Publishing is disabled.**
> Nothing in this repository publishes the package on push, pull request or
> merge. The package is locked with `"private": true`, the release workflow is
> manual and gated, and no registry account or token is configured.
> See [§5](#5-publishing-remains-disabled).

This document records (1) the package-metadata review, (2) the evaluation of
publishing destinations with a recommendation, (3) the release procedure to use
**once a release is explicitly approved**, and (4) the verification results of
this preparation pass (2026-11-06).

Related documents: [`README.md`](README.md) (public API and consumption) ·
[`MIGRATION.md`](MIGRATION.md) (staff.you.ge vendored-copy migration) ·
[`../../CHANGELOG.md`](../../CHANGELOG.md).

---

## 1. Current state

| Item | Value | Notes |
| --- | --- | --- |
| Package name | `@youge/assistant-sdk` | Scope `@youge` (npm org `youge`, npm user `you-ge`) — confirmed by the project owner, see [§2](#2-package-identity-decisions); available and unpublished on npm |
| Version | `0.1.0` (pre-1.0) | Synced with `SDK_VERSION` in `src/core/constants.js` |
| Visibility | `"private": true` | Deliberate accidental-publish lock (added in Phase 2) |
| Publish config | `publishConfig.access: "public"` | Ready for an approved first scoped publish |
| Module system | ESM only (`"type": "module"`) | Buildless: `src/` **is** the published runtime |
| TypeScript | Paired `.d.ts` per export entry | `.`, `./domain`, `./config`, `./diagnostics`, `./installation`, `./react` |
| Export map | Explicit subpaths, no wildcards | Deep imports like `@youge/assistant-sdk/src/...` are **blocked** |
| Runtime dependencies | **Zero** | `react >= 18` is an optional peer only (for `./react`) |
| License | MIT ([`LICENSE`](LICENSE)) | Matches the repository license |
| Packed size | 19 files, ~32 kB tarball / ~130 kB unpacked | `npm pack --dry-run` |
| Kit compatibility | `KIT_COMPAT_VERSION = 1.0.5` | Matches the You.Ge Assistant runtime version (`pwa.js` / `progressier.js`) |
| Config schema | `SCHEMA_VERSION = 1` | Data-only `publishedConfig` pipeline, LKG fallback |

Why the package was marked `private`: Phase 2 (PR #7) extracted the SDK
locally and explicitly wanted to make an accidental `npm publish` impossible
until a real release decision was made. That remains correct today — the flag
stays until an approved release PR removes it ([§4](#4-release-runbook-when-a-release-is-approved)).

## 2. Package identity decisions

### Name

**Final package identity (confirmed by the project owner, 2026-11-06):**

| Role | Identity |
| --- | --- |
| npm user | `you-ge` |
| npm organization | `youge` |
| npm scope | `@youge` |
| **Package** | **`@youge/assistant-sdk`** |

The previous name `@you-ge/assistant-sdk` was based on an incorrect assumption
about the organization scope. It was **never published**, so the rename to
`@youge/assistant-sdk` happened before first publication and breaks no
consumer (the vendored `staff.you.ge` copy predates any registry pin).

Registry verification (2026-11-06, `registry.npmjs.org`) — identity available,
no conflict:

- `@youge/assistant-sdk` is **unpublished** (registry returns 404).
- Zero packages exist under `@youge/*` (`scope:youge` search) — no third party
  squats the scope or the name.
- The org/scope `youge` **exists**: `GET /-/org/youge/user` returns a member
  map, while a nonexistent-org control returns `{"error":"Scope not found"}`.

**No account, org, scope or token was created, claimed or modified by this
task.** Ownership of the org `youge` stays with the project owner's npm user
`you-ge` (owner-side fact; verify publish rights on npmjs.com before the first
release).

GitHub Packages note (conclusion unchanged): the `@youge` scope still cannot
be published from `sandro-defender/PWA-Helper`, because GitHub Packages
requires the npm scope to match the **publishing repository's owner**
(`@sandro-defender/*`). Public npm therefore remains the recommended
destination ([§3](#3-publishing-destination-evaluation)).

### Version

- Pre-1.0 semver (`0.1.0`) signals the API is extracted-and-tested but not yet
  frozen by a public release. Policy once published:
  - **patch** — bug fixes, no API or state-model change;
  - **minor** — additive API (new exports, new optional options);
  - **major** — breaking API change (also bumps `SCHEMA_VERSION` if the config
    contract changes).
- Version synchronization is machine-checked
  (`packages/assistant-sdk/scripts/validate-package.mjs`): `package.json` ↔
  `SDK_VERSION` ↔ `KIT_COMPAT_VERSION` ↔ the runtime version.
- Never publish a version that already exists on the registry; the release
  workflow re-checks this at run time.

### Module system & types

- **ESM-only, no CommonJS build — deliberate.** The SDK is dependency-free and
  buildless; a CJS artifact would introduce a build step and a second runtime
  shape to test. Consumers are modern bundlers (Vite, Next, webpack, Rollup,
  esbuild) and Node ≥ 18 ESM; CJS hosts can `await import('@youge/assistant-sdk')`.
  This is documented in the README so nobody discovers it at runtime.
- TypeScript declarations ship next to every entry point and are wired through
  the `types` condition of each `exports` entry plus the legacy top-level
  `types` field.

### Export map & contents

- The `exports` map is the **only** supported import surface. It has no `./*`
  wildcard, so internal source files cannot be imported by path — consumers can
  never depend on repository internals.
- The `files` whitelist ships `src/`, `README.md`, `LICENSE` (npm always adds
  `package.json`). Tests, validation scripts and repository metadata are
  excluded from the tarball (verified via `npm pack --dry-run --json`).
- Every source module uses package-relative imports only; nothing references
  repository-specific paths outside the package.

## 3. Publishing destination evaluation

| Criterion | **Public npm** (`registry.npmjs.org`) | GitHub Packages (`npm.pkg.github.com`) |
| --- | --- | --- |
| Package visibility | Public by default with `publishConfig.access: "public"`; free | Public packages possible, but **every install still needs authentication** |
| Authentication to **install** | None — anonymous, cache-friendly | `read:packages` token required for **all** consumers, even public packages |
| Authentication to **publish** | npm token or npm Trusted Publishing (OIDC from GitHub Actions) | `GITHUB_TOKEN`/PAT with `write:packages`, OIDC-friendly |
| GitHub Actions compatibility | `actions/setup-node` + `registry-url` + `NODE_AUTH_TOKEN`; provenance via `--provenance` | Same pattern with `registry-url: npm.pkg.github.com` |
| **Cloudflare build compatibility** | **Frictionless** — `npm ci` works in Cloudflare Pages/Workers builds with no secrets | Requires a build secret (see below) and `.npmrc` plumbing on every build |
| staff.you.ge installation | Exact-version pin, works in any CI and locally, no onboarding | Every dev + CI + Cloudflare build needs a token before `npm ci` works |
| Long-term maintenance | Default ecosystem path; lockfiles, Dependabot, provenance | Extra auth surface, token rotation, broken forks/PRs without secrets |
| Ownership & naming | Scope `@youge` (org `youge`, user `you-ge`) is confirmed and verified available ([§2](#2-package-identity-decisions)) | Scope must match the **publishing repository's owner** — `sandro-defender/PWA-Helper` can only publish `@sandro-defender/*`, so the `@youge` name **cannot be published from this repository at all** |

### Recommendation: **public npm** (`registry.npmjs.org`), scoped package, `access: public`

Reasons, in order:

1. **Cloudflare builds need zero configuration.** staff.you.ge builds on
   Cloudflare; with public npm, `npm ci` just works. With GitHub Packages every
   build would need a `read:packages` token.
2. **The `@youge/assistant-sdk` name is only possible on npm.** GitHub Packages
   would force `@sandro-defender/assistant-sdk` (scope must match the repo
   owner) and could not honor the `You-ge` brand scope.
3. **Consumer friction**: staff.you.ge pins the same way as any npm dependency;
   no `.npmrc`, no token rotation, no broken contributor or fork builds.
4. **Maintenance**: npm provenance (`npm publish --provenance` from GitHub
   Actions OIDC) gives signed, source-linked releases with no long-lived token.

### If GitHub Packages were ever required — the secure configuration

(Not recommended; recorded so the decision is reproducible.)

- Publish from a repository owned by the scope owner, and accept the
  `@sandro-defender/assistant-sdk` name.
- In Cloudflare build settings, store a **masked** secret (e.g.
  `NPM_TOKEN`) holding a fine-scoped token with `read:packages` only.
- Generate `.npmrc` **during the build**, never commit it:
  `printf '//npm.pkg.github.com/:_authToken=%s\n' "$NPM_TOKEN" > ~/.npmrc`
- Rotate the token on staff changes/leaks; treat fork builds as untrusted (the
  secret must not be exposed to `pull_request` from forks).

## 4. Release runbook (when a release is approved)

Prerequisites: the registry identity `@youge/assistant-sdk` is confirmed and
verified available ([§2](#2-package-identity-decisions)); the maintainer has
decided the registry ([§3](#3-publishing-destination-evaluation)).

1. **Release PR** (one deliberate, reviewable change set):
   - bump `version` in `packages/assistant-sdk/package.json` **and**
     `SDK_VERSION` in `src/core/constants.js` together;
   - add a `CHANGELOG.md` entry;
   - remove `"private": true` from `packages/assistant-sdk/package.json`;
   - update the two explicit guard assertions that lock publishing today:
     `scripts/check.mjs` (`private === true` contract) and the
     accidental-publish guard in
     `packages/assistant-sdk/scripts/validate-package.mjs` (strict mode) —
     both are intentional review signals;
   - run `npm run check` and
     `node packages/assistant-sdk/scripts/validate-package.mjs`.
2. **Verify** — run the `sdk-release-prep` workflow with `action: verify`
   (manual dispatch only). All jobs green.
3. **Configure the registry secret** at publish time only: `NPM_TOKEN`
   (npm automation token or npm Trusted Publishing) as a repository **secret**,
   and the `sdk-npm-publish` **environment** with required reviewers. Set the
   repository variable `SDK_RELEASE_ENABLED = true` — this is the explicit
   "publishing approved" switch.
4. **Publish** — run the `sdk-release-prep` workflow with `action: publish`
   and `confirm_publish: publish`. The publish job runs only with all gates
   from step 3 and only on this manual dispatch.
5. **Post-publish smoke test** — `npm view @youge/assistant-sdk version`,
   install the exact version in a scratch project and in staff.you.ge's
   lockfile (see [`MIGRATION.md`](MIGRATION.md)).
6. Optionally tag the release commit **after** a successful publish (tags are
   created only as part of an approved release, never by automation on merge).

## 5. Publishing remains disabled

As of 2026-11-06 three independent locks prevent any publish:

| Lock | Mechanism | State |
| --- | --- | --- |
| Package level | `"private": true` — `npm publish` refuses private packages | **Active** |
| Workflow level | `sdk-release-prep.yml` runs on `workflow_dispatch` **only** (never on push/PR/merge); its publish job additionally requires the `SDK_RELEASE_ENABLED` repository variable (unset), the `confirm_publish` input, the protected `sdk-npm-publish` environment and an `NPM_TOKEN` secret (not configured) | **Active** |
| Account level | `@youge/assistant-sdk` is unpublished on npm and **no publish credential exists anywhere** in this repository (no `NPM_TOKEN` secret configured, no committed `.npmrc`, no automation token) | **Active** |

`prepublishOnly` also re-runs the full package validation as a final net.

## 6. Verification results (2026-11-06)

| Check | Command | Result |
| --- | --- | --- |
| Static checks + all tests | `npm run check` (root) | ✅ 206 static assertions + 132/132 tests pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 33/33 pass (4 suites) |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Package & version validation | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ all sections pass |
| Pack contents | `npm pack --dry-run` | ✅ 19 files, 32.4 kB packed / 129.7 kB unpacked |
| Consumer build | `npm ci && npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Release workflow | `.github/workflows/sdk-release-prep.yml` | ✅ created; publish job disabled (three locks above) |
| Registry state (post-rename) | `registry.npmjs.org` lookups | `@youge/assistant-sdk` unpublished (404); `@youge/*` empty (no conflict); org/scope `youge` exists |
| Name consistency | repo-wide `@you-ge` grep | ✅ only intentional rename-history mentions remain (CHANGELOG rename entry, this file §2) |

## 7. Required follow-ups (before the first publish)

1. **Naming is settled** — `@youge/assistant-sdk` is confirmed and verified
   available. Owner-side check on npmjs.com: the publishing npm user (`you-ge`)
   has publish rights on the org `youge`.
2. Approve the registry decision ([§3](#3-publishing-destination-evaluation)) —
   recommendation is public npm.
3. Configure `NPM_TOKEN` (or npm Trusted Publishing) and the `sdk-npm-publish`
   environment with required reviewers; set `SDK_RELEASE_ENABLED=true` only
   when publishing is explicitly approved.
4. Execute the release runbook ([§4](#4-release-runbook-when-a-release-is-approved)).
5. Migrate staff.you.ge off the vendored copy per
   [`MIGRATION.md`](MIGRATION.md) after the first published version.

---

*Release-preparation documentation reviewed with the `ui-ux-pro-max-skill`
guidance (progressive disclosure: status first, decision tables scannable,
runbook steps atomic, failure/guard states explicit). Skill record:
[`../../DESIGN_FOUNDATION.md`](../../DESIGN_FOUNDATION.md) §10.*
