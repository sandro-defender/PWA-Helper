/**
 * Unit tests for scripts/oidc-trust-check.mjs — the NON-MUTATING npm Trusted
 * Publishing (OIDC) verification used by sdk-release-prep.yml action=
 * oidc-check.
 *
 * Contracts locked in here (see RELEASE.md §6.6 for the findings behind them):
 *
 *   1. The GitHub id_token request always asks for the official npm audience
 *      `npm:registry.npmjs.org` (docs.npmjs.com/trusted-publishers).
 *   2. The only registry call is the DOCUMENTED npm Registry API operation
 *      POST /-/npm/v1/oidc/token/exchange/package/{name} — no invented
 *      endpoint, no package-document write, no dist-tag operation.
 *   3. Success is defined solely as exchange HTTP 201 (npm accepted this
 *      repository/workflow/environment as a Trusted Publisher for this
 *      package). 400/401/404 and any other status fail the check.
 *   4. Missing Actions OIDC environment (no `id-token: write`) fails closed
 *      before any network call — an unavailable OIDC token is never mistaken
 *      for a passing verification.
 *   5. Neither the id_token, the exchanged npm token, nor the GitHub request
 *      token can ever appear in the program's output.
 *
 * All HTTP is faked; no network access, no npm registry interaction, no
 * credentials exist in this test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCHANGE_URL_BASE,
  OIDC_AUDIENCE,
  escapedPackageName,
  idTokenRequestUrl,
  main,
  redact,
  runOidcTrustCheck,
} from '../scripts/oidc-trust-check.mjs';

const PKG = '@youge/assistant-sdk';
const ID_TOKEN = 'ID-TOKEN-SECRET-VALUE';
const REQUEST_TOKEN = 'gha-request-secret-value';
const EXCHANGED = 'npm-EXCHANGED-SECRET';
const GH_URL = 'https://token.actions.githubusercontent.com/?api-version=2018-06-01';

const baseEnv = (overrides = {}) => ({
  ACTIONS_ID_TOKEN_REQUEST_URL: GH_URL,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: REQUEST_TOKEN,
  ...overrides,
});

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    const href = String(url);
    calls.push({ url: href, opts });
    const route = routes.find((r) =>
      typeof r.match === 'string' ? href.startsWith(r.match) : r.match.test(href),
    );
    if (!route) throw new Error(`unexpected fetch in test: ${href}`);
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: async () => JSON.parse(route.body),
      text: async () => route.body,
    };
  };
  fn.calls = calls;
  return fn;
}

const ghRoute = { match: 'https://token.actions.githubusercontent.com/', status: 200, body: JSON.stringify({ value: ID_TOKEN }) };
const okRoute = {
  match: EXCHANGE_URL_BASE,
  status: 201,
  body: JSON.stringify({
    token_type: 'oidc',
    token: EXCHANGED,
    created: 1794000000,
    expires: '2026-11-07T08:07:00.000Z',
  }),
};

test('package names are escaped exactly like the npm CLI (scope literal, slash once)', () => {
  assert.equal(escapedPackageName(PKG), '@youge%2Fassistant-sdk');
  assert.equal(escapedPackageName('left-pad'), 'left-pad');
  assert.equal(EXCHANGE_URL_BASE + escapedPackageName(PKG), `${EXCHANGE_URL_BASE}@youge%2Fassistant-sdk`);
});

test('the GitHub id_token request always carries the official npm audience', () => {
  const url = idTokenRequestUrl(baseEnv());
  assert.ok(url, 'request URL must be built from ACTIONS_ID_TOKEN_REQUEST_URL');
  assert.equal(url.searchParams.get('audience'), OIDC_AUDIENCE);
  assert.equal(OIDC_AUDIENCE, 'npm:registry.npmjs.org');
  assert.equal(idTokenRequestUrl({}), null, 'missing env fails closed');
});

test('201 exchange = Trusted Publisher match; requests are exactly GitHub GET + npm exchange POST', async () => {
  const fetchImpl = fakeFetch([ghRoute, okRoute]);
  const result = await runOidcTrustCheck({ env: baseEnv(), fetchImpl, packageName: PKG });
  assert.equal(result.ok, true);
  assert.equal(result.stage, 'ok');
  assert.equal(result.httpStatus, 201);
  assert.equal(result.expires, '2026-11-07T08:07:00.000Z');
  assert.match(result.detail, /accepted the OIDC identity/);

  const [gh, exchange] = fetchImpl.calls;
  assert.equal(gh.opts.method, 'GET');
  assert.equal(new URL(gh.url).searchParams.get('audience'), OIDC_AUDIENCE);
  assert.equal(gh.opts.headers.Authorization, `Bearer ${REQUEST_TOKEN}`);

  assert.equal(exchange.opts.method, 'POST');
  assert.equal(exchange.url, `${EXCHANGE_URL_BASE}@youge%2Fassistant-sdk`);
  // The Bearer credential for the exchange is the OIDC id_token itself.
  assert.equal(exchange.opts.headers.Authorization, `Bearer ${ID_TOKEN}`);

  // Nothing secret may leak into any serializable result field.
  const serialized = JSON.stringify(result);
  for (const secret of [ID_TOKEN, REQUEST_TOKEN, EXCHANGED]) {
    assert.ok(!serialized.includes(secret), `result must not contain ${secret}`);
  }
});

test('fails closed when the job has no id-token: write (no Actions OIDC env)', async () => {
  const fetchImpl = fakeFetch([]);
  const result = await runOidcTrustCheck({ env: {}, fetchImpl, packageName: PKG });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'no-id-token-permission');
  assert.equal(fetchImpl.calls.length, 0, 'no network call may happen without OIDC');
  assert.match(result.detail, /id-token: write/);
});

test('a missing id_token value in the GitHub response fails closed', async () => {
  const fetchImpl = fakeFetch([
    { match: 'https://token.actions.githubusercontent.com/', status: 200, body: JSON.stringify({}) },
  ]);
  const result = await runOidcTrustCheck({ env: baseEnv(), fetchImpl, packageName: PKG });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'id-token-request-failed');
});

test('401 exchange is a failure (npm did not accept the identity)', async () => {
  const fetchImpl = fakeFetch([
    ghRoute,
    { match: EXCHANGE_URL_BASE, status: 401, body: JSON.stringify({ error: 'Unauthorized', message: 'OIDC token exchange failed' }) },
  ]);
  const result = await runOidcTrustCheck({ env: baseEnv(), fetchImpl, packageName: PKG });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'exchange-failed');
  assert.equal(result.httpStatus, 401);
  assert.match(result.detail, /HTTP 401/);
  assert.match(result.detail, /OIDC token exchange failed/);
  assert.ok(!JSON.stringify(result).includes(ID_TOKEN));
});

test('404 exchange (no matching Trusted Publisher configuration) is a failure', async () => {
  const fetchImpl = fakeFetch([
    ghRoute,
    {
      match: EXCHANGE_URL_BASE,
      status: 404,
      body: JSON.stringify({ error: 'Not Found', message: 'OIDC token exchange error - package not found' }),
    },
  ]);
  const result = await runOidcTrustCheck({ env: baseEnv(), fetchImpl, packageName: PKG });
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 404);
  assert.match(result.detail, /package not found/);
});

test('a 201 without a token body is treated as failure (never a blind pass)', async () => {
  const fetchImpl = fakeFetch([
    ghRoute,
    { match: EXCHANGE_URL_BASE, status: 201, body: JSON.stringify({ token_type: 'oidc' }) },
  ]);
  const result = await runOidcTrustCheck({ env: baseEnv(), fetchImpl, packageName: PKG });
  assert.equal(result.ok, false);
  assert.match(result.detail, /without a token/);
});

test('redact() scrubs bearer tokens, JWTs and token fields from anything printed', () => {
  const leaked = redact('Authorization: Bearer abc.def-gh and {"token":"leak123"} plus eyJhbGciOiJIUzI1NiJ9.abc');
  assert.ok(!leaked.includes('abc.def-gh'));
  assert.ok(!leaked.includes('leak123'));
  assert.ok(!leaked.includes('eyJhbGciOiJIUzI1NiJ9.abc'));
});

test('main() exits 0 on 201 and never prints any credential', async () => {
  const lines = [];
  const errors = [];
  const fetchImpl = fakeFetch([ghRoute, okRoute]);
  const code = await main({
    env: baseEnv(),
    fetchImpl,
    log: (line) => lines.push(String(line)),
    errorLog: (line) => errors.push(String(line)),
  });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /PASS/);
  assert.match(lines.join('\n'), /no publish, stage, approval or dist-tag operation is performed/);
  assert.match(lines.join('\n'), /Publishing permission \(layer 4\) is NOT claimed/);
  const all = lines.concat(errors).join('\n');
  for (const secret of [ID_TOKEN, REQUEST_TOKEN, EXCHANGED]) {
    assert.ok(!all.includes(secret), `output must not contain ${secret}`);
  }
});

test('main() exits 1 on a refused exchange and reports FAIL with the status only', async () => {
  const lines = [];
  const errors = [];
  const fetchImpl = fakeFetch([
    ghRoute,
    { match: EXCHANGE_URL_BASE, status: 404, body: JSON.stringify({ message: 'OIDC token exchange error - package not found' }) },
  ]);
  const code = await main({
    env: baseEnv(),
    fetchImpl,
    log: (line) => lines.push(String(line)),
    errorLog: (line) => errors.push(String(line)),
  });
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /FAIL \[exchange-failed\]/);
  assert.match(errors.join('\n'), /HTTP 404/);
  const all = lines.concat(errors).join('\n');
  for (const secret of [ID_TOKEN, REQUEST_TOKEN, EXCHANGED]) {
    assert.ok(!all.includes(secret), `output must not contain ${secret}`);
  }
});

test('main() exits 1 (fail-closed) when the Actions OIDC environment is absent', async () => {
  const errors = [];
  const fetchImpl = fakeFetch([]);
  const code = await main({
    env: {},
    fetchImpl,
    log: () => {},
    errorLog: (line) => errors.push(String(line)),
  });
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /no-id-token-permission/);
  assert.equal(fetchImpl.calls.length, 0);
});
