# `@youge/assistant-sdk` — Release Preparation & Publishing Decision

> **Status: 0.1.0 release PR prepared (runbook §4 steps 1–2). Not staged, not published.**
> Nothing in this repository publishes the package on push, pull request or
> merge. The package-level `"private": true` lock has been removed by the
> approved release PR so the tarball is publishable; **publication remains
> disabled** until the repository owner completes [§4](#4-release-runbook-when-a-release-is-approved):
> the first publication is **staged** by the manual GitHub Actions `stage`
> job using the temporary stage-only secret `NPM_STAGE_TOKEN`, then becomes
> public only when the owner **approves the staged version on npmjs.com with
> 2FA**; all later releases authenticate with **npm Trusted Publishing
> (OIDC)** — the `action=verify` run and the OIDC publish job use **no npm
> token** at all. This document does **not** claim the package has been
> staged or released. See [§5](#5-publishing-remains-disabled).

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
| **Publishing auth** | **First publication: staged by the GitHub Actions `stage` job with the temporary `NPM_STAGE_TOKEN` stage-only secret (owner-created, revoked right after). Later releases: npm Trusted Publishing (OIDC)** | Verify and the OIDC publish job use no npm token at all; the bootstrap token is a temporary credential, not the future publishing method — [§4](#4-release-runbook-when-a-release-is-approved), [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important) |

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
   (manual dispatch only). All jobs green. The verify job never publishes and
   uses no npm token. **Status: to be dispatched by the maintainer** (or
   recorded from the release PR's CI run).
3. **Stage the first publication — GitHub Actions, no PC terminal needed**
   (see [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)
   for the full detail). This is a **staging** step, not a publication:
   - **3a. Owner creates the stage-only token** on npmjs.com (profile menu →
     **Access Tokens** → **Generate New Token** → **Granular Access Token**):
     Packages and scopes = the **`@youge` scope**; Permissions = **Read and
     write (stage only)**; **Bypass two-factor authentication unchecked**;
     shortest available expiry. This token is a **temporary bootstrap
     credential, not the future publishing method** — OIDC replaces it in
     step 6. **Status: OWNER ACTION — nothing in this repository creates it.**
   - **3b. Owner adds the GitHub Actions secret**: repository →
     **Settings → Secrets and variables → Actions → New repository secret** →
     name exactly **`NPM_STAGE_TOKEN`**, value = the token from 3a. (A
     repository secret — the protected `sdk-npm-publish` environment itself
     is not created or modified.) **Status: OWNER ACTION.**
   - **3c. Owner dispatches** the `sdk-release-prep` workflow with
     `action: stage` **and** `confirm_stage: stage`, **from the `main`
     branch**. The `stage` job runs only after the full `verify` job
     succeeds, on GitHub-hosted `ubuntu-latest`, inside the protected
     `sdk-npm-publish` environment, and runs the package validator
     immediately before `npm stage publish --access public` from
     `packages/assistant-sdk`, staging exactly `@youge/assistant-sdk@0.1.0`
     with `SDK_RELEASE_CONFIRM=publish` (required because staging executes
     the publish lifecycle) and `NODE_AUTH_TOKEN` from `NPM_STAGE_TOKEN`.
     The job cannot run `npm publish`, cannot approve/reject/promote any
     stage, sets no `SDK_RELEASE_ENABLED`, and carries no `id-token: write`.
     **Result: 0.1.0 is STAGED, NOT published** — a public `0.0.0-stage`
     placeholder may appear on the package page while the real `0.1.0` stays
     hidden. The run summary reports the **stage ID** and the approval
     steps below. **Status: OWNER ACTION — not done.**
4. **Owner approves the staged `0.1.0` (this — and only this — publishes
   it).** Sign in to npmjs.com with the publishing account, open
   `@youge/assistant-sdk` → **Staged Packages** tab → review the staged
   `0.1.0` → **Approve** → complete the **2FA** prompt. CLI alternative:
   `npm stage list`, `npm stage view <stage-id>`, then
   `npm stage approve <stage-id> --otp <code>` ([§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)).
   Until the owner approves, `0.1.0` is not installable and nothing has been
   published. **Status: NOT DONE — no authorization to approve has been
   given.**
5. **Revoke the bootstrap immediately after staging succeeded** (do not wait
   for approval): delete the granular token on npmjs.com (Access Tokens →
   delete, or `npm token revoke <id>`) **and** delete the `NPM_STAGE_TOKEN`
   repository secret. The staged `0.1.0` stays in npm's staging area —
   revoking the token does not affect it. **Status: pending step 3.**
6. **Configure OIDC for all later releases** (now that the package exists —
   see [§6](#6-npm-trusted-publishing-oidc)): the protected `sdk-npm-publish`
   **environment** is already created (with required reviewers — verify the
   reviewer protection is actually enforced before the first publish run);
   register the **npm Trusted Publisher** (owner `sandro-defender`, repo
   `you-ge-assistant`, workflow filename `sdk-release-prep.yml`, environment
   `sdk-npm-publish`, allowed action `npm publish`); after step 5 no npm
   token secret remains — **the verify job and the OIDC publish job use no
   npm token**; and set the repository variable `SDK_RELEASE_ENABLED = true`
   only when a later release is explicitly approved — the explicit
   "publishing approved" switch. **Status: OWNER ACTION — see
   [§8](#8-required-follow-ups-before-the-first-publish).**
   - ⚠️ `SDK_RELEASE_ENABLED` must stay **unset** until the owner explicitly
     approves publication; this repository never sets it, and no automation
     may set it.
7. **Publish later releases** — run `sdk-release-prep` with
   `action: publish` and `confirm_publish: publish`. The publish job runs
   only with all gates from step 6 and only on this manual dispatch. It
   authenticates with the short-lived OIDC token minted by
   `id-token: write` — there is no `NODE_AUTH_TOKEN` to leak. The
   `prepublishOnly` hook aborts any publish attempt that lacks
   `SDK_RELEASE_CONFIRM`, but that is an **accidental-publish guard only**: it
   does not make direct publishing impossible, and a person who already holds
   npm publish rights can publish directly (see
   [§5](#5-publishing-remains-disabled)). **`0.1.0` itself never runs this
   job — it is published by step 4's approval.** **Status: pending step 6 —
   not authorized.**
8. **Post-publish smoke test** — `npm view @youge/assistant-sdk version`,
   install the exact version in a scratch project and in staff.you.ge's
   lockfile (see [`MIGRATION.md`](MIGRATION.md)). **Status: pending step 4.**
9. Optionally tag the release commit **after** a successful publish (tags are
   created only as part of an approved release, never by automation on merge).
   **Status: pending step 4 (0.1.0) / step 7 (later releases).**

## 5. Publishing remains disabled

The 0.1.0 release PR removed the package-level `"private": true` lock — that
is runbook step 1 and its intentional review signal. Publishing is still
blocked along every ordinary path: every gate below is closed, and the publish
job requires **all** of them at once. (These are operational guards, not
cryptographic boundaries — see the note at the end of this section.)

| Gate | Mechanism | State |
| --- | --- | --- |
| Workflow trigger | `sdk-release-prep.yml` runs on `workflow_dispatch` **only** (never on push/PR/merge/tag) | **Closed** |
| Explicit authorization | Publish requires manual `action=publish` **and** `confirm_publish=publish` **and** `SDK_RELEASE_ENABLED = 'true'` (the approval variable is not set; repository variables are not readable by this automation — treat as unset). Staging (the first-publication bootstrap) separately requires manual `action=stage` **and** `confirm_stage=stage` **from `main`**, after `verify` — and staging still cannot publish anything | **Closed** |
| Protected environment | `sdk-npm-publish`, **owner-configured with required reviewers**. Verify the reviewer protection is actually enforced before the first publish run (the environment exists — do not recreate it); the `stage` job runs inside it too | **Configured — verify protection** |
| Registry credential | **None on the verify or publish paths.** The publish job authenticates with npm Trusted Publishing (OIDC): the runner mints a short-lived token via `id-token: write`, so no npm token secret exists for verify or OIDC publishing. The separate first-publication `stage` job uses only the temporary `NPM_STAGE_TOKEN` stage-only secret (§6.4) — which cannot push a version live, is scoped to `@youge`, and is revoked and deleted right after staging. The npm-side trusted-publisher registration still has to happen (§6.3) | **Missing — owner action (OIDC registration; stage secret not yet created)** |
| Package-level publish authorization | The `prepublishOnly` hook **refuses any `npm publish` that lacks `SDK_RELEASE_CONFIRM=publish`** — a variable injected only by the gated publish and stage jobs. This is an **accidental-publish guard, not a security boundary**: it stops a stray `npm publish` from a normal shell, but anyone with npm publish rights can set the variable (or pass `--ignore-scripts`) | **Closed (guard only)** |

**Staging is not publishing.** The `stage` job (first-publication bootstrap,
§6.4) does not open any of the gates above: it can only place a version in
npm's staging area with the stage-only token. The staged `0.1.0` becomes a
public, installable version **only** when the owner approves it on npmjs.com
with 2FA (§4 step 4), and the workflow itself can never approve, reject or
promote a stage.

Defense in depth: `validate-package.mjs` fails CI if any workflow gate (or the
OIDC configuration, or the `prepublishOnly` script, or the version contract, or
the stage job's dedicated-secret / manual-only / staging-only gates) is removed
or weakened; standing contracts in `scripts/check.mjs` and regression tests in
`tests/release-gates.test.mjs` enforce this by mutation.

**What the in-repo gates are, and are not.** `SDK_RELEASE_CONFIRM=publish`,
`action=publish`, `confirm_publish` and `SDK_RELEASE_ENABLED` are
**operational / accidental-publish guards**, not cryptographic authorization
boundaries. They stop an ordinary, accidental or unreviewed publish path; they
do **not** stop a person who already holds npm publish rights, who can set the
environment variable themselves, run `npm publish --ignore-scripts`, or publish
directly. **Direct manual publishing is not claimed to be impossible.** The
real authorization boundaries are:

- **npm organization permissions and account security** — who may publish to
  `@youge/*`, and 2FA on the publishing account;
- **the GitHub Actions protected environment** `sdk-npm-publish` and its
  required reviewers — who may approve the workflow run;
- **the npm Trusted Publisher configuration** — npm only accepts a publish
  whose OIDC identity matches the exact registered workflow and environment,
  so the token-less, workflow-scoped credential is the operative gate.

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
| npm auth token (publish job) | **none** — no `NODE_AUTH_TOKEN` on the publish step; the runner mints the OIDC token. The separate first-publication `stage` job uses only the temporary `NPM_STAGE_TOKEN` stage-only secret (§6.4) | machine-checked |
| Provenance | generated automatically over OIDC; the `--provenance` flag is optional (kept explicit here) | publish step |
| `npm stage publish` CLI | npm CLI **≥ 11.15.0** (runs in the workflow's stage job — guarded there; Node 24 ships npm ≥ 11.19.1) and Node ≥ 22.14.0 | docs.npmjs.com/staged-publishing |
| `npm trust` CLI | npm CLI **≥ 11.15.0** (owner action — §6.3) | owner machine |
| GitHub environment | `sdk-npm-publish` (optional on npm; used here for approval) — publish **and** stage jobs | publish/stage jobs |

### 6.2 Workflow configuration (`.github/workflows/sdk-release-prep.yml`)

The `publish` job now:

- runs on `ubuntu-latest` (GitHub-hosted);
- declares `permissions: contents: read` + `id-token: write`;
- pins `node-version: 24` (ships npm ≥ 11.5.1) and sets
  `registry-url: https://registry.npmjs.org` with `package-manager-cache: false`;
- adds a guard step that fails the run unless `npm -v` is ≥ 11.5.1;
- sets **no** npm auth token env — only `SDK_RELEASE_CONFIRM: publish`;
- runs `npm publish --access public --provenance`.

The `stage` job (first-publication bootstrap) now:

- runs only on manual dispatch with `action=stage` **and**
  `confirm_stage=stage`, **from `main`**, and only after `needs: verify`
  succeeds — never on push, pull_request or merge (the workflow has no such
  triggers), so the stage-only token is never exposed to PR or untrusted-branch
  runs;
- runs on `ubuntu-latest` inside the existing protected `sdk-npm-publish`
  environment (created and configured by the owner — never recreated or
  modified here), with `permissions: contents: read` only — **no
  `id-token: write`**: staging needs no OIDC;
- pins `node-version: 24` and guards **npm ≥ 11.15.0** (the staged-publishing
  requirement) with an explicit failing check;
- runs `node packages/assistant-sdk/scripts/validate-package.mjs`
  **immediately before** staging;
- runs `npm stage publish --access public` from `packages/assistant-sdk` with
  `SDK_RELEASE_CONFIRM=publish` (staging executes the publish lifecycle, so the
  package's `prepublishOnly` guard requires it — accidental-publish guard only)
  and `NODE_AUTH_TOKEN` from the dedicated **`NPM_STAGE_TOKEN`** secret. The
  authentication is the exact supported setup-node mechanism: with
  `registry-url: https://registry.npmjs.org`, `actions/setup-node` writes an
  `.npmrc` that reads `${NODE_AUTH_TOKEN}` from the environment (GitHub's
  documented npm-in-CI pattern), so the token is supplied only as that one
  step's env — never echoed, interpolated into command text, persisted or
  uploaded;
- never runs `npm publish`, never runs `npm stage approve` / `npm stage
  reject` (approval is the owner's decision on npmjs.com), never sets
  `SDK_RELEASE_ENABLED`, and carries no other npm token secret;
- writes a run summary that reports the **stage ID**, the **staged-NOT-
  published** state, the possible public **`0.0.0-stage` placeholder**, and
  the owner's approval/revocation/OIDC-migration steps.

`action=verify` is unchanged and remains completely non-publishing (and
token-free).

### 6.3 Registering the trusted publisher (owner action)

A trusted publisher is configured **from the package's settings page** on
npmjs.com (or with the `npm trust` CLI). `@youge/assistant-sdk` does **not**
exist on the registry yet, so it cannot be registered until the package exists —
see §6.4.

`npm trust` prerequisites (official `npm-trust` docs, npm CLI 12):

- **npm CLI ≥ 11.15.0** (`npm install -g npm@^11.15.0`, or run via `npx npm@latest`);
- **write permission** on the package;
- **2FA enabled** on the account (granular tokens with *bypass 2FA* are **not**
  accepted for `npm trust`; legacy basic auth is also not accepted);
- **the package must already exist** on the registry.

#### Configure it on the website (preferred)

Open npmjs.com → `@youge/assistant-sdk` → **Settings** → **Trusted publisher**
→ **GitHub Actions** and enter:

| Field | Value |
| --- | --- |
| Organization or user | `sandro-defender` |
| Repository | `you-ge-assistant` |
| Workflow filename | `sdk-release-prep.yml` (filename only — no `.github/workflows/` path) |
| Environment name | `sdk-npm-publish` |
| Allowed actions | `npm stage publish` is **always** allowed; choose whether this connection may also run `npm publish` and/or manage dist-tags |

#### Or from the CLI

```bash
npm trust github @youge/assistant-sdk \
  --repo sandro-defender/you-ge-assistant \
  --file sdk-release-prep.yml \
  --environment sdk-npm-publish \
  --allow-publish --yes
```

`npm trust github` accepts `--repo/--repository`, `--env/--environment`,
`--allow-publish`, `--allow-stage-publish` (alias `--allow-staged-publish`),
plus `--dry-run`, `--json`, `--registry` and `-y/--yes`; at least one of the
two `--allow-*` flags is required. The first request needs 2FA.

**Reconciling the documented limits (important).** The npm website's
*Trusted publishers* page states that **each package can have up to 10
trusted publisher connections at the same time**, each added or deleted
independently. The CLI reference for `npm trust` still says *"the registry only
supports one configuration per package"* and instructs you to
`npm trust list` → `npm trust revoke --id <id>` → create a new one in order to
replace it. Where the two disagree, **trust the website UI** — it is the
current, UI-backed behaviour — and use the CLI for `list`/`revoke`. This
workflow needs exactly one connection.

**Other current behaviours worth knowing:**

- **A newly created trusted publisher must complete its first successful
  publish within 2 days**, or it expires and must be re-created.
- **Existing connections cannot be edited** — the provider and required fields
  are fixed once created; delete the connection and create a new one to change
  them.
- **Provenance is generated automatically** when publishing via OIDC from
  GitHub Actions or GitLab CI/CD, so the `--provenance` flag is not required
  (the workflow keeps it explicit). It requires a public repository and a
  public package; it is not supported for CircleCI.
- **Dist-tags** (`npm dist-tag`) over OIDC require npm CLI ≥ 11.21.0 / 12.2.0
  and need **"Allow npm dist-tag"** selected for that connection (disabled by
  default); it is independent of the publish/stage permission.
- **Stage-only permissions are the maximum-security posture**: allow
  `npm stage publish` but not `npm publish`, so every CI-published version is
  reviewed and approved by a maintainer with 2FA.
- npm does **not** validate the configuration when it is saved; mismatches only
  surface at publish time. Double-check the repository, the workflow filename
  (exact, including the `.yml` extension) and the environment.
- **`repository.url` in `package.json` must exactly match the GitHub
  repository** — machine-checked by `validate-package.mjs`.

#### Recommended: restrict token access once trusted publishing works

Package **Settings** → **Publishing access** → **"Require two-factor
authentication and disallow tokens"**, then revoke any automation tokens that
are no longer needed. This only affects traditional token authentication;
trusted publishers keep working because they use OIDC.

### 6.4 The first publish of a new package cannot use OIDC (important)

npm only allows a trusted publisher to be configured **for a package that
already exists** on the registry (`npm-trust` docs: *"Package must exist: The
package you're configuring must already exist on the npm registry."*).
`@youge/assistant-sdk@0.1.0` is unpublished, so the **first** release must be
bootstrapped before OIDC can be used for subsequent releases — by the GitHub
Actions `stage` job below (no PC terminal required), or, as a deprecated
fallback, by hand from a PC terminal (Path B).

#### Do not rely on `npm login` for this step

`npm login` (with the default `--auth-type=web`, or `--auth-type=legacy`)
**saves credentials to `.npmrc`**, and the npm CLI reference states that it
*"automatically generates a legacy token of `publish` type"*. That token is a
long-lived credential that sits on disk until you run `npm logout`. This is
**not** a tokenless path and must not be described as one.

There is also a conflict inside npm's own documentation: the current *About
access tokens* page says that **as of November 2025 only granular access tokens
are supported and legacy access tokens have been removed**, while the (older)
`npm-login` reference still describes the legacy-token behaviour above. Because
the two disagree, do **not** depend on `npm login` producing a usable,
least-privilege credential. The path below avoids that ambiguity entirely.

#### Recommended: a minimum-permission granular access token

As of November 2025 npm supports **granular access tokens** only. They can be
scoped to specific packages **or scopes**, restricted by IP range, given a
**short expiry**, and — importantly for this step — granted **write** access so
they can publish. Granular tokens cannot be created from the CLI yet: create one
on npmjs.com. The CLI reference documents the granular options, but the website's
*Creating and viewing access tokens* page states CLI support *"will be added in
the future"* — **prefer the website UI**.

**Can the token be scoped before the package exists? — yes, to the `@youge`
scope.** Granular tokens are not limited to individual packages: the *Creating
and viewing access tokens* page says to choose *"up to 50 specific packages or
scopes"*. The `@youge` scope is already registered on the registry (org/scope
`youge` exists), so the token **can** be limited to `@youge` before
`@youge/assistant-sdk` exists. Once the package exists, narrow it further to
`@youge/assistant-sdk` itself.

Two scoping traps to avoid:

- **Do not use the *Organizations* section of the form.** Granting a token
  access to an organization only lets it manage that organization's settings,
  teams and members — npm states explicitly that *"It does not give the token
  the right to publish packages managed by the organization."* Use the
  **Packages and scopes** section instead.
- **If the dropdown does not offer the `@youge` scope before the package
  exists, stop and verify** (with npm support or the owner) rather than silently
  falling back to **All Packages**. All Packages is broad enough that it should
  only be accepted deliberately, with the shortest expiry, and revoked
  immediately.

Create the token on npmjs.com → profile menu → **Access Tokens** →
**Generate New Token** → **Granular Access Token**, with the **minimum** set
of permissions:

| Setting | Value | Why |
| --- | --- | --- |
| Token name | e.g. `first-publish-0.1.0` | easy to identify and revoke |
| Packages and scopes | `@youge` scope (or `@youge/assistant-sdk` once it exists) | least privilege — never "All Packages" |
| Permissions | **Read and write (stage only)** | a stage-only token cannot push a version live by itself |
| Bypass two-factor authentication | **unchecked (false)** | not needed — see below |
| Allowed IP ranges | leave unset — the job runs on GitHub-hosted `ubuntu-latest` runners, whose egress IPs change | IP pinning would break the stage job |
| Expiration | the **shortest** available date (must be ≥ 1 day in the future) | the token should not outlive the task |

**No `Bypass 2FA` is needed, and it should stay off.** The `npm stage`
documentation's token-behavior table states that a granular access token
**without** bypass **can stage** (`npm publish` would prompt for 2FA instead),
and npm's own best practice is to *"create a GAT without bypass and use
`npm stage publish`"*. Bypass is only relevant to *direct* publishing, and
setting it to true overrides account- and package-level 2FA — leave it off.

Then use it **only** for the staging run (owner step 3 below) and **revoke it
immediately after staging succeeded** — approval of the staged version can
happen later and does not need the token.

> ⚠️ **Credential hygiene.** The token's only permitted storage is the
> dedicated GitHub Actions secret **`NPM_STAGE_TOKEN`**, referenced solely by
> this workflow's `stage` job inside the protected `sdk-npm-publish`
> environment and deleted immediately after staging. It must never appear in
> repository files, a committed `.npmrc`, shell history, CI logs or artifacts,
> or any chat/agent transcript. Nothing in this repository creates, stores or
> requests its value — it is an owner action documented here so the first
> release is not a dead end. Ordinary runs need no credential at all: the
> `action=verify` checklist and the OIDC publish job use **no npm token**.

Two paths, in order of preference.

**Does `npm stage publish` run the package's `prepublishOnly`? — yes, verified
rather than assumed.** `npm stage publish` is implemented in the npm CLI as
`StagePublish extends Publish` (`npm/cli` → `lib/commands/stage/publish.js`), so
it runs the **entire `npm publish` lifecycle**, including `prepublishOnly`
(before packing), `prepack` / `prepare` / `postpack` (during packing) and
`publish` / `postpublish` (after the registry call). The only difference is that
staging calls the registry with `stage: true` and **bypasses the 2FA prompt**,
deferring proof-of-presence to the approve step. Staging also respects
`"private": true` and refuses with `EPRIVATE`.

Caveat: the npm docs' *Scripts* page still says `prepublishOnly` runs *"ONLY on
`npm publish`"* and lists no `npm stage` entry in its lifecycle order. That page
predates the stage subcommand; the CLI source above is authoritative. **The
workflow's staging command therefore keeps `SDK_RELEASE_CONFIRM=publish`** —
the package's `prepublishOnly` refuses without it (§5).

**Path A — GitHub Actions staging (recommended, implemented).** The `stage`
job of `sdk-release-prep.yml` runs `npm stage publish --access public` for
you; you never touch a PC terminal. `npm stage publish` uploads the version to
a staging area; it does **not** go live, and a maintainer with 2FA must approve
it. It works for brand-new packages: npm exposes a public `0.0.0-stage`
placeholder, while the real version stays hidden until approved. Requires
**npm CLI ≥ 11.15.0** and Node ≥ 22.14.0 (both enforced by the job's guard
step on Node 24).

**Owner procedure (all on the website):**

1. **Create the stage-only token** — the granular token table above
   (`@youge` scope, **Read and write (stage only)**, **Bypass 2FA** unchecked,
   shortest expiry).
2. **Add the GitHub Actions secret** — repository → **Settings → Secrets and
   variables → Actions → New repository secret** → name exactly
   **`NPM_STAGE_TOKEN`**, value = the token. This is a **temporary bootstrap
   credential, not the future publishing method**: once the package exists,
   npm Trusted Publishing (OIDC) takes over (§6.3) and the secret is deleted.
   (Repository secret only — the protected `sdk-npm-publish` environment is
   not created or modified.)
3. **Dispatch the workflow** — `sdk-release-prep`, `action: stage`,
   `confirm_stage: stage`, from the **`main`** branch. The job re-runs the
   full verify checklist first (`needs: verify`), then the package validator
   immediately before staging, then stages exactly `@youge/assistant-sdk@0.1.0`
   with public access. The run summary reports the **stage ID** and states
   explicitly that **0.1.0 is staged, not published** — including the possible
   public `0.0.0-stage` placeholder on a brand-new package. The job cannot run
   `npm publish` and cannot approve, reject or promote a stage.
4. **Review and approve on npmjs.com with account 2FA** — open the package →
   **Staged Packages** tab → review the staged `0.1.0` → **Approve** → 2FA.
   This — and only this — publishes `0.1.0`. (CLI alternative in the next
   paragraph.)
5. **Revoke immediately after staging succeeded** — delete the granular token
   (npmjs.com → Access Tokens → delete, or `npm token revoke <id>`) **and**
   delete the `NPM_STAGE_TOKEN` secret. The staged version is unaffected.
6. **Register OIDC** (§6.3) so every later release publishes with no token.

**`npm stage approve` syntax (verified).** `npm stage approve <stage-id>` takes
`--otp <code>` (a two-factor one-time password) and `--registry`. If `--otp` is
omitted and the registry challenges for a one-time password, npm **prompts
interactively** — so the flag is optional, not required. `npm stage reject
<stage-id>` accepts the same flags. `npm stage list`, `npm stage view` and
`npm stage download` take only `--json` / `--registry` and **do not** require
2FA; `npm stage list` and `npm stage view` accept an optional `<package-spec>`.
These are **owner-run review commands** — the workflow itself never executes
approve or reject (machine-checked).

**What happens to the version.** Staging a package that does not yet exist
publishes a public **`0.0.0-stage` placeholder**; the staged `0.1.0` and its
contents stay hidden until a maintainer approves it. Approval can happen in the
CLI or on npmjs.com (**Staged Packages** tab → **Approve**) and **always prompts
for 2FA**. After approval, the staged `0.1.0` is published to the package page.

Two constraints to keep in mind:

- **Staged versions share the same semver unique index as published ones** —
  once `0.1.0` is staged, that name+version can never be published again.
- **The `--tag` is immutable** for a staged package. A pre-release must carry
  its tag explicitly (`npm stage publish --tag next`), exactly as for
  `npm publish`.

**Path B — direct publish from a PC terminal (fallback, deprecated).** Run
`SDK_RELEASE_CONFIRM=publish npm publish --access public` yourself in
`packages/assistant-sdk` with the same granular token in the environment. The
workflow deliberately never takes this path. Note that **direct publishing with
a granular access token is being deprecated**: npm has announced it will be
removed in **January 2027**, so prefer Path A.

Both paths:

- pass `--access public` explicitly so the scoped package is public;
- **do not** add `--provenance`: a manual publish produces **no OIDC
  provenance**, and `--provenance` must not be claimed for it;
- must not reuse a name+version combination — npm never allows republishing an
  exact name+version. So if provenance on the very first version matters,
  bootstrap a **pre-release** instead: publish e.g. `0.1.0-rc.1` by hand under
  the `next` tag (`--tag next`), register the trusted publisher, then publish
  the real `0.1.0` through the OIDC workflow so the public `latest` release
  carries provenance.

#### After the package exists: register OIDC and use it for every release

1. **Register the trusted publisher** (§6.3) — the website form or
   `npm trust github ...`.
2. **Restrict token access** (recommended, §6.3): package **Settings** →
   **Publishing access** → *"Require two-factor authentication and disallow
   tokens"*, then revoke any automation tokens.
3. **Publish subsequent versions via the workflow** (§4 step 7) — the publish
   job authenticates with the short-lived OIDC token and produces provenance
   automatically.

#### If none of this is acceptable to the owner

If the owner would rather not create and revoke a granular token at all, stop
here and ask: the remaining alternative is an interactive browser login
(`npm login`), which persists a legacy publish token to `.npmrc` and needs
`npm logout` afterwards — and npm's own docs disagree about whether legacy
tokens still exist. **Owner approval is required before any such credential is
created.** This repository does not create, store or request it.

### 6.5 What is enforced automatically

`packages/assistant-sdk/scripts/validate-package.mjs` — and the standing
contracts in `scripts/check.mjs`, plus the mutation tests in
`tests/release-gates.test.mjs` and `tests/release-security-wording.test.mjs`
— fail if any of the following is weakened:

- `id-token: write` present on the publish job;
- `registry-url: https://registry.npmjs.org` on the publish job;
- the publish job runs on a GitHub-hosted runner (`ubuntu-latest`);
- the publish job pins Node 24 (npm ≥ 11.5.1 / Node ≥ 22.14);
- **any** npm token credential appears outside the dedicated `stage` job —
  `NODE_AUTH_TOKEN` / `secrets.NPM_STAGE_TOKEN` are allowed only there, only
  as the staging step's env declaration (never in command text), and no other
  npm token secret (e.g. `secrets.NPM_TOKEN`) exists anywhere;
- the `stage` job loses any bootstrap gate: `action=stage` +
  `confirm_stage=stage`, the `refs/heads/main` guard, `needs: verify`, the
  protected `sdk-npm-publish` environment, `contents: read` **without**
  `id-token: write`, the npm ≥ 11.15.0 guard, `npm stage publish` (never a
  direct `npm publish`), the absence of `npm stage approve`/`reject`, the
  validator immediately before staging, `SDK_RELEASE_CONFIRM: publish` on the
  staging step, or the staged-NOT-published summary with the `0.0.0-stage`
  placeholder;
- `repository.url` matches the canonical GitHub repository;
- the `verify` job contains no `npm publish` step (it stays non-publishing);
- `SDK_RELEASE_ENABLED` is never hardcoded in the workflow (it stays a
  repository variable);
- the workflow does **not** claim the in-repo gates make direct publishing
  impossible, and frames `SDK_RELEASE_CONFIRM` as an accidental-publish guard
  (an explicit standing contract in `scripts/check.mjs`);
- the manual-only trigger, `confirm_publish`, `confirm_stage`,
  `SDK_RELEASE_ENABLED`, the protected `sdk-npm-publish` environment and
  `SDK_RELEASE_CONFIRM: publish` are all intact;
- any token-shaped value (`npm_…`), committed `.npmrc`, or secret reference
  outside `NPM_STAGE_TOKEN` appears anywhere in the repository
  (`tests/release-gates.test.mjs`).

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
| GitHub environment inventory | ✅ `sdk-npm-publish` **owner-configured** with required reviewers (verified 2026-11-06); the reviewer protection itself is not readable by automation (HTTP 403) — owner confirms it before the first publish run |
| `SDK_RELEASE_ENABLED` visibility | ⚠️ not readable by automation (HTTP 403); treat as unconfigured, owner verifies |
| Consumer install smoke test (packed tarball, exact name/version) | ✅ see the release PR for the run log |

### OIDC trusted-publishing migration pass

| Check | Command | Result |
| --- | --- | --- |
| Workflow OIDC config | `grep -n "id-token: write\|registry-url\|node-version: 24"` | ✅ publish job has `id-token: write`, `registry-url: https://registry.npmjs.org`, `node-version: 24`, `package-manager-cache: false`, npm ≥ 11.5.1 guard |
| No long-lived token | `grep -n "NODE_AUTH_TOKEN\|secrets.NPM_TOKEN" .github/workflows/sdk-release-prep.yml` | ✅ no matches — publish step sets only `SDK_RELEASE_CONFIRM` |
| Validator OIDC gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ 12/12 release-workflow gates pass |
| Standing contracts | `npm run check` | ✅ 273 static assertions + **152/152** tests pass, 0 fail |
| `verify` job stays non-publishing | mutation tests (`release-gates.test.mjs`) | ✅ validator and `check.mjs` both fail when the verify job gains an `npm publish` step |
| Approval variable not hardcoded | mutation test (`release-gates.test.mjs`) | ✅ validator fails when `SDK_RELEASE_ENABLED` is set in the workflow |
| Registry identity unchanged | `npm view @youge/assistant-sdk version` | ✅ HTTP 404 — still unpublished; **not published by this task** |
| `action=verify` non-publishing | workflow review | ✅ verify job runs checks only; no publish path |
| Trusted publisher registration | owner action | ⚠️ **not done** — requires the package to exist first (§6.4); no secrets created or modified |
| `sdk-npm-publish` environment | owner-configured | ✅ exists with required reviewers; **not created or changed by this task** |

### npm-authentication / security-wording documentation pass (2026-11-07)

Corrections made after review, with the official npm docs (npm CLI 12 /
npmjs.com) as the source of truth:

| Finding | Correction |
| --- | --- |
| `npm login` was documented as a **tokenless** first-publish path | The `npm-login` reference states it *"automatically generates a legacy token of `publish` type"* and saves credentials to `.npmrc`. Removed every "no token"/"tokenless" claim; documented credential hygiene and `npm logout`. |
| Legacy vs granular tokens | The current *About access tokens* page says legacy tokens were **removed in November 2025** and only granular access tokens are supported — an internal conflict with the `npm-login` page. Documented the conflict and stopped relying on `npm login`. |
| No short-lived publish credential was offered | Granular access tokens (website-only creation, ≤ 50 packages/scopes, short expiry, optional CIDR) **can** publish. Documented the minimum-permission token and **immediate revocation**. |
| Direct token publishing treated as permanent | npm is **deprecating direct publishing with a granular access token — removed January 2027**. Documented **staged publishing** (`npm stage publish` + maintainer approval with 2FA) as the recommended path. |
| `prepublishOnly` described as making direct publishing impossible | Reworded in the workflow header, the publish-step comment and §4/§5 to an **accidental-publish guard only**, with the real boundaries listed. |
| Trusted-publisher limit stated as one config per package | The website's *Trusted publishers* page allows **up to 10 connections per package**; the CLI reference still says one. Documented both and prefers the website UI. |
| Trusted-publisher behaviour gaps | Added the 2-day first-publish validation window, immutable connections (delete + re-create), automatic provenance (no `--provenance` needed), dist-tag permission (npm ≥ 11.21.0 / 12.2.0), and stage-only as the maximum-security posture. |

| Check | Command | Result |
| --- | --- | --- |
| Static checks + all tests | `npm run check` (root) | ✅ **275** static `PASS`, **165/165** tests pass, 0 fail |
| Validator OIDC gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ 12/12 release-workflow gates pass |
| Security-wording contracts | `node --test tests/release-security-wording.test.mjs` | ✅ 13/13 pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 29/29 pass |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Pack contents | `npm pack --dry-run` | ✅ 19 files, 33.5 kB packed / 132.4 kB unpacked |
| Consumer build | `npm ci && npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Registry identity unchanged | `npm view @youge/assistant-sdk version` | ✅ HTTP 404 — still unpublished; **not published by this task** |

### Staged-bootstrap audit (2026-11-07)

The first-publish staged bootstrap was audited against the current official npm
documentation **and the npm CLI source**, not assumed:

| # | Question | Verified answer |
| --- | --- | --- |
| 1 | Can a granular stage-only token be restricted to the `@youge` scope before `@youge/assistant-sdk` exists? | **Yes.** Granular tokens can be limited to *"up to 50 specific packages or scopes"*, and the `@youge` scope is already registered. Use the **Packages and scopes** section — the *Organizations* section only grants org-management rights and *"does not give the token the right to publish packages managed by the organization."* |
| 2 | What is the safest available permission configuration? | **Read and write (stage only)**, scoped to `@youge` (narrow to `@youge/assistant-sdk` once it exists), **Bypass 2FA unchecked**. npm's token-behavior table states a GAT **without** bypass can stage, and npm's own best practice is to *"create a GAT without bypass and use `npm stage publish`"*. |
| 3 | Does `SDK_RELEASE_CONFIRM=publish npm stage publish --access public` run `prepublishOnly`? | **Yes.** `npm/cli` implements `npm stage publish` as `StagePublish extends Publish` (`lib/commands/stage/publish.js`), so it runs the whole `npm publish` lifecycle: `prepublishOnly`, `prepack` / `prepare` / `postpack`, `publish` / `postpublish`. The only difference is `stage: true` on the registry call, which bypasses the 2FA prompt. Note the npm docs' *Scripts* page still says `prepublishOnly` runs *"ONLY on `npm publish`"* and lists no `npm stage` entry — that page predates the subcommand; the CLI source is authoritative. |
| 4 | Exact `npm stage approve` syntax; is `--otp` supported? | `npm stage approve <stage-id>` takes **`--otp <code>`** and `--registry`. `--otp` is **optional** — if omitted and the registry challenges, npm **prompts interactively**. `npm stage reject <stage-id>` takes the same flags. `npm stage list` / `view` / `download` take only `--json` / `--registry` and need **no** 2FA. |
| 5 | Placeholder `0.0.0-stage` behaviour | Staging a package that does not exist publishes a public **`0.0.0-stage` placeholder**; the staged `0.1.0` and its contents stay hidden until a maintainer approves with 2FA (CLI or npmjs.com → Staged Packages → Approve), after which `0.1.0` is published to the package page. Staged versions share the **same semver unique index** as published ones, and the **`--tag` is immutable** once staged. |
| 6 | Credential exposure | The documented procedure supplies the token only to the stage job's staging step (as the `NODE_AUTH_TOKEN` env that setup-node's `registry-url` `.npmrc` reads) and states explicitly that it must never appear in repository files, a committed `.npmrc`, shell history, CI logs or artifacts, or any chat/agent transcript; its only permitted storage is the dedicated **`NPM_STAGE_TOKEN`** Actions secret, deleted immediately after staging. No token was created by this work. |

No token was created, no publish or staging was performed, and no workflow was
dispatched for this audit.

### GitHub Actions first-publication staging implementation pass (2026-11-06)

The first-publication staging flow was implemented as a separate `stage` job
in `sdk-release-prep.yml` and verified against the current official npm and
GitHub documentation (not assumed):

| Check | Command / source | Result |
| --- | --- | --- |
| npm CLI requirement for staging | docs.npmjs.com/staged-publishing | ✅ **npm ≥ 11.15.0** and **Node ≥ 22.14.0** — guarded by an explicit failing step in the stage job |
| Node 24 bundled npm (setup-node toolchain) | `nodejs/node` `deps/npm/package.json` on `v24.x` | ✅ npm **11.19.1** ≥ 11.15.0 (guard kept regardless) |
| Stage-only token semantics | docs.npmjs.com/about-access-tokens, docs.npmjs.com/creating-and-viewing-access-tokens | ✅ *Read and write (stage only)*, scoped, no bypass — direct publish rejected (`E_STAGE_REQUIRED`), maintainer 2FA approval required |
| GitHub Actions npm authentication | docs.github.com (Publishing Node.js packages / Building and testing Node.js) + `actions/setup-node` source (`src/authutil.ts`, v4 tag) | ✅ `registry-url` makes setup-node write `$RUNNER_TEMP/.npmrc` containing `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` and export `NPM_CONFIG_USERCONFIG`; the token is supplied as the step's `NODE_AUTH_TOKEN` env (npm expands the placeholder — verified locally) |
| `npm stage publish` output / lifecycle | `npm/cli` `lib/commands/stage/publish.js`, `lib/commands/publish.js` | ✅ prints `+ <name>@<version> (staged with id <uuid>)` (the run summary parses it) and runs the full publish lifecycle (`StagePublish extends Publish`) |
| Approval on the website | docs.npmjs.com/staged-publishing | ✅ npmjs.com → **Staged Packages** tab → **Approve**, always prompts for 2FA |
| Stage job gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ all **25** release-workflow gates pass (incl. 13 stage-job gates: manual-only + `confirm_stage`, `refs/heads/main`, `needs: verify`, protected environment, least-privilege, dedicated secret, env-only token, `npm stage publish` only, no approve/reject, npm ≥ 11.15.0, staged-NOT-published summary) |
| Standing contracts | `node scripts/check.mjs` | ✅ all pass |
| Release-gate mutation tests | `node --test tests/release-gates.test.mjs` | ✅ 39/39 pass |
| Security-wording tests | `node --test tests/release-security-wording.test.mjs` | ✅ 15/15 pass |
| Full root suite | `npm run check` | ✅ see the PR run log |
| Registry state | `npm view @youge/assistant-sdk version` | HTTP 404 — **not staged, not published** |
| Secrets / environments / variables / tags | — | **none created, modified or requested by this task** |
| Dispatches / staging / publishing | — | **none executed by this task** |

## 8. Required follow-ups (before the first publish)

Owner actions remaining (nothing in this repository can complete them):

1. **npmjs.com:** confirm the publishing npm user (`you-ge`) has publish
   rights on the org `youge` (registry APIs do not expose org membership).
2. **Verify the `sdk-npm-publish` environment** the owner created actually
   enforces its required-reviewer protection (the environment exists; this
   automation cannot read its protection rules — HTTP 403 — so the owner
   confirms it before the first staging/publish run). Do **not** recreate it.
3. **Stage the first publication via GitHub Actions** (the package does not
   exist yet, so OIDC cannot be used for it): create the minimum-permission
   **stage-only granular access token** on npmjs.com (3a), add it as the
   repository Actions secret **`NPM_STAGE_TOKEN`** (3b), and dispatch
   `sdk-release-prep` with `action=stage` + `confirm_stage=stage` from `main`
   (3c) — see [§4](#4-release-runbook-when-a-release-is-approved) step 3 and
   [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important).
   This **stages** `0.1.0` (a public `0.0.0-stage` placeholder may appear);
   it does **not** publish it. **Owner approval is required before any
   credential is created**; this repository does not create, store or request
   its value.
4. **Approve the staged `0.1.0` on npmjs.com with account 2FA** (Staged
   Packages tab → Approve) — this, and only this, publishes `0.1.0`
   ([§4](#4-release-runbook-when-a-release-is-approved) step 4).
5. **Revoke the bootstrap immediately after staging succeeded**: delete the
   granular token and the `NPM_STAGE_TOKEN` secret ([§4](#4-release-runbook-when-a-release-is-approved)
   step 5). The staged version is unaffected.
6. **Register the npm Trusted Publisher** for the workflow now that the
   package exists (§6.3), keep `SDK_RELEASE_ENABLED` **unset** until a later
   release is explicitly approved, and once OIDC works **restrict token
   access** (Settings → Publishing access → "Require two-factor
   authentication and disallow tokens") — no npm token secret remains after
   step 5.
7. **Later releases** — run `sdk-release-prep` with `action=publish` and
   `confirm_publish=publish` ([§4](#4-release-runbook-when-a-release-is-approved)
   step 7), then the post-publish smoke tests (step 8) and optional tag
   (step 9). (`0.1.0` itself completes at §4 step 4 — approval, not this job.)
8. Migrate staff.you.ge off the vendored copy per
   [`MIGRATION.md`](MIGRATION.md) after the first published version.

---

*Release-preparation documentation reviewed with the `ui-ux-pro-max-skill`
guidance. The skill's "When to Apply" section says to skip it for
infrastructure/DevOps work that does not change how something looks, feels,
moves or is interacted with — this first-publication staging work is
infrastructure/DevOps only, so its design-system search workflow was not run
(no UI surface changed and none may change). Its documentation guidance
(status first, scannable tables, atomic runbook steps with explicit
guard/failure states) was used to structure the staging procedure above.
Skill record: [`../../DESIGN_FOUNDATION.md`](../../DESIGN_FOUNDATION.md) §10
and §13.*
