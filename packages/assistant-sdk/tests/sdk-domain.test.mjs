import assert from 'node:assert/strict';
import test from 'node:test';
import {
  YouGeAssistant,
  buildManifest,
  createDomainResolver,
  normalizeHost,
  normalizePath,
  resolveDomain,
  rootDomain,
} from '../src/index.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    _map: map,
  };
}

test('supports multiple isolated project and domain configurations simultaneously', () => {
  const sharedStorage = makeStorage();
  const registry = {
    'alpha.example.com': {
      identity: { name: 'Alpha Workspace', shortName: 'Alpha' },
      branding: { themeColor: '#1d4ed8', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/', scope: '/', startUrl: '/?home=1', id: '/alpha-id' },
    },
    '*.beta.example.org/app/': {
      identity: { name: 'Beta Subpath App', shortName: 'Beta' },
      branding: { themeColor: '#047857', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/app/', scope: './', startUrl: './?home=1', id: './' },
    },
  };

  const alpha = YouGeAssistant.create({
    projectId: 'proj-alpha',
    domain: 'alpha.example.com',
    domainRegistry: registry,
    features: [{ id: 'welcome', label: 'Alpha release' }],
    storage: sharedStorage,
    bindEvents: false,
  });

  const beta = YouGeAssistant.create({
    projectId: 'proj-beta',
    location: {
      hostname: 'team.beta.example.org',
      origin: 'https://team.beta.example.org',
      protocol: 'https:',
      pathname: '/app/dashboard',
    },
    domainRegistry: registry,
    features: [{ id: 'welcome', label: 'Beta release' }],
    storage: sharedStorage,
    bindEvents: false,
  });

  assert.equal(alpha.getState().project.name, 'Alpha Workspace');
  assert.equal(alpha.getState().project.hostname, 'alpha.example.com');
  assert.equal(alpha.getState().project.configured, true);
  assert.equal(alpha.getState().appearance.themeColor, '#1d4ed8');

  assert.equal(beta.getState().project.name, 'Beta Subpath App');
  assert.equal(beta.getState().project.hostname, 'team.beta.example.org');
  assert.equal(beta.getState().project.basePath, '/app/');
  assert.equal(beta.getState().project.configured, true);
  assert.equal(beta.getState().appearance.themeColor, '#047857');

  // Dismissing a notice in alpha never suppresses notices in beta.
  assert.equal(alpha.dismiss('feature:welcome'), true);
  assert.equal(alpha.getState().notifications.length, 0);
  assert.equal(beta.getState().notifications.length, 1);

  alpha.destroy();
  beta.destroy();
});

test('treats unknown or arbitrary hostnames as unconfigured and never as authentication', () => {
  const registry = {
    'verified.example.com': {
      identity: { name: 'Verified App' },
      branding: { themeColor: '#111827' },
    },
  };

  const unknown = YouGeAssistant.create({
    domain: 'untrusted-host.invalid',
    domainRegistry: registry,
    bindEvents: false,
  });

  const state = unknown.getState();
  assert.equal(state.project.hostname, 'untrusted-host.invalid');
  assert.equal(state.project.configured, false, 'arbitrary host is never marked configured');
  assert.equal(state.project.name, 'You.Ge Assistant', 'receives neutral default identity');
  assert.equal(state.network.session.state, 'unknown', 'domain detection never implies an authenticated session');
  assert.equal('authenticated' in state.project, false);
  assert.equal('trusted' in state.project, false);

  unknown.destroy();
});

test('resolves exact host before wildcard, enforces path traversal checks, and builds scoped manifests', () => {
  const resolver = createDomainResolver({
    '*.example.co.uk': { identity: { name: 'Wildcard UK' } },
    'portal.example.co.uk': {
      identity: { name: 'Exact Portal UK', shortName: 'Portal' },
      pwa: { basePath: '/workspace/', scope: './', startUrl: './?launch=1', id: './' },
      shortcuts: [
        { name: 'Valid Shortcut', url: './tasks' },
        { name: 'Escaped Root', url: '/admin' },
        { name: 'Cross Origin', url: 'https://evil.example/phish' },
      ],
    },
  });

  assert.equal(normalizeHost('PORTAL.EXAMPLE.CO.UK.'), 'portal.example.co.uk');
  assert.equal(rootDomain('portal.example.co.uk'), 'example.co.uk');
  assert.equal(normalizePath('/workspace/../etc', '/'), null);

  const resolved = resolver.resolve({
    hostname: 'portal.example.co.uk',
    origin: 'https://portal.example.co.uk',
    protocol: 'https:',
    pathname: '/workspace/home',
  });
  assert.equal(resolved.identity.name, 'Exact Portal UK');
  assert.equal(resolved.domain.subdomain, 'portal');
  assert.equal(resolved.domain.basePath, '/workspace/');

  const manifest = buildManifest(resolved);
  assert.equal(manifest.name, 'Exact Portal UK');
  assert.equal(manifest.share_target.action, '/workspace/share-target');
  assert.deepEqual(manifest.shortcuts.map((s) => s.name), ['Valid Shortcut']);
});
