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
   the protected `sdk-npm-publish` **environment** is already created (with
   required reviewers — verify the reviewer protection is actually enforced
   before the first publish run), register the **npm Trusted Publisher**
   (owner `sandro-defender`, repo `you-ge-assistant`, workflow filename
   `sdk-release-prep.yml`, environment `sdk-npm-publish`, allowed action
   `npm publish`), and set the repository variable `SDK_RELEASE_ENABLED = true`
   — the explicit "publishing approved" switch. **No npm token secret is
   created.** **Status: OWNER ACTION — see
   [§8](#8-required-follow-ups-before-the-first-publish).**
   - ⚠️ `SDK_RELEASE_ENABLED` must stay **unset** until the owner explicitly
     approves publication; this repository never sets it, and no automation
     may set it.
   - ⚠️ The trusted publisher can only be registered once the package **exists**
     on the registry; the very first release must be bootstrapped by hand first
     ([§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)).
4. **Publish** — run the `sdk-release-prep` workflow with `action: publish`
   and `confirm_publish: publish`. The publish job runs only with all gates
   from step 3 and only on this manual dispatch. It authenticates with the
   short-lived OIDC token minted by `id-token: write` — there is no
   `NODE_AUTH_TOKEN` to leak. The `prepublishOnly` hook aborts any publish
   attempt that lacks `SDK_RELEASE_CONFIRM`, but that is an
   **accidental-publish guard only**: it does not make direct publishing
   impossible, and a person who already holds npm publish rights can publish
   directly (see [§5](#5-publishing-remains-disabled)). **Status: NOT DONE — no
   authorization to publish has been given.**
5. **Post-publish smoke test** — `npm view @youge/assistant-sdk version`,
   install the exact version in a scratch project and in staff.you.ge's
   lockfile (see [`MIGRATION.md`](MIGRATION.md)). **Status: pending step 4.**
6. Optionally tag the release commit **after** a successful publish (tags are
   created only as part of an approved release, never by automation on merge).
   **Status: pending step 4.**

## 5. Publishing remains disabled

The 0.1.0 release PR removed the package-level `"private": true` lock — that
is runbook step 1 and its intentional review signal. Publishing is still
blocked along every ordinary path: every gate below is closed, and the publish
job requires **all** of them at once. (These are operational guards, not
cryptographic boundaries — see the note at the end of this section.)

| Gate | Mechanism | State |
| --- | --- | --- |
| Workflow trigger | `sdk-release-prep.yml` runs on `workflow_dispatch` **only** (never on push/PR/merge/tag) | **Closed** |
| Explicit authorization | Publish requires manual `action=publish` **and** `confirm_publish=publish` **and** `SDK_RELEASE_ENABLED = 'true'` (the approval variable is not set; repository variables are not readable by this automation — treat as unset) | **Closed** |
| Protected environment | `sdk-npm-publish`, **owner-configured with required reviewers**. Verify the reviewer protection is actually enforced before the first publish run (the environment exists — do not recreate it) | **Configured — verify protection** |
| Registry credential | **None.** Authentication is npm Trusted Publishing (OIDC): the runner mints a short-lived token via `id-token: write`. No npm token secret exists or is needed. The npm-side trusted-publisher registration still has to happen (§6.3) | **Missing — owner action** |
| Package-level publish authorization | The `prepublishOnly` hook **refuses any `npm publish` that lacks `SDK_RELEASE_CONFIRM=publish`** — a variable injected only by the gated publish job. This is an **accidental-publish guard, not a security boundary**: it stops a stray `npm publish` from a normal shell, but anyone with npm publish rights can set the variable (or pass `--ignore-scripts`) | **Closed (guard only)** |

Defense in depth: `validate-package.mjs` fails CI if any workflow gate (or the
OIDC configuration, or the `prepublishOnly` script, or the version contract) is
removed or weakened; standing contracts in `scripts/check.mjs` and regression
tests in `tests/release-gates.test.mjs` enforce this by mutation.

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
| npm auth token | **none** — no `NODE_AUTH_TOKEN` on the publish step; the runner mints the OIDC token | machine-checked |
| Provenance | generated automatically over OIDC; the `--provenance` flag is optional (kept explicit here) | publish step |
| `npm trust` / `npm stage publish` CLI | npm CLI **≥ 11.15.0** (owner bootstrap only — §6.3 / §6.4) | owner machine |
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
bootstrapped by hand before OIDC can be used for subsequent releases.

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
scoped to specific packages/scopes, restricted by IP range, given a **short
expiry**, and — importantly for this step — granted **write** access so they
can publish. Granular tokens cannot be created from the CLI yet: create one on
npmjs.com. The CLI reference documents the granular options, but the website's
*Creating and viewing access tokens* page states CLI support *"will be added in
the future"* — **prefer the website UI**.

Create the token on npmjs.com → profile menu → **Access Tokens** →
**Generate New Token** → **Granular Access Token**, with the **minimum** set
of permissions:

| Setting | Value | Why |
| --- | --- | --- |
| Token name | e.g. `first-publish-0.1.0` | easy to identify and revoke |
| Packages and scopes | `@youge/assistant-sdk` (or the `@youge` scope) only | least privilege — never "All Packages" |
| Permissions | **Read and write (stage only)** for the safest path; **Read and write (publish and stage)** only if a direct publish is wanted | a stage-only token cannot push a version live by itself |
| Bypass two-factor authentication | **unchecked (false)** | keep account- and package-level 2FA enforced |
| Allowed IP ranges | your publish machine, if it has a stable address | optional but recommended |
| Expiration | the **shortest** available date (must be ≥ 1 day in the future) | the token should not outlive the task |

Then use it **only** for the initial publish and **revoke it immediately
afterwards**.

> ⚠️ **Credential hygiene.** Never put this token in repository files, in a
> committed `.npmrc`, in shell history, in CI logs, in GitHub secrets, or in any
> chat/agent transcript. Pass it to the CLI through an environment variable for
> a single command, then revoke it. Nothing in this repository creates, stores
> or requests it — it is an owner action documented here so the first release
> is not a dead end.

Two concrete paths, in order of preference:

**Path A — staged publishing (recommended).** `npm stage publish` uploads the
version to a staging area; it does **not** go live, and a maintainer with 2FA
must approve it. It works for brand-new packages: npm publishes a public
`0.0.0-stage` placeholder, while the real version stays hidden until approved.
Requires **npm CLI ≥ 11.15.0** and Node ≥ 22.14.0.

```bash
# 1. Create the granular token above (stage-only), then use it for one command.
#    It is read from the environment — never written to a file or a secret.
cd packages/assistant-sdk
SDK_RELEASE_CONFIRM=publish npm stage publish --access public

# 2. A maintainer reviews and approves with 2FA (CLI or npmjs.com →
#    Staged Packages → Approve). The package's prepublishOnly re-runs
#    validation and REQUIRES SDK_RELEASE_CONFIRM=publish for this command too —
#    that variable is an accidental-publish guard only (see §5).
npm stage list
npm stage view <stage-id>
npm stage approve <stage-id> --otp <code>

# 3. Revoke the token immediately (or from the website's token list):
npm token revoke <id>
```

**Path B — direct publish with the granular token.** Use
`SDK_RELEASE_CONFIRM=publish npm publish --access public` instead of the stage
commands. Note that **direct publishing with a granular access token is being
deprecated**: npm has announced it will be removed in **January 2027**, so
prefer Path A.

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
3. **Publish subsequent versions via the workflow** (§4 step 4) — the publish
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
`tests/release-gates.test.mjs` — fail if any of the following is weakened:

- `id-token: write` present on the publish job;
- `registry-url: https://registry.npmjs.org` on the publish job;
- the publish job runs on a GitHub-hosted runner (`ubuntu-latest`);
- the publish job pins Node 24 (npm ≥ 11.5.1 / Node ≥ 22.14);
- **no** `NODE_AUTH_TOKEN` / `secrets.NPM_TOKEN` appears anywhere in the
  workflow;
- `repository.url` matches the canonical GitHub repository;
- the `verify` job contains no `npm publish` step (it stays non-publishing);
- `SDK_RELEASE_ENABLED` is never hardcoded in the workflow (it stays a
  repository variable);
- the workflow does **not** claim the in-repo gates make direct publishing
  impossible, and frames `SDK_RELEASE_CONFIRM` as an accidental-publish guard
  (an explicit standing contract in `scripts/check.mjs`);
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
| Static checks + all tests | `npm run check` (root) | ✅ **275** static `PASS`, **159/159** tests pass, 0 fail |
| Validator OIDC gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ 12/12 release-workflow gates pass |
| Security-wording contracts | `node --test tests/release-security-wording.test.mjs` | ✅ 7/7 pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 29/29 pass |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Pack contents | `npm pack --dry-run` | ✅ 19 files, 33.5 kB packed / 132.4 kB unpacked |
| Consumer build | `npm ci && npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Registry identity unchanged | `npm view @youge/assistant-sdk version` | ✅ HTTP 404 — still unpublished; **not published by this task** |

## 8. Required follow-ups (before the first publish)

Owner actions remaining (nothing in this repository can complete them):

1. **npmjs.com:** confirm the publishing npm user (`you-ge`) has publish
   rights on the org `youge` (registry APIs do not expose org membership).
2. **Verify the `sdk-npm-publish` environment** the owner created actually
   enforces its required-reviewer protection (the environment exists; this
   automation cannot read its protection rules — HTTP 403 — so the owner
   confirms it before the first publish run). Do **not** recreate it.
3. **Bootstrap the first publish** of `@youge/assistant-sdk` (the package does
   not exist yet, so OIDC cannot be used for it). This requires creating a
   minimum-permission **granular access token** on npmjs.com, using it only for
   that one publish and **revoking it immediately** — see
   [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)
   for both the recommended staged path and the direct-publish alternative.
   **Owner approval is required before any credential is created**; this
   repository does not create, store or request one.
4. **Register the npm Trusted Publisher** for the workflow (§6.3) and, once it
   works, **restrict token access** (Settings → Publishing access → "Require
   two-factor authentication and disallow tokens").
5. **Approve publication** by setting the repository variable
   `SDK_RELEASE_ENABLED = true` (the explicit "publishing approved" switch). It
   must stay unset until then.
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
