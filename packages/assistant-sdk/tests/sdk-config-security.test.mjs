import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUNDLED_DEFAULTS,
  YouGeAssistant,
  lkgStorageKey,
  loadLastKnownGood,
  resolveAssistantConfig,
  validatePublishedConfig,
} from '../src/index.js';

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    _map: map,
  };
}

test('layers bundled defaults -> publishedConfig -> project-specific overrides cleanly', () => {
  const storage = makeStorage();
  const assistant = YouGeAssistant.create({
    projectId: 'alpha',
    publishedConfig: {
      schemaVersion: 1,
      revision: 'rev-10',
      publishedAt: '2026-11-06T00:00:00Z',
      projectId: 'alpha',
      position: 'bottom-left',
      offsets: { x: 28, y: 36 },
      branding: {
        name: 'Alpha Published',
        shortName: 'AlphaPub',
        themeColor: '#2563eb',
      },
      modules: { failover: false },
    },
    branding: {
      shortName: 'AlphaLocal',
    },
    theme: 'dark',
    storage,
    bindEvents: false,
  });

  const cfg = assistant.getConfig();
  assert.equal(cfg.meta.source, 'published');
  assert.equal(cfg.meta.revision, 'rev-10');
  assert.equal(cfg.meta.usedLastKnownGood, false);
  assert.equal(cfg.position, 'bottom-left', 'published value overrides bundled default');
  assert.equal(cfg.branding.name, 'Alpha Published', 'published branding preserved when not overridden');
  assert.equal(cfg.branding.shortName, 'AlphaLocal', 'project override wins over published default');
  assert.equal(cfg.theme, 'dark', 'project override applied');
  assert.equal(cfg.modules.failover, false);
  assert.equal(cfg.modules.diagnostics, BUNDLED_DEFAULTS.modules.diagnostics);

  const lkg = loadLastKnownGood(storage, 'alpha');
  assert.ok(lkg && lkg.valid, 'valid published revision is persisted as last-known-good');
  assert.equal(lkg.revision, 'rev-10');
  assistant.destroy();
});

test('falls back to project-scoped Last-Known-Good when a new publishedConfig fails validation', () => {
  const storage = makeStorage();

  // Seed valid revision 1 for project-x
  const initial = YouGeAssistant.create({
    projectId: 'project-x',
    publishedConfig: {
      schemaVersion: 1,
      revision: 'rev-1',
      projectId: 'project-x',
      position: 'top-right',
      branding: { name: 'Verified Workspace', themeColor: '#0f766e' },
    },
    storage,
    bindEvents: false,
  });
  initial.destroy();

  // Subsequent init receives an unsupported major schemaVersion: 2
  const recovered = YouGeAssistant.create({
    projectId: 'project-x',
    publishedConfig: {
      schemaVersion: 2,
      revision: 'rev-broken',
      projectId: 'project-x',
      position: 'bottom-left',
    },
    storage,
    bindEvents: false,
  });

  const cfg = recovered.getConfig();
  assert.equal(cfg.meta.source, 'last-known-good');
  assert.equal(cfg.meta.usedLastKnownGood, true);
  assert.equal(cfg.meta.revision, 'rev-1');
  assert.equal(cfg.position, 'top-right');
  assert.equal(cfg.branding.name, 'Verified Workspace');
  assert.ok(cfg.meta.warnings.some((w) => w.includes('unsupported_schema_version')));

  // Another project does NOT inherit project-x's LKG
  const other = YouGeAssistant.create({
    projectId: 'project-y',
    publishedConfig: { schemaVersion: 99 },
    storage,
    bindEvents: false,
  });
  assert.equal(other.getConfig().meta.usedLastKnownGood, false);
  assert.equal(other.getConfig().position, 'bottom-right');

  recovered.destroy();
  other.destroy();
});

test('rejects executable JavaScript in publishedConfig and sanitizes local overrides', () => {
  const withFunction = validatePublishedConfig({
    schemaVersion: 1,
    projectId: 'p1',
    onInit: () => {},
  });
  assert.equal(withFunction.valid, false);
  assert.equal(withFunction.reason, 'executable_function_rejected');

  const withJavascriptUrl = validatePublishedConfig({
    schemaVersion: 1,
    projectId: 'p1',
    branding: { icon: 'javascript:alert(1)' },
  });
  assert.equal(withJavascriptUrl.valid, false);
  assert.equal(withJavascriptUrl.reason, 'executable_code_rejected');

  const withScriptTag = validatePublishedConfig(JSON.stringify({
    schemaVersion: 1,
    projectId: 'p1',
    features: [{ id: 'f1', label: 'News', message: '<script>evil()</script>' }],
  }));
  assert.equal(withScriptTag.valid, false);
  assert.equal(withScriptTag.reason, 'executable_code_rejected');

  // Local overrides with javascript: or cross-origin icon fall back to safe default icon
  const assistant = YouGeAssistant.create({
    projectId: 'p1',
    domain: 'app.example.com',
    branding: {
      icon: 'https://attacker.invalid/steal.png',
      name: 'Safe <img onerror=1> Title',
    },
    bindEvents: false,
  });
  assert.equal(assistant.getState().project.icon, 'icons/icon-192.png');
  assert.doesNotMatch(assistant.getState().project.name, /[<>]/);
  assistant.destroy();
});

test('rejects secrets in publishedConfig and strips accidental secrets from public SDK configuration', () => {
  const storage = makeStorage();

  const publishedWithSecret = validatePublishedConfig({
    schemaVersion: 1,
    projectId: 'sec-test',
    apiKey: 'sk-live-123456',
  });
  assert.equal(publishedWithSecret.valid, false);
  assert.equal(publishedWithSecret.reason, 'secret_fields_rejected');
  assert.deepEqual(publishedWithSecret.secretKeys, ['apiKey']);

  const resolved = resolveAssistantConfig({
    projectId: 'sec-test',
    apiKey: 'sk-live-secret',
    vapidPrivateKey: 'private-vapid-value',
    credentials: { bearerToken: 'eyJ-sensitive' },
    branding: { name: 'Clean Project' },
  }, { storage });

  assert.ok(resolved.meta.warnings.includes('secret_fields_stripped'));
  const serializedConfig = JSON.stringify(resolved.config);
  assert.doesNotMatch(serializedConfig, /sk-live-secret|private-vapid-value|eyJ-sensitive|apiKey|vapidPrivateKey/i);

  const assistant = YouGeAssistant.create({
    projectId: 'sec-test',
    accessToken: 'secret-access-token',
    password: 'super-secret-password',
    publishedConfig: {
      schemaVersion: 1,
      projectId: 'sec-test',
      clientSecret: 'never-persist-me',
    },
    storage,
    bindEvents: false,
  });

  const stateJson = JSON.stringify(assistant.getState());
  const configJson = JSON.stringify(assistant.getConfig());
  const storedJson = JSON.stringify(Array.from(storage._map.entries()));
  for (const blob of [stateJson, configJson, storedJson]) {
    assert.doesNotMatch(blob, /secret-access-token|super-secret-password|never-persist-me/i);
  }
  assert.equal(storage.getItem(lkgStorageKey('sec-test')), null, 'rejected secret config is never cached in LKG');
  assistant.destroy();
});

test('prevents cross-project publishedConfig injection and tampered LKG payloads', () => {
  const storage = makeStorage({
    [lkgStorageKey('tenant-a')]: JSON.stringify({
      schemaVersion: 1,
      projectId: 'tenant-b',
      config: { branding: { name: 'Wrong Tenant' } },
    }),
  });

  assert.equal(loadLastKnownGood(storage, 'tenant-a'), null, 'mismatched projectId in storage is rejected');

  const mismatch = validatePublishedConfig(
    { schemaVersion: 1, projectId: 'tenant-b', branding: { name: 'Tenant B' } },
    { expectedProjectId: 'tenant-a' }
  );
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.reason, 'project_id_mismatch');

  const protoPayload = JSON.parse('{"schemaVersion":1,"projectId":"tenant-a","__proto__":{"polluted":true},"domainRegistry":{"__proto__":{"polluted":true}}}');
  const protoChecked = validatePublishedConfig(protoPayload);
  assert.equal(protoChecked.valid, true);
  assert.equal(({}).polluted, undefined, 'prototype pollution keys are ignored');
});
