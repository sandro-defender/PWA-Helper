/**
 * Regression tests for the security wording and npm-authentication contracts
 * in packages/assistant-sdk/RELEASE.md and the release workflow header.
 *
 * These lock in the corrections from the npm-authentication documentation
 * audit (PR #12):
 *
 *   1. `npm login` is NOT a tokenless path — it generates a legacy publish
 *      token and saves credentials to `.npmrc`.
 *   2. `SDK_RELEASE_CONFIRM` / `confirm_publish` / `SDK_RELEASE_ENABLED` are
 *      accidental-publish guards, never described as making direct publishing
 *      impossible.
 *   3. The first publish of a new package uses a minimum-permission granular
 *      access token (stage-only preferred), revoked immediately — never a
 *      credential committed, logged or stored in a secret.
 *   4. The trusted-publisher limit follows the npm website (up to 10
 *      connections per package), not the stale CLI reference (one per package).
 *   5. A manual first publish carries no OIDC provenance.
 *
 * These are documentation contracts: they assert that the runbook and the
 * workflow header keep the accurate security wording. They are deliberately
 * narrow (the exact misleading phrases that were removed, and the accurate
 * phrases that must remain) rather than asserting arbitrary prose.
 *
 * Restrictions honored: read-only — no npm publish, no tokens, no registry
 * access.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const workflow = readFileSync(
  join(repoRoot, '.github', 'workflows', 'sdk-release-prep.yml'),
  'utf8',
);
const runbook = readFileSync(join(repoRoot, 'packages', 'assistant-sdk', 'RELEASE.md'), 'utf8');

// Whitespace is collapsed so a phrase spanning a wrapped line still matches.
const flat = (text) => text.replace(/\s+/g, ' ');
const workflowFlat = flat(workflow);
const runbookFlat = flat(runbook);

test('workflow header must not claim the in-repo gates make direct publishing impossible', () => {
  for (const phrase of [
    'can never release',
    'cannot publish directly',
    'impossible to publish',
    'makes publishing impossible',
  ]) {
    assert.ok(
      !workflowFlat.includes(phrase),
      `workflow header must not contain the misleading phrase "${phrase}"`,
    );
  }
});

test('workflow header must frame SDK_RELEASE_CONFIRM as an accidental-publish guard only', () => {
  assert.match(workflow, /accidental-publish guard/i);
  // The phrase wraps across YAML comment lines, so allow the `#` prefix.
  assert.match(workflow, /does NOT make direct publishing[#\s]+impossible/i);
});

test('runbook must not claim the first-publish bootstrap is tokenless', () => {
  for (const phrase of ['no long-lived token at all', 'no token is created or stored']) {
    assert.ok(!runbookFlat.includes(phrase), `runbook must not contain "${phrase}"`);
  }
});

test('runbook must document that npm login persists credentials to .npmrc', () => {
  assert.match(runbook, /\.npmrc/);
  assert.match(runbook, /legacy token of `publish` type|legacy publish token/i);
  assert.match(runbook, /npm logout/);
});

test('runbook must document minimum-permission granular tokens and immediate revocation', () => {
  assert.match(runbook, /granular access token/i);
  assert.match(runbook, /Bypass two-factor authentication/i);
  assert.match(runbook, /stage only/i);
  assert.match(runbook, /npm token revoke/);
});

test('runbook must document the current trusted-publisher limits', () => {
  assert.ok(
    !/only one trusted-publisher configuration per package/i.test(runbook),
    'runbook must not claim one trusted publisher per package',
  );
  assert.match(runbook, /up to 10\s+trusted publisher/i);
});

test('runbook must state the manual first publish carries no OIDC provenance', () => {
  assert.match(runbook, /no OIDC\s+provenance/i);
});

test('runbook must document scoping the token to the @youge scope before the package exists', () => {
  assert.match(runbook, /Can the token be scoped before the package exists/i);
  assert.match(runbook, /`@youge`\s*scope/);
  // The Organizations section must not be used to obtain publish rights.
  assert.match(runbook, /Organizations\*\s+section of the form/);
  assert.match(runbook, /does not give the token\s+the right to publish/i);
});

test('runbook must document that npm stage publish runs prepublishOnly', () => {
  assert.match(runbook, /StagePublish extends Publish/);
  assert.match(runbook, /`npm stage publish` run the package's `prepublishOnly`/i);
});

test('runbook must document the npm stage approve syntax and --otp behaviour', () => {
  assert.match(runbook, /`npm stage approve <stage-id>` takes/);
  assert.match(runbook, /--otp <code>/);
  assert.match(runbook, /prompts\s+interactively/i);
});

test('runbook must document the 0.0.0-stage placeholder and 2FA approval', () => {
  assert.match(runbook, /0\.0\.0-stage/);
  assert.match(runbook, /always prompts\s+for 2FA/i);
  assert.match(runbook, /Staged versions share the same semver unique index/i);
});

test('runbook must state that Bypass 2FA is not needed for staging', () => {
  assert.match(runbook, /No `Bypass 2FA` is needed/i);
});

test('runbook must state that GitHub Actions secrets are deliberately not used', () => {
  assert.match(runbook, /GitHub Actions secrets are deliberately/i);
});
