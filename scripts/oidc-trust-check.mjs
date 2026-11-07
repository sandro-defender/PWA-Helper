#!/usr/bin/env node
/*!
 * Non-mutating npm Trusted Publishing (OIDC) verification.
 * ------------------------------------------------------------------------
 * Exchanges this workflow's GitHub Actions OIDC id_token for a short-lived,
 * package-scoped npm token using the OFFICIAL, DOCUMENTED npm Registry API
 * operation `exchangeOidcToken`:
 *
 *   POST https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/{name}
 *   Authorization: Bearer <GitHub OIDC id_token, aud=npm:registry.npmjs.org>
 *
 *   - API reference: https://api-docs.npmjs.com/#tag/registry.npmjs.org/
 *       operation/exchangeOidcToken (the "Learn more" link of
 *       https://docs.npmjs.com/trusted-publishers)
 *   - The npm CLI performs the identical request in lib/utils/oidc.js before
 *     `npm publish`, `npm stage publish` and dist-tag operations.
 *
 * What a 201 proves: npm matched a Trusted Publisher configuration for THIS
 * package to THIS workflow identity (repository `sandro-defender/
 * you-ge-assistant`, workflow `sdk-release-prep.yml`, environment
 * `sdk-npm-publish` — the job runs under that environment so the OIDC
 * subject carries it). npm rejects exchanges with 400/401/404 when no
 * matching configuration exists (the registry's misleading 404 wording is
 * tracked in npm/cli#9088).
 *
 * What it does NOT do: no `npm publish`, no `npm stage`, no approval, no
 * `npm dist-tag`, no other registry-mutating request — the only HTTP methods
 * used here are GET (GitHub id_token request) and POST (the documented
 * exchange, which only mints an in-memory short-lived credential). No GitHub
 * Secrets, no npm token, no `.npmrc`, nothing persisted. The exchanged token
 * and the id_token are NEVER printed or stored; output is reduced to status
 * codes, timestamps and npm's error message field.
 *
 * Four distinct layers — do not conflate them (RELEASE.md §6.6):
 *   1. ordinary npm authentication (tokens / npm login) — not used here;
 *   2. GitHub OIDC token availability (id-token: write) — necessary, not
 *      sufficient, and never proof that npm accepts anything;
 *   3. successful npm Trusted Publisher authentication — what this check
 *      verifies (exchange 201 for this package + identity);
 *   4. actual publishing permission — only a real, registry-accepted
 *      `npm stage publish` / `npm publish` proves it; this check never runs
 *      either (the 2026-11-07 stage run is the recorded evidence for the
 *      `npm stage publish` action).
 *
 * Run: node scripts/oidc-trust-check.mjs   (or via sdk-release-prep.yml
 * dispatch with action=oidc-check). Exit 0 only on exchange 201.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const OIDC_AUDIENCE = 'npm:registry.npmjs.org';
export const EXCHANGE_URL_BASE =
  'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/';

/** npm's escapedName convention (scope kept literal, "/" escaped once). */
export function escapedPackageName(name) {
  return name.startsWith('@') ? name.replace('/', '%2F') : name;
}

/** Remove any accidental credential material from anything we print. */
export function redact(text) {
  return String(text)
    .replace(/("token"\s*:\s*")[^"]*(")/g, '$1[redacted]$2')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/g, '$1[redacted]')
    .replace(/\beyJ[A-Za-z0-9._-]+/g, '[redacted-jwt]');
}

/** Build the GitHub Actions id_token request URL (audience appended). */
export function idTokenRequestUrl(env) {
  const base = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.append('audience', OIDC_AUDIENCE);
  return url;
}

/**
 * Core check. Injectable `fetchImpl` and `env` keep it unit-testable; the
 * default path is only used when run as a script.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   stage: 'ok'|'no-id-token-permission'|'id-token-request-failed'|'exchange-failed'|'unexpected',
 *   httpStatus?: number,
 *   expires?: string,
 *   detail?: string,
 * }>}
 */
export async function runOidcTrustCheck({
  env = process.env,
  fetchImpl,
  packageName,
} = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) {
    return { ok: false, stage: 'unexpected', detail: 'fetch is unavailable in this runtime' };
  }

  const requestUrl = idTokenRequestUrl(env);
  const requestToken = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    return {
      ok: false,
      stage: 'no-id-token-permission',
      detail:
        'ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN are absent — the job is missing `permissions: id-token: write`.',
    };
  }

  let idToken;
  try {
    const res = await doFetch(requestUrl.href, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${requestToken}`,
      },
    });
    if (!res.ok) {
      return {
        ok: false,
        stage: 'id-token-request-failed',
        httpStatus: res.status,
        detail: `GitHub id_token request returned HTTP ${res.status}.`,
      };
    }
    const body = await res.json();
    idToken = body && body.value;
  } catch (error) {
    return {
      ok: false,
      stage: 'id-token-request-failed',
      detail: `GitHub id_token request failed: ${redact(error && error.message)}`,
    };
  }
  if (!idToken || typeof idToken !== 'string') {
    return {
      ok: false,
      stage: 'id-token-request-failed',
      detail: 'GitHub id_token response contained no value.',
    };
  }

  if (!packageName || typeof packageName !== 'string') {
    return { ok: false, stage: 'unexpected', detail: 'No package name configured.' };
  }
  const exchangeUrl = `${EXCHANGE_URL_BASE}${escapedPackageName(packageName)}`;

  let status;
  let payloadText;
  try {
    const res = await doFetch(exchangeUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    status = res.status;
    payloadText = await res.text();
  } catch (error) {
    return {
      ok: false,
      stage: 'exchange-failed',
      detail: `Token exchange request failed: ${redact(error && error.message)}`,
    };
  }

  if (status === 201) {
    let parsed = null;
    try {
      parsed = JSON.parse(payloadText);
    } catch (error) {
      return {
        ok: false,
        stage: 'exchange-failed',
        httpStatus: status,
        detail: 'Exchange returned 201 with an unparsable body — treating as failure.',
      };
    }
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) {
      return {
        ok: false,
        stage: 'exchange-failed',
        httpStatus: status,
        detail: 'Exchange returned 201 without a token — treating as failure.',
      };
    }
    // Success: report ONLY the status and expiry. The token itself stays in
    // memory and is dropped when this process exits.
    return {
      ok: true,
      stage: 'ok',
      httpStatus: status,
      expires: typeof parsed.expires === 'string' ? parsed.expires : undefined,
      detail: `npm accepted the OIDC identity for ${packageName} (exchange HTTP 201).`,
    };
  }

  // Failure path: surface npm's own message (no token exists in error bodies;
  // redact() is applied regardless as a belt-and-braces guard).
  let message = '';
  try {
    const parsed = JSON.parse(payloadText);
    message = parsed.message || parsed.error || '';
  } catch (error) {
    message = String(payloadText || '').slice(0, 300);
  }
  return {
    ok: false,
    stage: 'exchange-failed',
    httpStatus: status,
    detail:
      `Token exchange refused (HTTP ${status})` +
      (message ? `: ${redact(message)}` : '') +
      ' — no Trusted Publisher configuration matches this package + workflow identity, ' +
      'or the id_token is invalid.',
  };
}

/** Read the package identity from the release target itself. */
export function readReleaseTarget() {
  const pkgPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'packages',
    'assistant-sdk',
    'package.json'
  );
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return { name: pkg.name, version: pkg.version };
}

export async function main({
  env = process.env,
  fetchImpl,
  log = console.log,
  errorLog = console.error,
} = {}) {
  const target = readReleaseTarget();
  log(`npm Trusted Publishing (OIDC) check — ${target.name} (version ${target.version} NOT consulted for mutations; no publish, stage, approval or dist-tag operation is performed).`);
  const result = await runOidcTrustCheck({
    env,
    fetchImpl,
    packageName: target.name,
  });
  if (result.ok) {
    log(`PASS: ${result.detail}`);
    if (result.expires) log(`Exchanged token not shown; it expires at ${result.expires}.`);
    log('Layer 3 verified (Trusted Publisher authentication). Publishing permission (layer 4) is NOT claimed by this check.');
    return 0;
  }
  errorLog(`FAIL [${result.stage}]: ${result.detail || 'no detail'}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
