#!/usr/bin/env node
/**
 * Static checks for the kit. No dependencies, no network, no build.
 *
 *   node scripts/check.mjs
 *   npm run check
 *
 * Verifies:
 *   - JavaScript syntax of runtime and reference scripts
 *   - original and readable reference bundles are present
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
for (const file of [
  'pwa.js',
  'progressier.js',
  'offline.js',
  'qrcode.js',
  'example/example.js',
  'reference/Script.js',
  'reference/Script.decompiled.js',
]) {
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
 * 3. Reference artifacts (kept out of deployment)
 * ------------------------------------------------------------------ */

section('Reference artifacts');
for (const file of ['reference/Script.js', 'reference/Script.decompiled.js']) {
  if (existsSync(at(file))) pass(`${file} is preserved`);
  else fail(`${file} is missing`);
}

/* ------------------------------------------------------------------ *
 * 4. Manifest
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
 * 5. Service worker assets and version
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

const toolboxContract = [
  "toolbox: 'toolbox' in dataset",
  'function enableToolbox(options)',
  'enableToolbox: enableToolbox',
  'showToolbox: showToolbox',
  'hideToolbox: hideToolbox',
  'disableToolbox: disableToolbox',
  'showInstallRequest: showInstallRequest',
];
if (toolboxContract.every((token) => client.includes(token))) {
  pass('floating toolbox configuration, API and install flow are present');
} else {
  fail('floating toolbox configuration, API or install flow is incomplete');
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
 * 6. No hosted Progressier leftovers in deployable files
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
 * 7. GitHub Pages playground and user-facing example
 * ------------------------------------------------------------------ */

section('GitHub Pages examples');

const pagesRoot = new URL('https://pages.invalid/repo/');
const pagesBasePath = pagesRoot.pathname;
const examplePages = [
  {
    label: 'feature-test playground',
    html: 'demo/index.html',
    manifest: 'demo/manifest.webmanifest',
    publishedHtml: 'index.html',
    publishedManifest: 'manifest.webmanifest',
  },
  {
    label: 'user-facing example',
    html: 'example/index.html',
    manifest: 'example/manifest.webmanifest',
    publishedHtml: 'example/index.html',
    publishedManifest: 'example/manifest.webmanifest',
  },
];
const seenExampleIds = new Map();

const sharedRuntimeFiles = new Set([
  'pwa.js',
  'pwa.css',
  'progressier.js',
  'qrcode.js',
  'offline.html',
  'offline.css',
  'offline.js',
  'browserconfig.xml',
  'favicon.ico',
]);

function pagesFile(url, label) {
  if (url.origin !== pagesRoot.origin || !url.pathname.startsWith(pagesBasePath)) {
    fail(`${label} points outside the GitHub Pages project path: ${url.href}`);
    return null;
  }

  const deployedPath = decodeURIComponent(url.pathname.slice(pagesBasePath.length));
  if (deployedPath.startsWith('example/')) {
    const exampleAsset = deployedPath.slice('example/'.length);
    if (sharedRuntimeFiles.has(exampleAsset) || exampleAsset.startsWith('icons/')) {
      return at(exampleAsset);
    }
  }
  return at(deployedPath);
}

function tagAttribute(tag, name) {
  const match = new RegExp(name + '="([^"]+)"', 'i').exec(tag);
  return match ? match[1] : '';
}

for (const page of examplePages) {
  const htmlPath = at(page.html);
  const manifestPath = at(page.manifest);
  if (!existsSync(htmlPath)) {
    fail(`${page.label} HTML is missing (${page.html})`);
    continue;
  }
  if (!existsSync(manifestPath)) {
    fail(`${page.label} manifest is missing (${page.manifest})`);
    continue;
  }

  const html = readFileSync(htmlPath, 'utf8');
  const publishedPageUrl = new URL(page.publishedHtml, pagesRoot);
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  const manifestTag = linkTags.find((tag) => /\brel\s*=\s*["']manifest["']/i.test(tag));
  const manifestHref = manifestTag ? tagAttribute(manifestTag, 'href') : '';
  if (!manifestHref) {
    fail(`${page.label} has no manifest link`);
  } else {
    const manifestUrl = new URL(manifestHref, publishedPageUrl);
    const expectedManifestUrl = new URL(page.publishedManifest, pagesRoot);
    if (manifestUrl.href !== expectedManifestUrl.href) {
      fail(`${page.label} manifest link resolves to ${manifestUrl.pathname}, expected ${expectedManifestUrl.pathname}`);
    } else {
      pass(`${page.label} links to ${manifestUrl.pathname}`);
    }
  }

  const scriptTags = html.match(/<script\b[^>]*>/gi) || [];
  const pwaTag = scriptTags.find((tag) => /\bsrc\s*=\s*["'][^"']*pwa\.js(?:[?#][^"']*)?["']/i.test(tag));
  const pwaSrc = pwaTag ? tagAttribute(pwaTag, 'src') : '';
  let pwaUrl = null;
  if (!pwaSrc) {
    fail(`${page.label} does not load pwa.js`);
  } else {
    pwaUrl = new URL(pwaSrc, publishedPageUrl);
    const pwaPath = pagesFile(pwaUrl, `${page.label} pwa.js`);
    if (pwaPath && existsSync(pwaPath)) pass(`${page.label} pwa.js resolves to its deployed runtime`);
    else if (pwaPath) fail(`${page.label} pwa.js target does not exist: ${pwaUrl.pathname}`);
  }

  if (pwaTag && pwaUrl) {
    if (/\bdata-toolbox(?:\s|=|>)/i.test(pwaTag)) {
      pass(`${page.label} enables the floating install toolbox`);
    } else {
      fail(`${page.label} is missing data-toolbox`);
    }

    const manifestSrc = tagAttribute(pwaTag, 'data-manifest') || 'manifest.webmanifest';
    const configuredManifestUrl = new URL(manifestSrc, pwaUrl);
    const expectedManifestUrl = new URL(page.publishedManifest, pagesRoot);
    if (configuredManifestUrl.href === expectedManifestUrl.href) {
      pass(`${page.label} runtime uses its route-local manifest`);
    } else {
      fail(`${page.label} runtime manifest resolves to ${configuredManifestUrl.pathname}, expected ${expectedManifestUrl.pathname}`);
    }

    const workerSrc = tagAttribute(pwaTag, 'data-sw') || 'progressier.js';
    const workerUrl = new URL(workerSrc, pwaUrl);
    const workerPath = pagesFile(workerUrl, `${page.label} service worker`);
    if (workerPath && existsSync(workerPath)) pass(`${page.label} service worker resolves to its deployed worker`);
    else if (workerPath) fail(`${page.label} service worker target does not exist: ${workerUrl.pathname}`);

    const scopeSrc = tagAttribute(pwaTag, 'data-sw-scope');
    const workerScopeUrl = scopeSrc ? new URL(scopeSrc, pwaUrl) : new URL('.', workerUrl);
    const expectedScopeUrl = new URL('.', publishedPageUrl);
    if (workerScopeUrl.pathname === expectedScopeUrl.pathname) {
      pass(`${page.label} service worker is scoped to its own route`);
    } else {
      fail(`${page.label} service worker scope is ${workerScopeUrl.pathname}, expected ${expectedScopeUrl.pathname}`);
    }
  }

  const stylesheetTag = linkTags.find((tag) => tag.includes('rel="stylesheet"'));
  if (stylesheetTag) {
    const stylesheetUrl = new URL(tagAttribute(stylesheetTag, 'href'), publishedPageUrl);
    const stylesheetPath = pagesFile(stylesheetUrl, `${page.label} stylesheet`);
    if (stylesheetPath && existsSync(stylesheetPath)) pass(`${page.label} stylesheet is included`);
    else if (stylesheetPath) fail(`${page.label} stylesheet is missing: ${stylesheetUrl.pathname}`);
  }

  if (page.label === 'user-facing example') {
    const appScript = scriptTags.find((tag) => tag.includes('src="example.js"'));
    if (!appScript) {
      fail(`${page.label} app script is missing from its HTML`);
    } else {
      const appScriptUrl = new URL(tagAttribute(appScript, 'src'), publishedPageUrl);
      const appScriptPath = pagesFile(appScriptUrl, `${page.label} app script`);
      if (appScriptPath && existsSync(appScriptPath)) pass(`${page.label} app script is included`);
      else if (appScriptPath) fail(`${page.label} app script target is missing: ${appScriptUrl.pathname}`);
    }
  }

  let pageManifest;
  try {
    pageManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    pass(`${page.label} manifest parses`);
  } catch (error) {
    fail(`${page.label} manifest is invalid JSON: ${error.message}`);
    continue;
  }

  const manifestUrl = new URL(page.publishedManifest, pagesRoot);
  const scopeUrl = new URL(pageManifest.scope || './', manifestUrl);
  const startUrl = new URL(pageManifest.start_url || './', manifestUrl);
  if (scopeUrl.origin !== pagesRoot.origin || startUrl.origin !== pagesRoot.origin || !startUrl.pathname.startsWith(scopeUrl.pathname)) {
    fail(`${page.label} start_url is outside its manifest scope`);
  } else {
    pass(`${page.label} start_url is inside its own scope`);
  }

  if (!pageManifest.id) {
    fail(`${page.label} manifest has no stable id`);
  } else {
    const id = new URL(pageManifest.id, manifestUrl).href;
    if (seenExampleIds.has(id)) {
      fail(`${page.label} shares a manifest id with ${seenExampleIds.get(id)}`);
    } else {
      seenExampleIds.set(id, page.label);
      pass(`${page.label} has a distinct install identity`);
    }
  }

  for (const icon of pageManifest.icons || []) {
    const iconUrl = new URL(icon.src || '', manifestUrl);
    const iconPath = pagesFile(iconUrl, `${page.label} icon`);
    if (!iconPath) continue;
    if (!existsSync(iconPath)) {
      fail(`${page.label} icon is missing: ${iconUrl.pathname}`);
      continue;
    }
    const actual = pngSize(iconPath);
    const declared = /^(\d+)x(\d+)$/.exec(String(icon.sizes || '').split(/\s+/)[0]);
    if (!actual || (declared && (Number(declared[1]) !== actual.width || Number(declared[2]) !== actual.height))) {
      fail(`${page.label} icon does not match its declared PNG size: ${iconUrl.pathname}`);
    } else {
      pass(`${page.label} icon ${iconUrl.pathname} is ${actual.width}x${actual.height}`);
    }
  }
}

for (const file of ['example/example.css', 'example/example.js']) {
  if (existsSync(at(file))) pass(`${file} exists`);
  else fail(`${file} is missing`);
}

/* ------------------------------------------------------------------ *
 * 8. Optional files worth having
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
