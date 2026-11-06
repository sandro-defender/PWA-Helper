import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  YouGeAssistant,
  bridgePwaGlobals,
  readToolkitSummary,
} from '../src/index.js';
import {
  FALLBACK_ASSISTANT_STATE,
  createReactAdapter,
  getExternalStoreBindings,
} from '../src/adapters/react.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectJsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectJsFiles(full, out);
    else if (full.endsWith('.js') || full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

test('integrates with existing diagnostics runners on-demand and single-flight without polling', async () => {
  let dnsCalls = 0;
  const fakeDns = {
    check(ctx) {
      dnsCalls += 1;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            hostname: ctx.hostname,
            classification: 'normal_connectivity',
            message: 'Healthy DNS and app probe.',
          });
        }, 10);
      });
    },
  };

  const assistant = YouGeAssistant.create({
    projectId: 'diag-project',
    domain: 'app.example.com',
    dns: fakeDns,
    bindEvents: false,
  });

  // No diagnostic runs automatically upon initialization.
  assert.equal(dnsCalls, 0);
  assert.equal(assistant.getState().network.dns.status, 'idle');

  // Concurrent explicit calls share one in-flight promise.
  const p1 = assistant.runDiagnostics();
  const p2 = assistant.runDiagnostics();
  assert.equal(p1, p2);
  assert.equal(assistant.getState().network.dns.status, 'running');

  const result = await p1;
  assert.equal(dnsCalls, 1);
  assert.equal(result.classification, 'normal_connectivity');
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity');
  assert.equal(assistant.getState().network.dns.status, 'complete');

  assistant.destroy();
});

test('integrates with window.PWA installation flow and supports lazy pwa:ready binding without competing prompts', async () => {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(ev) { if (listeners.has(ev.type)) listeners.get(ev.type)(ev); },
  };
  const root = {
    document: doc,
    location: { hostname: 'pwa.example.com', origin: 'https://pwa.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
    addEventListener() {},
    removeEventListener() {},
  };

  // Start before window.PWA exists (simulating deferred pwa.js load)
  const assistant = YouGeAssistant.create({ projectId: 'lazy-pwa' }, { root });
  assert.equal(assistant.getState().installation.support, 'none');
  assert.equal((await assistant.requestInstall()).outcome, 'unsupported');

  // Now pwa.js finishes loading and publishes window.PWA + pwa:ready
  let promptCalls = 0;
  let onChangeCallback = null;
  const pwaState = { installed: false, standalone: false, canInstall: true, ios: false, safari: false };
  root.PWA = {
    __pwaKit: true,
    version: '1.0.5',
    config: { features: { installation: true, diagnostics: true } },
    getState: () => ({ ...pwaState }),
    canInstall: () => pwaState.canInstall,
    isInstalled: () => pwaState.installed,
    isIOS: () => false,
    isSafari: () => false,
    onChange(cb) {
      onChangeCallback = cb;
      return () => { onChangeCallback = null; };
    },
    promptInstall() {
      promptCalls += 1;
      pwaState.installed = true;
      pwaState.canInstall = false;
      if (onChangeCallback) onChangeCallback({ ...pwaState });
      return Promise.resolve({ outcome: 'accepted' });
    },
  };

  doc.dispatchEvent({ type: 'pwa:ready' });
  assert.equal(assistant.getState().installation.support, 'native');
  assert.equal(assistant.getState().installation.nativeAvailable, true);

  const installResult = await assistant.requestInstall();
  assert.equal(installResult.outcome, 'accepted');
  assert.equal(promptCalls, 1, 'delegates directly to PWA.promptInstall');
  assert.equal(assistant.getState().installation.status, 'installed');

  const summary = readToolkitSummary(root);
  assert.equal(summary.hasPwaToolkit, true);
  assert.equal(summary.pwaVersion, '1.0.5');

  assistant.destroy();
  assert.equal(onChangeCallback, null, 'destroy unsubscribes from PWA.onChange');
});

test('bridgePwaGlobals connects domain resolver and singleton state without overwriting existing window.PWA', () => {
  const existingPwa = { __pwaKit: true, version: '1.0.5', getState: () => ({}) };
  const root = {
    PWA: existingPwa,
    location: { hostname: 'bridge.example.com', origin: 'https://bridge.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
  };

  const bridged = bridgePwaGlobals({
    root,
    domainRegistry: {
      'bridge.example.com': { identity: { name: 'Bridged App' } },
    },
    assistantConfig: { projectId: 'bridged-project', bindEvents: false },
  });

  assert.equal(bridged.bridged, true);
  assert.equal(root.PWA, existingPwa, 'existing window.PWA is untouched');
  assert.equal(bridged.assistant.getState().project.name, 'Bridged App');
  assert.equal(root.YouGeAssistant, bridged.assistant);

  bridged.assistant.destroy();
});

test('optional React adapter works via injected useSyncExternalStore with memoized selectors and SSR fallback', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'react-adapter-test',
    features: [{ id: 'f1', label: 'Feature 1' }],
    bindEvents: false,
  });

  // Minimal synchronous simulation of React's useSyncExternalStore
  let subscribedCleanup = null;
  function fakeUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    assert.equal(typeof getServerSnapshot, 'function');
    assert.equal(getServerSnapshot(), FALLBACK_ASSISTANT_STATE);
    subscribedCleanup = subscribe(() => {});
    return getSnapshot();
  }

  const adapter = createReactAdapter({
    useSyncExternalStore: fakeUseSyncExternalStore,
    assistant,
  });

  const fullState = adapter.useAssistant();
  assert.equal(fullState.project.id, 'react-adapter-test');
  const badgeCount = adapter.useAssistant((s) => s.badge.count);
  assert.equal(badgeCount, 1);

  const bindings = getExternalStoreBindings(assistant, (s) => ({ count: s.badge.count }));
  const firstSelected = bindings.getSnapshot();
  const secondSelected = bindings.getSnapshot();
  assert.equal(firstSelected, secondSelected, 'selector output is cached while state snapshot is unchanged');

  if (subscribedCleanup) subscribedCleanup();
  assistant.destroy();
});

test('SDK package has zero runtime dependencies, zero React import in core, zero fetch, zero SW register and zero polling', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined, 'no mandatory runtime dependencies');
  assert.equal(pkg.peerDependenciesMeta?.react?.optional, true, 'React peer is optional');

  const files = collectJsFiles(join(pkgRoot, 'src'));
  assert.ok(files.length >= 10);

  for (const file of files) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file} makes no network fetch calls`);
    assert.doesNotMatch(source, /serviceWorker\.register|\.register\s*\(/, `${file} never registers a service worker`);
    assert.doesNotMatch(source, /\bsetInterval\s*\(/, `${file} never polls on an interval`);
    assert.doesNotMatch(source, /from\s+['"]react['"]|require\(['"]react['"]\)/, `${file} has no runtime import of react`);
    assert.doesNotMatch(source, /react-bits|ogl|gsap|three/, `${file} has no UI library dependency`);
    assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(/, `${file} never evaluates dynamic code`);
    assert.doesNotMatch(source, /staff\.you\.ge|workers\.dev/, `${file} contains no hardcoded project hostnames`);
  }
});
