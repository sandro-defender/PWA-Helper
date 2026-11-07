/**
 * Regression tests for the @youge/assistant-sdk release-gate protections.
 *
 * Added by the independent pre-merge audit of PR #11 (0.1.0 release). These
 * tests prove, by real mutation against sandbox copies, that:
 *
 *   1. the release workflow keeps every publishing gate (manual-only trigger,
 *      confirm inputs, approval variable, protected environment, OIDC
 *      trusted-publishing configuration, publish-authorization env, provenance)
 *      and contains NO npm token reference anywhere — verify, stage and
 *      publish all authenticate without a stored npm credential (stage and
 *      publish via npm Trusted Publishing / OIDC);
 *   1b. the `verify` job never publishes, the approval variable is never
 *      hardcoded in the workflow, and the `stage` job is manual-only with its
 *      own explicit confirmation, depends on `verify`, runs inside the
 *      protected environment with exactly `contents: read` +
 *      `id-token: write`, invokes `npm stage publish` (never `npm publish`,
 *      never `npm stage approve`/`reject`), and reports staged-NOT-published
 *      with the 0.0.0-stage placeholder;
 *   2. packages/assistant-sdk/scripts/validate-package.mjs FAILS when any gate
 *      is removed or weakened;
 *   3. a stray `npm publish` (prepublishOnly without the workflow's
 *      SDK_RELEASE_CONFIRM authorization) is refused, while the gated
 *      workflow's authorization passes;
 *   4. the standing contracts in scripts/check.mjs reject a weakened workflow.
 *
 * Restrictions honored: no npm publish, no dispatch, no secrets, no registry
 * access — everything runs in a temp directory against copies.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowRel = '.github/workflows/sdk-release-prep.yml';
const pkgRel = 'packages/assistant-sdk/package.json';

const skip = (name) =>
  name === '.git' || name === 'node_modules' || name === 'dist' || name === '__pycache__';

/** Minimal tree the SDK package validator reads (it resolves repo root as ../..). */
function buildValidatorSandbox(root) {
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(root, 'packages'), { recursive: true });
  cpSync(join(repoRoot, 'packages', 'assistant-sdk'), join(root, 'packages', 'assistant-sdk'), {
    recursive: true,
    filter: (src) => !skip(basename(src)),
  });
  writeFileSync(join(root, 'package.json'), readFileSync(join(repoRoot, 'package.json')));
  writeFileSync(join(root, workflowRel), readFileSync(join(repoRoot, workflowRel)));
}

/** Full tree copy so scripts/check.mjs (root-level static contracts) can run. */
function buildFullSandbox(root) {
  cpSync(repoRoot, root, { recursive: true, filter: (src) => !skip(basename(src)) });
}

function runNode(args, cwd, env = {}) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function runValidator(cwd, env = {}) {
  return runNode(['packages/assistant-sdk/scripts/validate-package.mjs'], cwd, env);
}

const sandboxRoot = join(tmpdir(), `youge-release-gates-${process.pid}`);
const validatorSandbox = join(sandboxRoot, 'validator');
const fullSandbox = join(sandboxRoot, 'full');
const pristineWorkflow = readFileSync(join(repoRoot, workflowRel), 'utf8');
const pristinePkg = readFileSync(join(repoRoot, pkgRel), 'utf8');

function resetSandboxFiles() {
  writeFileSync(join(validatorSandbox, workflowRel), pristineWorkflow);
  writeFileSync(join(validatorSandbox, pkgRel), pristinePkg);
}

test('release-gate sandbox: pristine copy passes SDK package validation', () => {
  rmSync(sandboxRoot, { recursive: true, force: true });
  buildValidatorSandbox(validatorSandbox);
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /SDK package validation passed/);
});

const GATES = [
  'SDK_RELEASE_ENABLED',
  'confirm_publish',
  'environment: sdk-npm-publish',
  'id-token: write',
  'registry-url: https://registry.npmjs.org',
  'node-version: 24',
  'SDK_RELEASE_CONFIRM: publish',
];

for (const gate of GATES) {
  test(`validator refuses a workflow with gate removed: ${gate}`, () => {
    resetSandboxFiles();
    const workflowPath = join(validatorSandbox, workflowRel);
    writeFileSync(workflowPath, pristineWorkflow.replaceAll(gate, 'REMOVED'));
    const res = runValidator(validatorSandbox);
    assert.equal(res.status, 1, 'validation must fail when a publishing gate is removed');
    assert.match(res.stdout, /release workflow gate missing/);
  });
}

test('validator refuses a workflow with a push trigger added', () => {
  resetSandboxFiles();
  const workflowPath = join(validatorSandbox, workflowRel);
  writeFileSync(workflowPath, pristineWorkflow.replace('  workflow_dispatch:', '  push:\n  workflow_dispatch:'));
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: workflow_dispatch-only trigger/);
});

test('validator refuses a workflow that reintroduces a long-lived npm token', () => {
  resetSandboxFiles();
  const workflowPath = join(validatorSandbox, workflowRel);
  writeFileSync(
    workflowPath,
    pristineWorkflow.replace(
      '          SDK_RELEASE_CONFIRM: publish',
      '          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n          SDK_RELEASE_CONFIRM: publish',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when a long-lived npm token is reintroduced');
  assert.match(res.stdout, /release workflow gate missing: no npm token references anywhere/);
});

test('validator refuses a workflow whose verify job publishes', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '        run: npm run check\n',
      '        run: npm run check && npm publish\n',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when the verify job publishes');
  assert.match(res.stdout, /release workflow gate missing: verify job never publishes/);
});

test('validator refuses a workflow that hardcodes the approval variable', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '    environment: sdk-npm-publish\n',
      "    environment: sdk-npm-publish\n    env:\n      SDK_RELEASE_ENABLED: 'true'\n",
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when SDK_RELEASE_ENABLED is hardcoded');
  assert.match(res.stdout, /release workflow gate missing: approval variable stays a repository variable/);
});

test('validator refuses a package without prepublishOnly', () => {
  resetSandboxFiles();
  const pkgPath = join(validatorSandbox, pkgRel);
  const pkg = JSON.parse(pristinePkg);
  delete pkg.scripts.prepublishOnly;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /prepublishOnly script is missing/);
});

test('prepublishOnly refuses a publish attempt without SDK_RELEASE_CONFIRM', () => {
  resetSandboxFiles();
  const res = runValidator(validatorSandbox, {
    npm_lifecycle_event: 'prepublishOnly',
    SDK_RELEASE_CONFIRM: '',
  });
  assert.equal(res.status, 1, 'a stray npm publish must abort at prepublishOnly');
  assert.match(res.stdout, /without SDK_RELEASE_CONFIRM authorization/);
  assert.match(res.stdout, /direct npm publish is refused/);
});

test('prepublishOnly accepts the authorization set only by the gated publish job', () => {
  resetSandboxFiles();
  const res = runValidator(validatorSandbox, {
    npm_lifecycle_event: 'prepublishOnly',
    SDK_RELEASE_CONFIRM: 'publish',
  });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /SDK_RELEASE_CONFIRM authorization set by the gated release workflow/);
});

test('the real repository passes SDK package validation', () => {
  const res = runValidator(repoRoot);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test('check.mjs standing contracts reject a weakened workflow', () => {
  rmSync(fullSandbox, { recursive: true, force: true });
  buildFullSandbox(fullSandbox);

  // Positive control: the pristine copy passes the static contracts.
  const clean = runNode(['scripts/check.mjs'], fullSandbox);
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);

  // Weaken the workflow: re-point the protected environment.
  writeFileSync(
    join(fullSandbox, workflowRel),
    pristineWorkflow.replace('environment: sdk-npm-publish', 'environment: something-else'),
  );
  const weakened = runNode(['scripts/check.mjs'], fullSandbox);
  assert.equal(weakened.status, 1, 'check.mjs must fail when the protected environment is weakened');
  assert.match(weakened.stdout, /sdk-release-prep publishing gate present: environment: sdk-npm-publish/);
});

test('check.mjs standing contracts reject a verify job that publishes', () => {
  rmSync(fullSandbox, { recursive: true, force: true });
  buildFullSandbox(fullSandbox);
  writeFileSync(
    join(fullSandbox, workflowRel),
    pristineWorkflow.replace(
      '        run: npm run check\n',
      '        run: npm run check && npm publish\n',
    ),
  );
  const res = runNode(['scripts/check.mjs'], fullSandbox);
  assert.equal(res.status, 1, 'check.mjs must fail when the verify job publishes');
  assert.match(res.stdout, /sdk-release-prep verify job never publishes/);
});

test('workflow wires OIDC trusted publishing, explicit authorization and provenance', () => {
  const stageRaw = jobBlock(pristineWorkflow, 'stage');
  const publishRaw = jobBlock(pristineWorkflow, 'publish');
  const stripComments = (text) =>
    text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
  // OIDC authentication on BOTH jobs: id-token: write, npm public registry,
  // Node 24 toolchain.
  assert.match(publishRaw, /id-token:\s*write/);
  assert.match(publishRaw, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
  assert.match(publishRaw, /node-version:\s*24/);
  assert.match(stageRaw, /id-token:\s*write/);
  assert.match(stageRaw, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
  // NO npm token reference anywhere: verify, stage and publish all
  // authenticate without a stored npm credential (OIDC).
  assert.doesNotMatch(stripComments(pristineWorkflow), /NODE_AUTH_TOKEN|secrets\.NPM_/);
  assert.doesNotMatch(pristineWorkflow, /secrets\.NPM_TOKEN/);
  // Explicit authorization + provenance.
  assert.match(pristineWorkflow, /SDK_RELEASE_CONFIRM: publish/);
  assert.match(pristineWorkflow, /npm publish --access public --provenance/);
  // Token values are never echoed or interpolated into shell output.
  assert.doesNotMatch(pristineWorkflow, /echo.*NPM_TOKEN/);
});

/* ---- First-publication stage job (npm stage publish bootstrap) ---------- */

function jobBlock(text, job) {
  const start = text.indexOf(`\n  ${job}:`);
  if (start === -1) return '';
  const rest = text.slice(start);
  const nextJob = rest.slice(1).search(/\n  \S/);
  return nextJob === -1 ? rest : rest.slice(0, nextJob + 1);
}

const pristineStageBlock = jobBlock(pristineWorkflow, 'stage');
const stripStageComments = (text) =>
  text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');

test('stage job is manual-only with its own explicit confirmation and main-branch guard', () => {
  assert.match(pristineStageBlock, /github\.event\.inputs\.action == 'stage'/);
  assert.match(pristineStageBlock, /github\.event\.inputs\.confirm_stage == 'stage'/);
  assert.match(pristineStageBlock, /github\.ref == 'refs\/heads\/main'/);
  // The workflow itself has no push/pull_request trigger at all, so the
  // per-run OIDC credential is never exposed to PR or untrusted-branch runs.
  assert.doesNotMatch(pristineWorkflow, /^\s+(push|pull_request):/m);
  assert.match(pristineWorkflow, /confirm_stage:/);
  assert.match(pristineWorkflow, /options: \[verify, stage, publish\]/);
});

test('stage job depends on successful verification and the protected environment', () => {
  assert.match(pristineStageBlock, /needs:\s*verify\b/);
  assert.match(pristineStageBlock, /environment: sdk-npm-publish/);
  assert.match(pristineStageBlock, /runs-on:\s*ubuntu-latest/);
  // Exact least-privilege OIDC permissions: contents: read + id-token: write
  // and nothing else (staging needs id-token: write for `npm stage publish`).
  assert.match(
    pristineStageBlock,
    /permissions:\s*\n\s+contents: read[^\n]*\n\s+id-token: write[^\n]*\n\s+steps:/,
  );
  assert.doesNotMatch(pristineStageBlock, /packages:\s*write/);
});

test('stage job carries no npm token reference anywhere (token-free OIDC staging)', () => {
  const stripComments = (text) =>
    text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
  // Neither the stage job nor the rest of the workflow references
  // NODE_AUTH_TOKEN or any npm secret — OIDC is the only auth path.
  assert.doesNotMatch(stripComments(pristineStageBlock), /NODE_AUTH_TOKEN|secrets\.NPM_/);
  assert.doesNotMatch(stripComments(pristineWorkflow), /NODE_AUTH_TOKEN|secrets\.NPM_/);
  // No persistence/exposure vectors in the stage job: no artifact upload, no
  // GITHUB_ENV export, no committed .npmrc, no echo of any token.
  assert.doesNotMatch(stripComments(pristineStageBlock), /upload-artifact|GITHUB_ENV|\.npmrc/);
  assert.doesNotMatch(stripComments(pristineStageBlock), /echo.*NPM_TOKEN|echo.*NODE_AUTH_TOKEN/);
});

test('stage job invokes npm stage publish, never npm publish, and cannot approve or reject stages', () => {
  assert.match(pristineStageBlock, /npm stage publish --access public/);
  assert.doesNotMatch(pristineStageBlock, /npm\s+publish/);
  const nonComment = pristineWorkflow
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  assert.doesNotMatch(nonComment, /npm\s+stage\s+(approve|reject)/);
  assert.doesNotMatch(nonComment, /npm\s+unpublish/);
  // Staging never enables the release approval switch either.
  assert.doesNotMatch(stripStageComments(pristineStageBlock), /SDK_RELEASE_ENABLED/);
});

test('stage job runs the validator immediately before staging and guards the npm CLI version', () => {
  const validatorIdx = pristineStageBlock.indexOf('node packages/assistant-sdk/scripts/validate-package.mjs');
  const stageIdx = pristineStageBlock.indexOf('npm stage publish --access public');
  assert.ok(validatorIdx !== -1 && stageIdx !== -1, 'both the validator and the staging command must exist');
  assert.ok(validatorIdx < stageIdx, 'the package validator must run immediately before staging');
  assert.match(pristineStageBlock, /11\.15\.0/);
  assert.match(pristineStageBlock, /SDK_RELEASE_CONFIRM: publish/);
});

test('stage job reports staged-NOT-published with the placeholder and owner approval instructions', () => {
  assert.match(pristineStageBlock, /0\.0\.0-stage/);
  assert.match(pristineStageBlock, /NOT published/);
  assert.match(pristineStageBlock, /Staged Packages/);
  assert.match(pristineStageBlock, /Approve/);
  assert.match(pristineStageBlock, /2FA/);
  // The run summary must state that OIDC authentication was used — no token.
  assert.match(pristineStageBlock, /no npm token was used or stored/);
  // It must never claim the version was published by the staging run.
  assert.doesNotMatch(pristineStageBlock, /has been published|is now published|published successfully/i);
});

test('validator refuses a workflow without the stage job', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(jobBlock(pristineWorkflow, 'stage'), '\n'),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when the stage job is removed');
  assert.match(res.stdout, /release workflow gate missing: stage job runs only on explicit action=stage/);
});

test('validator refuses a stage job whose confirmation gate is weakened', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace("confirm_stage == 'stage'", "confirm_stage == 'yes'"),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: stage job runs only on explicit action=stage/);
});

test('validator refuses a stage job that does not depend on verify', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '    needs: verify\n    # Staging job',
      '    needs: []\n    # Staging job',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: stage job depends on the full verify job/);
});

test('validator refuses a stage job outside the protected environment', () => {
  resetSandboxFiles();
  // Target the stage job's (last) environment entry specifically.
  const idx = pristineWorkflow.lastIndexOf('environment: sdk-npm-publish');
  assert.ok(idx !== -1);
  const mutated =
    pristineWorkflow.slice(0, idx) +
    'environment: somewhere-else' +
    pristineWorkflow.slice(idx + 'environment: sdk-npm-publish'.length);
  writeFileSync(join(validatorSandbox, workflowRel), mutated);
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: stage job uses the protected sdk-npm-publish environment/);
});

test('validator refuses a stage job missing OIDC permissions', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '      id-token: write          # npm Trusted Publishing (OIDC) — required for `npm stage publish`\n',
      '',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when the stage job loses id-token: write');
  assert.match(res.stdout, /release workflow gate missing: stage job OIDC permissions/);
});

test('validator refuses a stage job granted an extra permission beyond contents: read + id-token: write', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '      contents: read           # checkout only',
      '      contents: read           # checkout only\n      packages: write',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when the stage job permissions widen');
  assert.match(res.stdout, /release workflow gate missing: stage job OIDC permissions/);
});

test('validator refuses a stage job that runs npm publish instead of npm stage publish', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      'out="$(npm stage publish --access public 2>&1)"',
      'out="$(npm publish --access public 2>&1)"',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: stage job invokes npm stage publish/);
});

test('validator refuses a workflow that tries to approve or reject a stage', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '      - name: Owner review instructions',
      '      - run: npm stage approve some-stage-id\n      - name: Owner review instructions',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: workflow never approves, rejects or promotes a stage/);
});

test('validator refuses a stage job that references any npm secret', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '        env:\n          # Authentication: npm Trusted Publishing (OIDC)',
      '        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_STAGE_TOKEN }}\n          # Authentication: npm Trusted Publishing (OIDC)',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1, 'validation must fail when any npm secret reference reappears');
  assert.match(res.stdout, /release workflow gate missing: no npm token references anywhere/);
});

test('validator refuses a workflow that interpolates a secret into the staging command text', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      'out="$(npm stage publish --access public 2>&1)"',
      'out="$(echo ${{ secrets.NPM_STAGE_TOKEN }}; npm stage publish --access public 2>&1)"',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: no npm token references anywhere/);
});

test('validator refuses a workflow that leaks NODE_AUTH_TOKEN into the OIDC publish job', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace(
      '          SDK_RELEASE_CONFIRM: publish',
      '          NODE_AUTH_TOKEN: ${{ secrets.NPM_STAGE_TOKEN }}\n          SDK_RELEASE_CONFIRM: publish',
    ),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: no npm token references anywhere/);
});

test('validator refuses a stage job that runs from an untrusted branch', () => {
  resetSandboxFiles();
  writeFileSync(
    join(validatorSandbox, workflowRel),
    pristineWorkflow.replace("github.ref == 'refs/heads/main'", "github.ref == 'refs/heads/feature'"),
  );
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: stage job runs from main only/);
});

test('validator refuses a stage job that sets SDK_RELEASE_ENABLED', () => {
  resetSandboxFiles();
  const idx = pristineWorkflow.lastIndexOf('environment: sdk-npm-publish');
  const mutated =
    pristineWorkflow.slice(0, idx) +
    'environment: sdk-npm-publish\n    env:\n      SDK_RELEASE_ENABLED: \'true\'' +
    pristineWorkflow.slice(idx + 'environment: sdk-npm-publish'.length);
  writeFileSync(join(validatorSandbox, workflowRel), mutated);
  const res = runValidator(validatorSandbox);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /release workflow gate missing: approval variable stays a repository variable/);
});

test('no npm token material or extra secrets exist anywhere in the repository', () => {
  const skipDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache']);
  const secretRefs = new Set();
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (skipDirs.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry === '.npmrc') offenders.push(`${full}: committed .npmrc`);
      if (!/\.(yml|yaml|md|mjs|js|json|txt|ts|jsx|tsx)$/.test(entry)) continue;
      const text = readFileSync(full, 'utf8');
      // Token-shaped credentials (npm granular tokens start with npm_).
      for (const match of text.matchAll(/\bnpm_[A-Za-z0-9]{20,}/g)) {
        offenders.push(`${full}: token-shaped string ${match[0].slice(0, 12)}…`);
      }
      // Collect ${{ secrets.* }} references from workflow files only — code
      // and tests may legitimately mention the secret *name* in gates/docs.
      if (full.includes(`${'.github'}${'/workflows'}`)) {
        for (const match of text.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)) {
          secretRefs.add(`${entry}:${match[1]}`);
        }
      }
    }
  };
  walk(repoRoot);
  assert.deepEqual(offenders, [], `no token material may be committed: ${offenders.join(', ')}`);
  // NO workflow may reference any secret at all except the built-in
  // GITHUB_TOKEN — both the stage and the publish job authenticate via OIDC.
  for (const ref of secretRefs) {
    const [file, name] = ref.split(':');
    assert.equal(name, 'GITHUB_TOKEN', `unexpected secret reference in ${file}: ${name} — the workflows must stay token-free`);
  }
});

test('release-gate sandbox teardown', () => {
  rmSync(sandboxRoot, { recursive: true, force: true });
});
