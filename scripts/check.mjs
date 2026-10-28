#!/usr/bin/env node
/**
 * Static checks for the kit. No dependencies, no network, no build.
 *
 *   node scripts/check.mjs
 *   npm run check
 *
 * Verifies:
 *   - JavaScript syntax of every runtime script
 *   - manifest is valid JSON with the required fields
 *   - every manifest icon exists and its real PNG size matches the declaration
 *   - offline / precache assets referenced by the worker exist
 *   - service worker VERSION matches PWA.version
 *   - no leftover hosted Progressier URLs in deployable files
 *
 * Exits 1 on failure.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

function pass(message) {
  console.log(`  ${green('PASS')} ${message}`);
}
function warn(message) {
  warnings.push(message);
  console.log(`  ${yellow('WARN')} ${message}`);
}
function fail(message) {
  failures.push(message);
  console.log(`  ${red('FAIL')} ${message}`);
}
function section(title) {
  console.log(`\n${title}`);
}

const at = (relative) => join(root, relative);

/* ------------------------------------------------------------------ *
 * 1. Files that must exist
 * ------------------------------------------------------------------ */

const requiredFiles = [
  'pwa.js',
  'pwa.css',
  'progressier.js',
  'manifest.webmanifest',
  'qrcode.js',
  'offline.html',
  'offline.css',
  'offline.js',
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
];

section('Required files');
for (const file of requiredFiles) {
  if (existsSync(at(file))) pass(file);
  else fail(`${file} is missing`);
}

/* ------------------------------------------------------------------ *
 * 2. JavaScript syntax
 * ------------------------------------------------------------------ */

section('JavaScript syntax');
for (const file of ['pwa.js', 'progressier.js', 'offline.js', 'qrcode.js']) {
  if (!existsSync(at(file))) continue;
  try {
    execFileSync(process.execPath, ['--check', at(file)], { stdio: 'pipe' });
    pass(`${file} parses`);
  } catch (error) {
    const detail = String(error.stderr || error.message).split('\n').slice(0, 3).join(' ');
    fail(`${file} has a syntax error: ${detail}`);
  }
}

/* ------------------------------------------------------------------ *
 * 3. Manifest
 * ------------------------------------------------------------------ */

section('Manifest');

let manifest = null;
try {
  manifest = JSON.parse(readFileSync(at('manifest.webmanifest'), 'utf8'));
  pass('manifest.webmanifest is valid JSON');
} catch (error) {
  fail(`manifest.webmanifest does not parse: ${error.message}`);
}

function pngSize(file) {
  const buffer = readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

if (manifest) {
  const requiredKeys = ['name', 'short_name', 'start_url', 'scope', 'display', 'icons'];
  for (const key of requiredKeys) {
    if (manifest[key]) pass(`manifest.${key} is set`);
    else fail(`manifest.${key} is missing`);
  }

  if (manifest.display !== 'standalone' && manifest.display !== 'fullscreen' && manifest.display !== 'minimal-ui') {
    warn(`manifest.display is "${manifest.display}"; installability expects standalone, fullscreen or minimal-ui`);
  }

  if (typeof manifest.id !== 'string' || !manifest.id) {
    warn('manifest.id is not set; browsers will derive one from start_url');
  }

  const start = manifest.start_url || '';
  const scope = manifest.scope || '/';
  if (start.startsWith('/') && !start.startsWith(scope) && scope !== '/') {
    fail(`start_url "${start}" is outside scope "${scope}"`);
  } else if (start) {
    pass('start_url is inside scope');
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail('manifest.icons is empty');
  } else {
    for (const icon of manifest.icons) {
      const src = String(icon.src || '');
      if (!src) {
        fail('an icon entry has no src');
        continue;
      }
      if (/^https?:/i.test(src)) {
        warn(`icon ${src} is remote; serve it from your own origin`);
        continue;
      }
      const file = at(src.replace(/^\//, ''));
      if (!existsSync(file)) {
        fail(`icon file ${src} does not exist`);
        continue;
      }
      const declared = String(icon.sizes || '').toLowerCase().split(/\s+/)[0];
      const match = /^(\d+)x(\d+)$/.exec(declared);
      const actual = pngSize(file);
      if (!actual) {
        fail(`${src} is not a readable PNG`);
      } else if (match && (Number(match[1]) !== actual.width || Number(match[2]) !== actual.height)) {
        fail(`${src} is ${actual.width}x${actual.height} but declares ${declared}`);
      } else {
        pass(`${src} is ${actual.width}x${actual.height}`);
      }
    }
  }

  const purposes = (manifest.icons || []).map((icon) => String(icon.purpose || 'any'));
  if (!purposes.some((purpose) => purpose.includes('maskable'))) {
    warn('no maskable icon; Android will letterbox the regular icon');
  } else {
    pass('a maskable icon is declared');
  }

  if (manifest.share_target && manifest.share_target.action !== '/share-target') {
    fail(`share_target.action is "${manifest.share_target.action}"; the worker handles /share-target`);
  }

  const handlers = manifest.protocol_handlers || [];
  for (const handler of handlers) {
    const url = String(handler.url || '');
    if (url && !url.includes('%s')) {
      fail(`protocol handler "${handler.protocol}" url has no %s placeholder`);
    }
  }
  if (handlers.length) pass(`${handlers.length} protocol handler(s) declared`);
}

/* ------------------------------------------------------------------ *
 * 4. Service worker assets and version
 * ------------------------------------------------------------------ */

section('Service worker');

const worker = existsSync(at('progressier.js')) ? readFileSync(at('progressier.js'), 'utf8') : '';
const client = existsSync(at('pwa.js')) ? readFileSync(at('pwa.js'), 'utf8') : '';

const workerVersion = /const VERSION = '([^']+)'/.exec(worker);
const clientVersion = /version:\s*'([^']+)'/.exec(client);
if (!workerVersion) {
  fail('progressier.js has no VERSION constant');
} else if (!clientVersion) {
  fail('pwa.js has no version field');
} else if (workerVersion[1] !== clientVersion[1]) {
  fail(`version mismatch: worker ${workerVersion[1]} vs client ${clientVersion[1]}`);
} else {
  pass(`version is ${workerVersion[1]} in both files`);
}

const precached = [
  'offline.html',
  'offline.css',
  'offline.js',
  'pwa.css',
  'qrcode.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
for (const name of precached) {
  if (worker.includes(`'${name}'`)) {
    if (existsSync(at(name))) pass(`precache ${name} exists`);
    else fail(`precache ${name} is referenced but missing`);
  } else {
    warn(`progressier.js no longer references ${name}`);
  }
}

for (const name of ['share-target', 'offline.html', 'qrcode.js']) {
  if (!worker.includes(name)) warn(`progressier.js does not mention ${name}`);
}

/* ------------------------------------------------------------------ *
 * 5. No hosted Progressier leftovers in deployable files
 * ------------------------------------------------------------------ */

section('Progressier leftovers');

const deployable = [
  'manifest.webmanifest',
  'offline.html',
  'offline.js',
  'offline.css',
  'pwa.css',
  'browserconfig.xml',
];
let leftovers = 0;
for (const file of deployable) {
  if (!existsSync(at(file))) continue;
  const text = readFileSync(at(file), 'utf8');
  const hits = text.match(/progressier\.(app|com)/g) || [];
  if (hits.length) {
    leftovers += hits.length;
    fail(`${file} still references ${hits[0]} (${hits.length} occurrence(s))`);
  }
}
if (!leftovers) pass('no hosted Progressier URLs in deployable files');

// pwa.js is allowed to mention progressier.app because it rewrites leftover
// manifest links; anything more than that is suspicious.
const clientHits = (client.match(/progressier\.app/g) || []).length;
if (clientHits > 3) {
  warn(`pwa.js mentions progressier.app ${clientHits} times; check that these are only migration checks`);
} else if (clientHits) {
  pass('pwa.js only mentions progressier.app for migration checks');
}

/* ------------------------------------------------------------------ *
 * 6. Optional files worth having
 * ------------------------------------------------------------------ */

section('Optional files');

const optional = [
  ['icons/apple-touch-icon.png', 'iOS home-screen icon'],
  ['icons/favicon-32.png', 'PNG favicon'],
  ['browserconfig.xml', 'Windows tiles'],
  ['snippet.html', 'copy-paste head block'],
  ['LICENSE', 'license file'],
];

for (const [file, label] of optional) {
  if (existsSync(at(file))) pass(`${label} (${file})`);
  else warn(`${file} is missing (${label})`);
}

const iconBytes = existsSync(at('icons/icon-512.png')) ? statSync(at('icons/icon-512.png')).size : 0;
if (iconBytes && iconBytes < 3000) warn('icons/icon-512.png looks like a placeholder or is heavily compressed');

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

console.log('');
if (failures.length === 0) {
  console.log(green(`All checks passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`));
  process.exit(0);
}

console.log(red(`${failures.length} check(s) failed, ${warnings.length} warning(s).`));
console.log(cyan('Fix the FAIL lines above before deploying.'));
process.exit(1);
