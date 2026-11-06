# `@youge/assistant-sdk` — Release Preparation & Publishing Decision

> **Status: 0.1.0 release PR prepared (runbook §4 steps 1–2). Not published.**
> Nothing in this repository publishes the package on push, pull request or
> merge. The package-level `"private": true` lock has been removed by the
> approved release PR so the tarball is publishable; **publication remains
> disabled** until the repository owner completes [§4](#4-release-runbook-when-a-release-is-approved)
> steps 3–5 (registry credential, protected environment, approval variable,
> manual publish dispatch). This document does **not** claim the package has
> been released. See [§5](#5-publishing-remains-disabled).

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
| Version | `0.1.0` (initial release) | Synced with `SDK_VERSION` in `src/core/constants.js` |
| Visibility | release-ready (publishable) | `"private": true` lock removed in the 0.1.0 release PR per [§4](#4-release-runbook-when-a-release-is-approved) step 1; publication still gated ([§5](#5-publishing-remains-disabled)) |
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
until a real release decision was made. That lock held through the release
preparation (PR #9) and identity correction (PR #10), and is removed only now,
in the approved 0.1.0 release PR, exactly as [§4](#4-release-runbook-when-a-release-is-approved)
step 1 prescribes.

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

1. **Release PR** (one deliberate, reviewable change set) — **DONE (0.1.0
   release PR):**
   - ✅ version set to exactly `0.1.0` in `packages/assistant-sdk/package.json`
     and `SDK_VERSION` in `src/core/constants.js` (already synchronized; no
     bump beyond `0.1.0`);
   - ✅ `CHANGELOG.md` `0.1.0` initial-release entry added;
   - ✅ `"private": true` removed from `packages/assistant-sdk/package.json`;
   - ✅ the two explicit guard assertions updated as intentional review
     signals: `scripts/check.mjs` now asserts release-ready state, and
     `packages/assistant-sdk/scripts/validate-package.mjs` now verifies
     publishability **and** that the workflow publishing gates stay intact;
   - ✅ `npm run check` and `node packages/assistant-sdk/scripts/validate-package.mjs`
     green.
2. **Verify** — run the `sdk-release-prep` workflow with `action: verify`
   (manual dispatch only). All jobs green. **Status: to be dispatched by the
   maintainer** (or recorded from the release PR's CI run).
3. **Configure the registry secret** at publish time only: `NPM_TOKEN`
   (npm automation token or npm Trusted Publishing) as a repository **secret**,
   and the `sdk-npm-publish` **environment** with required reviewers. Set the
   repository variable `SDK_RELEASE_ENABLED = true` — this is the explicit
   "publishing approved" switch. **Status: OWNER ACTION — see
   [§7](#7-required-follow-ups-before-the-first-publish).**
4. **Publish** — run the `sdk-release-prep` workflow with `action: publish`
   and `confirm_publish: publish`. The publish job runs only with all gates
   from step 3 and only on this manual dispatch. Direct `npm publish` is
   refused: the `prepublishOnly` hook aborts any publish attempt that lacks
   the `SDK_RELEASE_CONFIRM` authorization injected by this job. **Status:
   NOT DONE — no authorization to publish has been given.**
5. **Post-publish smoke test** — `npm view @youge/assistant-sdk version`,
   install the exact version in a scratch project and in staff.you.ge's
   lockfile (see [`MIGRATION.md`](MIGRATION.md)). **Status: pending step 4.**
6. Optionally tag the release commit **after** a successful publish (tags are
   created only as part of an approved release, never by automation on merge).
   **Status: pending step 4.**

## 5. Publishing remains disabled

The 0.1.0 release PR removed the package-level `"private": true` lock — that
is runbook step 1 and its intentional review signal. Publishing is still
impossible in practice: every remaining gate below is closed, and the publish
job requires **all** of them at once.

| Gate | Mechanism | State |
| --- | --- | --- |
| Workflow trigger | `sdk-release-prep.yml` runs on `workflow_dispatch` **only** (never on push/PR/merge/tag) | **Closed** |
| Explicit authorization | Publish requires manual `action=publish` **and** `confirm_publish=publish` **and** `SDK_RELEASE_ENABLED = 'true'` (the approval variable is not set; repository variables are not readable by this automation — treat as unset) | **Closed** |
| Protected environment | `sdk-npm-publish` with required reviewers. **Verified missing (2026-11-06):** only the `github-pages` environment exists. Create `sdk-npm-publish` **with required reviewers before** any publish run — GitHub silently auto-creates an unprotected environment on first use otherwise | **Missing — owner action** |
| Registry credential | `NPM_TOKEN` repository secret (masked). Nothing is committed; secret existence is not readable by this automation (HTTP 403) — configure at publish time only | **Missing — owner action** |
| Package-level publish authorization | The `prepublishOnly` hook **refuses any `npm publish` that lacks `SDK_RELEASE_CONFIRM=publish`** — a variable injected only by the gated publish job. A stray direct `npm publish` (even by someone with npm org rights) aborts at `prepublishOnly` | **Closed** |

Defense in depth: `validate-package.mjs` fails CI if any workflow gate is
removed (standing contracts in `scripts/check.mjs` and regression tests in
`tests/release-gates.test.mjs` enforce this by mutation), and
`npm publish` cannot succeed without the `NPM_TOKEN` credential regardless of
workflow state. Honest limits: an actor who can edit the repository *and*
holds npm publish rights can always bypass any in-repo guard (e.g.
`npm publish --ignore-scripts`) — the real credential boundary is npm org
membership; the guards above stop every accidental or ordinary path.

## 6. Verification results (2026-11-06)

### Release-preparation pass (PR #9/#10 era)

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

### 0.1.0 release-PR pass

| Check | Result |
| --- | --- |
| Version `0.1.0` not yet on npm | ✅ `GET /@youge%2fassistant-sdk` → HTTP 404 (2026-11-06) |
| Identity consistency | ✅ `@youge/assistant-sdk@0.1.0` in metadata; `SDK_VERSION` `0.1.0`; `KIT_COMPAT_VERSION` `1.0.5` |
| Full test suite + contracts | ✅ see the release PR for the run log |
| Publishability + workflow-gate validation | ✅ `validate-package.mjs` "Publishability and release gates" section passes (5/5 gates intact) |
| GitHub environment inventory | ⚠️ `sdk-npm-publish` **missing** (only `github-pages`); owner action §7 |
| `NPM_TOKEN` / `SDK_RELEASE_ENABLED` visibility | ⚠️ not readable by automation (HTTP 403); treat as unconfigured, owner verifies |
| Consumer install smoke test (packed tarball, exact name/version) | ✅ see the release PR for the run log |

### Independent pre-merge audit pass (PR #11 review)

| Check | Result |
| --- | --- |
| Standing-contract mutation tests | ✅ `check.mjs` and `validate-package.mjs` both fail (exit 1, named gate) when any of the 5 workflow gates, the `prepublishOnly` script, or the release-ready version contract is removed/weakened |
| Stray-publish refusal | ✅ `prepublishOnly` aborts `npm publish` without `SDK_RELEASE_CONFIRM=publish` (regression-tested in `tests/release-gates.test.mjs`) |
| Provenance/OIDC consistency | ✅ `npm publish --access public --provenance` matches the granted `id-token: write` and the §3 provenance recommendation |
| Runbook ↔ workflow accuracy | ✅ §4/§5 updated to describe the `SDK_RELEASE_CONFIRM` package-level gate; no-op `--release-context` flag removed from the workflow |

## 7. Required follow-ups (before the first publish)

Owner actions remaining (nothing in this repository can complete them):

1. **npmjs.com:** confirm the publishing npm user (`you-ge`) has publish
   rights on the org `youge` (registry APIs do not expose org membership).
2. **Create the protected environment `sdk-npm-publish`** with required
   reviewers (verified missing — do this **before** any publish run).
3. **Configure `NPM_TOKEN`** (npm automation token, or npm Trusted Publishing
   via OIDC) as a masked repository/environment secret. Never commit it.
4. **Approve publication** by setting the repository variable
   `SDK_RELEASE_ENABLED = true` (the explicit "publishing approved" switch).
5. **Publish** — run `sdk-release-prep` with `action=publish` and
   `confirm_publish: publish` ([§4](#4-release-runbook-when-a-release-is-approved)
   step 4), then the post-publish smoke tests (step 5) and optional tag
   (step 6).
6. Migrate staff.you.ge off the vendored copy per
   [`MIGRATION.md`](MIGRATION.md) after the first published version.

---

*Release-preparation documentation reviewed with the `ui-ux-pro-max-skill`
guidance (progressive disclosure: status first, decision tables scannable,
runbook steps atomic, failure/guard states explicit). Skill record:
[`../../DESIGN_FOUNDATION.md`](../../DESIGN_FOUNDATION.md) §10.*
