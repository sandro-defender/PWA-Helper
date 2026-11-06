/**
 * Regression tests for the @youge/assistant-sdk release-gate protections.
 *
 * Added by the independent pre-merge audit of PR #11 (0.1.0 release). These
 * tests prove, by real mutation against sandbox copies, that:
 *
 *   1. the release workflow keeps every publishing gate (manual-only trigger,
 *      confirm input, approval variable, protected environment, OIDC
 *      trusted-publishing configuration, publish-authorization env, provenance)
 *      and carries no long-lived NPM_TOKEN / NODE_AUTH_TOKEN secret;
 *   1b. the `verify` job never publishes and the approval variable is never
 *      hardcoded in the workflow;
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
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  assert.match(res.stdout, /release workflow gate missing: OIDC: no long-lived NPM_TOKEN/);
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
  // OIDC authentication: id-token: write, npm public registry, Node 24 toolchain.
  assert.match(pristineWorkflow, /id-token:\s*write/);
  assert.match(pristineWorkflow, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
  assert.match(pristineWorkflow, /node-version:\s*24/);
  // No long-lived token anywhere on the publish path.
  assert.doesNotMatch(pristineWorkflow, /NODE_AUTH_TOKEN/);
  assert.doesNotMatch(pristineWorkflow, /secrets\.NPM_TOKEN/);
  // Explicit authorization + provenance.
  assert.match(pristineWorkflow, /SDK_RELEASE_CONFIRM: publish/);
  assert.match(pristineWorkflow, /npm publish --access public --provenance/);
  // Token values are never echoed or interpolated into shell output.
  assert.doesNotMatch(pristineWorkflow, /echo.*NPM_TOKEN/);
});

test('release-gate sandbox teardown', () => {
  rmSync(sandboxRoot, { recursive: true, force: true });
});
