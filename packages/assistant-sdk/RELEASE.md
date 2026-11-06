# `@youge/assistant-sdk` — Release Preparation & Publishing Decision

> **Status: 0.1.0 release PR prepared (runbook §4 steps 1–2). Not published.**
> Nothing in this repository publishes the package on push, pull request or
> merge. The package-level `"private": true` lock has been removed by the
> approved release PR so the tarball is publishable; **publication remains
> disabled** until the repository owner completes [§4](#4-release-runbook-when-a-release-is-approved)
> steps 3–5 (protected environment, approval variable, manual publish
> dispatch) and [§6](#6-npm-trusted-publishing-oidc) (npm Trusted Publishing
> registration). Publishing authenticates with **npm Trusted Publishing
> (OIDC)** — no long-lived npm token secret is created, stored or used. This
> document does **not** claim the package has been released. See
> [§5](#5-publishing-remains-disabled).

This document records (1) the package-metadata review, (2) the evaluation of
publishing destinations with a recommendation, (3) the release procedure to
use **once a release is explicitly approved**, (4) the **npm Trusted
Publishing (OIDC) migration**, (5) the verification results of this
preparation pass, and (6) the required owner follow-ups.

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
| Packed size | 19 files, ~33 kB tarball / ~132 kB unpacked | `npm pack --dry-run` |
| Kit compatibility | `KIT_COMPAT_VERSION = 1.0.5` | Matches the You.Ge Assistant runtime version (`pwa.js` / `progressier.js`) |
| Config schema | `SCHEMA_VERSION = 1` | Data-only `publishedConfig` pipeline, LKG fallback |
| **Publishing auth** | **npm Trusted Publishing (OIDC)** | No npm token secret. The runner mints a short-lived OIDC token (`id-token: write`). Requires npm CLI **≥ 11.5.1** and Node **≥ 22.14.0** — see [§6](#6-npm-trusted-publishing-oidc) |

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
be published from `sandro-defender/you-ge-assistant`, because GitHub Packages
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
| Authentication to **publish** | **npm Trusted Publishing (OIDC) from GitHub Actions** — no stored token | `GITHUB_TOKEN`/PAT with `write:packages`, OIDC-friendly |
| GitHub Actions compatibility | `actions/setup-node` + `registry-url` + `id-token: write`; provenance automatic over OIDC | Same pattern with `registry-url: npm.pkg.github.com` |
| **Cloudflare build compatibility** | **Frictionless** — `npm ci` works in Cloudflare Pages/Workers builds with no secrets | Requires a build secret (see below) and `.npmrc` plumbing on every build |
| staff.you.ge installation | Exact-version pin, works in any CI and locally, no onboarding | Every dev + CI + Cloudflare build needs a token before `npm ci` works |
| Long-term maintenance | Default ecosystem path; lockfiles, Dependabot, provenance | Extra auth surface, token rotation, broken forks/PRs without secrets |
| Ownership & naming | Scope `@youge` (org `youge`, user `you-ge`) is confirmed and verified available ([§2](#2-package-identity-decisions)) | Scope must match the **publishing repository's owner** — `sandro-defender/you-ge-assistant` can only publish `@sandro-defender/*`, so the `@youge` name **cannot be published from this repository at all** |

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
4. **Maintenance**: npm Trusted Publishing (OIDC) gives signed, source-linked
   releases with **no long-lived token secret** to rotate or leak.

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
3. **Configure OIDC publishing** (see [§6](#6-npm-trusted-publishing-oidc)):
   create the protected `sdk-npm-publish` **environment** with required
   reviewers, register the **npm Trusted Publisher** (owner `sandro-defender`,
   repo `you-ge-assistant`, workflow filename `sdk-release-prep.yml`,
   environment `sdk-npm-publish`, allowed action `npm publish`), and set the
   repository variable `SDK_RELEASE_ENABLED = true` — the explicit "publishing
   approved" switch. **No npm token secret is created.** **Status: OWNER
   ACTION — see [§8](#8-required-follow-ups-before-the-first-publish).**
   - ⚠️ The trusted publisher can only be registered once the package **exists**
     on the registry; the very first release must be bootstrapped by hand first
     ([§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)).
4. **Publish** — run the `sdk-release-prep` workflow with `action: publish`
   and `confirm_publish: publish`. The publish job runs only with all gates
   from step 3 and only on this manual dispatch. It authenticates with the
   short-lived OIDC token minted by `id-token: write` — there is no
   `NODE_AUTH_TOKEN` to leak. Direct `npm publish` is refused: the
   `prepublishOnly` hook aborts any publish attempt that lacks the
   `SDK_RELEASE_CONFIRM` authorization injected by this job. **Status: NOT
   DONE — no authorization to publish has been given.**
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
| Registry credential | **None.** Authentication is npm Trusted Publishing (OIDC): the runner mints a short-lived token via `id-token: write`. No `NPM_TOKEN` secret exists or is needed. The npm-side trusted-publisher registration still has to happen (§6.3) | **Missing — owner action** |
| Package-level publish authorization | The `prepublishOnly` hook **refuses any `npm publish` that lacks `SDK_RELEASE_CONFIRM=publish`** — a variable injected only by the gated publish job. A stray direct `npm publish` (even by someone with npm org rights) aborts at `prepublishOnly` | **Closed** |

Defense in depth: `validate-package.mjs` fails CI if any workflow gate (or the
OIDC configuration, or the `prepublishOnly` script, or the version contract) is
removed or weakened; standing contracts in `scripts/check.mjs` and regression
tests in `tests/release-gates.test.mjs` enforce this by mutation.
Honest limits: an actor who can edit the repository *and* holds npm publish
rights can always bypass an in-repo guard (e.g. `npm publish --ignore-scripts`)
— the real credential boundary is npm org membership and the trusted-publisher
registration; the guards above stop every accidental or ordinary path.

## 6. npm Trusted Publishing (OIDC)

Publishing authenticates with **npm Trusted Publishing** (OpenID Connect)
instead of a long-lived npm token. npm issues a short-lived, workflow-scoped
credential on every publish; nothing is stored in a secret. This implements
the OpenSSF *trusted publishers* standard.

### 6.1 Requirements (official npm docs)

| Requirement | Value | Where it lives |
| --- | --- | --- |
| npm CLI | **≥ 11.5.1** | `docs.npmjs.com/trusted-publishers` |
| Node | **≥ 22.14.0** | same |
| CI provider | GitHub Actions on **GitHub-hosted** runners (self-hosted not supported) | `runs-on: ubuntu-latest` |
| OIDC permission | `id-token: write` | publish job `permissions` |
| Registry URL | `registry-url: https://registry.npmjs.org` | `actions/setup-node` |
| Build cache | `package-manager-cache: false` (recommended for release builds) | `actions/setup-node` |
| `repository.url` | must exactly match `https://github.com/sandro-defender/you-ge-assistant` | `packages/assistant-sdk/package.json` (machine-checked) |
| npm auth token | **none** — no `NODE_AUTH_TOKEN` on the publish step | machine-checked |
| Provenance | generated automatically over OIDC (`--provenance` kept explicit) | publish step |
| GitHub environment | `sdk-npm-publish` (optional on npm; used here for approval) | publish job |

### 6.2 Workflow configuration (`.github/workflows/sdk-release-prep.yml`)

The `publish` job now:

- runs on `ubuntu-latest` (GitHub-hosted);
- declares `permissions: contents: read` + `id-token: write`;
- pins `node-version: 24` (ships npm ≥ 11.5.1) and sets
  `registry-url: https://registry.npmjs.org` with `package-manager-cache: false`;
- adds a guard step that fails the run unless `npm -v` is ≥ 11.5.1;
- sets **no** npm auth token env — only `SDK_RELEASE_CONFIRM: publish`;
- runs `npm publish --access public --provenance`.

`action=verify` is unchanged and remains completely non-publishing.

### 6.3 Registering the trusted publisher (owner action)

A trusted publisher is configured **from an existing package's settings page**
on npmjs.com. `@youge/assistant-sdk` does **not** exist on the registry yet, so
it cannot be registered until the package exists — see §6.4.

Once the package exists, open npmjs.com → `@youge/assistant-sdk` → **Settings**
→ **Trusted Publisher** → **GitHub Actions** and enter:

| Field | Value |
| --- | --- |
| Organization or user | `sandro-defender` |
| Repository | `you-ge-assistant` |
| Workflow filename | `sdk-release-prep.yml` (filename only — no `.github/workflows/` path) |
| Environment name | `sdk-npm-publish` |
| Allowed actions | `npm publish` (and/or `npm stage publish`) |

Or, with npm CLI ≥ 11.10 (`npx npm@latest`):

```bash
npm trust github @youge/assistant-sdk \
  --repo sandro-defender/you-ge-assistant \
  --file sdk-release-prep.yml \
  --environment sdk-npm-publish \
  --allow-publish --yes
```

**A newly created trusted publisher must complete its first successful publish
within 2 days** or it expires and must be re-created. Existing connections
cannot be edited — delete and re-create to change them.

### 6.4 The first publish of a new package cannot use OIDC (important)

npm only allows a trusted publisher to be configured **for a package that
already exists** on the registry (`npm help trust`: *"Package must exist: The
package you're configuring must already exist on the npm registry."*).
`@youge/assistant-sdk@0.1.0` is unpublished, so the **first** release must be
bootstrapped by hand before OIDC can be used:

1. **Bootstrap the first publish** — publish `0.1.0` once from a local machine
   with a **one-time** granular token, or `npm publish --auth-type=web` with
   2FA. This step is deliberately outside CI; it is the *only* step that
   touches a token, and it is never stored anywhere.
   - npm never allows republishing a version, so a final `0.1.0` published by
     hand could never be re-published and would never carry a provenance
     attestation. If provenance on the very first version matters, publish a
     *pre-release* (e.g. `0.1.0-rc.1`) by hand under the `next` tag first,
     then register the trusted publisher and publish the real `0.1.0` via the
     OIDC workflow.
2. **Register the trusted publisher** (§6.3) — `npm trust github ...` or the
   settings form.
3. **Restrict token access** (optional, recommended): package **Settings** →
   **Publishing access** → *"Require two-factor authentication and disallow
   tokens"*, then revoke any automation tokens.
4. **Publish subsequent versions via the workflow** (§4 step 4).

Nothing in this repository creates, stores or requests that bootstrap token;
it is an owner action documented here so the first release is not a dead end.

### 6.5 What is enforced automatically

`packages/assistant-sdk/scripts/validate-package.mjs` — and the standing
contracts in `scripts/check.mjs`, plus the mutation tests in
`tests/release-gates.test.mjs` — fail if any of the following is weakened:

- `id-token: write` present on the publish job;
- `registry-url: https://registry.npmjs.org` on the publish job;
- the publish job runs on a GitHub-hosted runner (`ubuntu-latest`);
- the publish job pins Node 24 (npm ≥ 11.5.1 / Node ≥ 22.14);
- **no** `NODE_AUTH_TOKEN` / `secrets.NPM_TOKEN` appears anywhere in the
  workflow;
- `repository.url` matches the canonical GitHub repository;
- the manual-only trigger, `confirm_publish`, `SDK_RELEASE_ENABLED`, the
  protected `sdk-npm-publish` environment and `SDK_RELEASE_CONFIRM: publish`
  are all intact.

## 7. Verification results (2026-11-06)

### Release-preparation pass (PR #9/#10 era)

| Check | Command | Result |
| --- | --- | --- |
| Static checks + all tests | `npm run check` (root) | ✅ 261 static assertions + 132/132 tests pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 33/33 pass (4 suites) |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Package & version validation | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ all sections pass |
| Pack contents | `npm pack --dry-run` | ✅ 19 files, 32.4 kB packed / 129.7 kB unpacked |
| Consumer build | `npm ci && npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Release workflow | `.github/workflows/sdk-release-prep.yml` | ✅ created; publish job disabled (locks above) |
| Registry state (post-rename) | `registry.npmjs.org` lookups | `@youge/assistant-sdk` unpublished (404); `@youge/*` empty (no conflict); org/scope `youge` exists |
| Name consistency | repo-wide `@you-ge` grep | ✅ only intentional rename-history mentions remain (CHANGELOG rename entry, this file §2) |

### 0.1.0 release-PR pass

| Check | Result |
| --- | --- |
| Version `0.1.0` not yet on npm | ✅ `GET /@youge%2fassistant-sdk` → HTTP 404 (2026-11-06) |
| Identity consistency | ✅ `@youge/assistant-sdk@0.1.0` in metadata; `SDK_VERSION` `0.1.0`; `KIT_COMPAT_VERSION` `1.0.5` |
| Full test suite + contracts | ✅ see the release PR for the run log |
| Publishability + workflow-gate validation | ✅ `validate-package.mjs` "Publishability and release gates" section passes |
| GitHub environment inventory | ⚠️ `sdk-npm-publish` **missing** (only `github-pages`); owner action §8 |
| `SDK_RELEASE_ENABLED` visibility | ⚠️ not readable by automation (HTTP 403); treat as unconfigured, owner verifies |
| Consumer install smoke test (packed tarball, exact name/version) | ✅ see the release PR for the run log |

### OIDC trusted-publishing migration pass

| Check | Command | Result |
| --- | --- | --- |
| Workflow OIDC config | `grep -n "id-token: write\|registry-url\|node-version: 24"` | ✅ publish job has `id-token: write`, `registry-url: https://registry.npmjs.org`, `node-version: 24`, `package-manager-cache: false`, npm ≥ 11.5.1 guard |
| No long-lived token | `grep -n "NODE_AUTH_TOKEN\|secrets.NPM_TOKEN" .github/workflows/sdk-release-prep.yml` | ✅ no matches — publish step sets only `SDK_RELEASE_CONFIRM` |
| Validator OIDC gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ 10/10 release-workflow gates pass |
| Standing contracts | `npm run check` | ✅ 261 static assertions + **149/149** tests pass, 0 fail |
| Registry identity unchanged | `npm view @youge/assistant-sdk version` | ✅ HTTP 404 — still unpublished; **not published by this task** |
| `action=verify` non-publishing | workflow review | ✅ verify job runs checks only; no publish path |
| Trusted publisher registration | owner action | ⚠️ **not done** — requires the package to exist first (§6.4); no secrets created or modified |
| `sdk-npm-publish` environment | owner action | ⚠️ **not created/changed** (only `github-pages` exists) |

## 8. Required follow-ups (before the first publish)

Owner actions remaining (nothing in this repository can complete them):

1. **npmjs.com:** confirm the publishing npm user (`you-ge`) has publish
   rights on the org `youge` (registry APIs do not expose org membership).
2. **Bootstrap the first publish** of `@youge/assistant-sdk` (the package does
   not exist yet, so OIDC cannot be used for it) — see
   [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important).
3. **Register the npm Trusted Publisher** for the workflow (§6.3) and, once
   it works, **restrict token access** (Settings → Publishing access →
   "Require two-factor authentication and disallow tokens").
4. **Create the protected environment `sdk-npm-publish`** with required
   reviewers (verified missing — do this **before** any publish run).
5. **Approve publication** by setting the repository variable
   `SDK_RELEASE_ENABLED = true` (the explicit "publishing approved" switch).
6. **Publish** — run `sdk-release-prep` with `action=publish` and
   `confirm_publish=publish` ([§4](#4-release-runbook-when-a-release-is-approved)
   step 4), then the post-publish smoke tests (step 5) and optional tag
   (step 6).
7. Migrate staff.you.ge off the vendored copy per
   [`MIGRATION.md`](MIGRATION.md) after the first published version.

---

*Release-preparation documentation reviewed with the `ui-ux-pro-max-skill`
guidance. The skill's "When to Apply" section says to skip it for
infrastructure/DevOps work that does not change how something looks, feels,
moves or is interacted with, so its design-system search workflow was not run
for this infrastructure-only migration; its documentation guidance (status
first, scannable tables, atomic runbook steps, explicit guard/failure states)
was used to structure this document. Skill record:
[`../../DESIGN_FOUNDATION.md`](../../DESIGN_FOUNDATION.md) §10.*
