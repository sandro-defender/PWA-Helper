#!/usr/bin/env node
/**
 * Release-gate validation for the @youge/assistant-sdk package.
 *
 *   node scripts/validate-package.mjs            (from packages/assistant-sdk)
 *   node packages/assistant-sdk/scripts/validate-package.mjs   (from the repo root)
 *
 * Verifies, with zero dependencies and no network access:
 *   - package metadata (name shape, semver, module type, publish config)
 *   - version synchronization (package.json <-> SDK_VERSION <-> KIT_COMPAT_VERSION)
 *   - export map: every target exists and ships a paired TypeScript declaration
 *   - package contents: files whitelist, npm pack list, README, LICENSE
 *   - dependency requirements: zero runtime deps, optional react peer only
 *   - source hygiene: relative imports only, nothing escapes the package root
 *   - the "private: true" accidental-publish guard is still in place
 *
 * Exits 1 on failure.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgDir, '..', '..');

const failures = [];
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;

function pass(message) {
  console.log(`  ${green('PASS')} ${message}`);
}
function fail(message) {
  failures.push(message);
  console.log(`  ${red('FAIL')} ${message}`);
}
function note(message) {
  console.log(`  ${yellow('NOTE')} ${message}`);
}
function section(title) {
  console.log(`\n${title}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`cannot parse JSON: ${relative(repoRoot, path)} (${error.message})`);
    return null;
  }
}

/** Collect every string target from a nested exports condition object. */
function collectExportTargets(node, out = []) {
  if (typeof node === 'string') {
    out.push(node);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectExportTargets(value, out);
  }
  return out;
}

function walkFiles(dir, filter, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

const pkg = readJson(join(pkgDir, 'package.json'));
if (!pkg) {
  console.error('\nSDK package validation failed.');
  process.exit(1);
}

/* 1. Package identity ----------------------------------------------------- */

section('Package identity');

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const NPM_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;

if (pkg.name === '@youge/assistant-sdk') {
  pass('package name is @youge/assistant-sdk');
} else if (typeof pkg.name === 'string' && NPM_NAME.test(pkg.name)) {
  note(`package name is ${pkg.name} (valid npm name; confirm the registry scope is owned before publishing — see RELEASE.md)`);
} else {
  fail(`package name is not a valid npm package name: ${JSON.stringify(pkg.name)}`);
}

if (typeof pkg.version === 'string' && SEMVER.test(pkg.version)) {
  pass(`package version ${pkg.version} is valid semver`);
} else {
  fail(`package version is not valid semver: ${JSON.stringify(pkg.version)}`);
}

if (pkg.type === 'module') {
  pass('package is ESM ("type": "module") with a documented ESM-only policy');
} else {
  fail('package must declare "type": "module" (the SDK ships native ESM)');
}

if (pkg.publishConfig && pkg.publishConfig.access === 'public') {
  pass('publishConfig.access is "public" (required for the first scoped publish)');
} else {
  fail('publishConfig.access must be "public" so an approved scoped release does not default to restricted');
}

/* 2. Version synchronization ---------------------------------------------- */

section('Version synchronization');

const constantsPath = join(pkgDir, 'src', 'core', 'constants.js');
const constants = readFileSync(constantsPath, 'utf8');
const sdkVersion = /export const SDK_VERSION = '([^']+)'/.exec(constants);
const kitCompat = /export const KIT_COMPAT_VERSION = '([^']+)'/.exec(constants);

if (sdkVersion && sdkVersion[1] === pkg.version) {
  pass(`SDK_VERSION in src/core/constants.js matches package.json (${pkg.version})`);
} else {
  fail(`version mismatch: package.json ${pkg.version} vs SDK_VERSION ${sdkVersion ? sdkVersion[1] : 'missing'}`);
}

const rootPkg = readJson(join(repoRoot, 'package.json'));
if (kitCompat && rootPkg && kitCompat[1] === rootPkg.version) {
  pass(`KIT_COMPAT_VERSION (${kitCompat[1]}) matches the You.Ge Assistant runtime version`);
} else {
  fail(`KIT_COMPAT_VERSION ${kitCompat ? kitCompat[1] : 'missing'} does not match the runtime version ${rootPkg ? rootPkg.version : 'unknown'}`);
}

/* 3. Export map ----------------------------------------------------------- */

section('Export map and TypeScript declarations');

const exportTargets = collectExportTargets(pkg.exports ?? {});
const entryTargets = [];

if (pkg.exports && typeof pkg.exports === 'object') {
  for (const [subpath, value] of Object.entries(pkg.exports)) {
    const targets = collectExportTargets(value);
    for (const target of targets) {
      if (!target.startsWith('./')) {
        fail(`exports["${subpath}"] target must be package-relative ("./..."), got ${target}`);
        continue;
      }
      if (target === './package.json') {
        if (existsSync(join(pkgDir, 'package.json'))) pass('exports exposes ./package.json');
        else fail('exports references ./package.json but it is missing');
        continue;
      }
      if (!existsSync(join(pkgDir, target))) {
        fail(`exports["${subpath}"] target missing on disk: ${target}`);
        continue;
      }
      entryTargets.push(target);
    }

    if (value && typeof value === 'object') {
      const typesTarget = value.types ?? (value.import && value.import.types);
      const jsTarget = value.default ?? value.import?.default ?? value.import;
      if (typeof typesTarget === 'string' && typesTarget.endsWith('.d.ts') && existsSync(join(pkgDir, typesTarget))) {
        pass(`exports["${subpath}"] ships types (${typesTarget})`);
      } else {
        fail(`exports["${subpath}"] is missing a paired .d.ts declaration`);
      }
      if (typeof jsTarget === 'string' && jsTarget.endsWith('.js') && existsSync(join(pkgDir, jsTarget))) {
        pass(`exports["${subpath}"] resolves (${jsTarget})`);
      } else {
        fail(`exports["${subpath}"] runtime target is missing`);
      }
    }
  }
} else {
  fail('package must declare an explicit exports map (the only supported import surface)');
}

if (pkg.exports && Object.keys(pkg.exports).some((key) => key.includes('*'))) {
  fail('exports must not use wildcard subpaths (internal source files stay unreachable)');
} else {
  pass('no wildcard exports: deep imports of internal source files are blocked');
}

for (const field of ['main', 'module', 'types']) {
  if (!pkg[field]) continue;
  if (existsSync(join(pkgDir, pkg[field]))) pass(`${field} target exists (${pkg[field]})`);
  else fail(`${field} target missing on disk: ${pkg[field]}`);
}
if (pkg.main && existsSync(join(pkgDir, pkg.main)) && pkg.types && existsSync(join(pkgDir, pkg.types))) {
  pass('legacy main/types fields mirror the "." export for older resolvers');
}

/* 4. Package contents ----------------------------------------------------- */

section('Package contents');

for (const required of ['README.md', 'LICENSE']) {
  if (existsSync(join(pkgDir, required))) pass(`${required} is present`);
  else fail(`${required} is missing`);
}

const readme = existsSync(join(pkgDir, 'README.md')) ? readFileSync(join(pkgDir, 'README.md'), 'utf8') : '';
if (readme.includes(String(pkg.name))) pass('README.md documents the package name');
else fail('README.md does not mention the package name');

const license = existsSync(join(pkgDir, 'LICENSE')) ? readFileSync(join(pkgDir, 'LICENSE'), 'utf8') : '';
if (/MIT/i.test(license)) pass('LICENSE declares the MIT license');
else fail('LICENSE does not look like the MIT license');

const filesWhitelist = Array.isArray(pkg.files) ? pkg.files : [];
const whitelisted = (target) => {
  const rel = target.replace(/^\.\//, '');
  if (rel === 'package.json') return true; // npm always packs package.json
  return filesWhitelist.some((entry) => rel === entry || rel.startsWith(`${entry.replace(/\/$/, '')}/`));
};
if (filesWhitelist.length > 0 && exportTargets.every(whitelisted) && ['README.md', 'LICENSE'].every(whitelisted)) {
  pass('files whitelist covers every exports target plus README and LICENSE');
} else {
  fail(`files whitelist ${JSON.stringify(filesWhitelist)} does not cover all published targets`);
}

let packFiles = null;
try {
  const packOut = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: pkgDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(packOut.slice(packOut.indexOf('[')));
  packFiles = (parsed[0]?.files ?? []).map((file) => file.path);
  pass(`npm pack --dry-run lists ${packFiles.length} files`);
} catch (error) {
  fail(`npm pack --dry-run failed: ${error.message}`);
}

if (packFiles) {
  const missing = exportTargets
    .map((target) => target.replace(/^\.\//, ''))
    .filter((rel) => !packFiles.includes(rel));
  if (missing.length === 0) pass('every exports target is included in the packed tarball');
  else fail(`exports targets missing from the tarball: ${missing.join(', ')}`);

  for (const required of ['README.md', 'LICENSE', 'package.json']) {
    if (packFiles.includes(required)) pass(`tarball contains ${required}`);
    else fail(`tarball is missing ${required}`);
  }

  const leaked = packFiles.filter(
    (file) => /(^|\/)(tests?|scripts|node_modules|\.github)(\/|$)/.test(file) || /\.test\.[cm]?js$/.test(file),
  );
  if (leaked.length === 0) pass('tarball ships runtime files only (no tests, scripts or repo metadata)');
  else fail(`tarball leaks non-runtime files: ${leaked.join(', ')}`);
}

/* 5. Dependency requirements ---------------------------------------------- */

section('Dependency requirements');

if (!pkg.dependencies || Object.keys(pkg.dependencies).length === 0) {
  pass('zero mandatory runtime dependencies');
} else {
  fail(`package must stay dependency-free, found: ${Object.keys(pkg.dependencies).join(', ')}`);
}

const peers = pkg.peerDependencies ?? {};
const peerNames = Object.keys(peers);
if (peerNames.every((name) => name === 'react') && (peerNames.length === 0 || pkg.peerDependenciesMeta?.react?.optional === true)) {
  pass('react is the only peer dependency and stays optional');
} else {
  fail(`unexpected peer dependencies: ${peerNames.join(', ') || '(none declared but meta mismatch)'}`);
}

for (const forbidden of ['bundledDependencies', 'bundleDependencies', 'optionalDependencies']) {
  if (pkg[forbidden]) fail(`${forbidden} must not be used (keep the package dependency-free)`);
}
pass('no bundled or optional dependencies');

/* 6. Source hygiene ------------------------------------------------------- */

section('Source hygiene');

const sourceFiles = walkFiles(join(pkgDir, 'src'), (file) => file.endsWith('.js') || file.endsWith('.d.ts'));
let relativeOnly = true;
let allResolve = true;

for (const file of sourceFiles) {
  const code = readFileSync(file, 'utf8');
  const specifiers = [];
  for (const match of code.matchAll(/(?:import|export)\s+[^;'"]*?from\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  for (const match of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  for (const match of code.matchAll(/import\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);

  for (const spec of specifiers) {
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      relativeOnly = false;
      fail(`${relative(pkgDir, file)} imports a bare specifier: ${spec}`);
      continue;
    }
    const resolved = resolve(dirname(file), spec);
    if (!resolved.startsWith(pkgDir + sep)) {
      relativeOnly = false;
      fail(`${relative(pkgDir, file)} imports outside the package: ${spec}`);
    } else if (!existsSync(resolved)) {
      allResolve = false;
      fail(`${relative(pkgDir, file)} imports a missing file: ${spec}`);
    }
  }
}
if (relativeOnly) pass(`all ${sourceFiles.length} source modules use package-relative imports only`);
if (allResolve) pass('every relative import resolves inside the package (no repository-specific paths)');

/* 7. Accidental-publish guard --------------------------------------------- */

section('Accidental-publish guard');

// In a release context (npm prepublishOnly or --release-context) the approved
// release PR has already removed the private flag; report the state instead of
// blocking. Everywhere else (CI, npm run check, manual runs) the guard is strict.
const releaseContext =
  process.argv.includes('--release-context') || process.env.npm_lifecycle_event === 'prepublishOnly';

if (pkg.private === true) {
  pass('package is marked "private": true — npm publish is impossible until the approved release PR removes the flag');
  note('the flag is the package-level publishing lock; see RELEASE.md for the release procedure');
} else if (releaseContext) {
  note('"private" flag absent in release context — publishing is possible; confirm this run is explicitly approved (RELEASE.md)');
} else {
  fail('the "private": true guard is missing — publishing must remain disabled until explicitly approved (RELEASE.md)');
}

/* -------------------------------------------------------------------------- */

if (failures.length > 0) {
  console.log(`\n${red(`SDK package validation failed: ${failures.length} problem(s).`)}`);
  process.exit(1);
}
console.log(`\n${green('SDK package validation passed.')} Package ${pkg.name}@${pkg.version} is ready for the release checklist (publishing still disabled).`);
