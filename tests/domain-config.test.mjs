import test from 'node:test';
import assert from 'node:assert/strict';
import '../domain-config.js';

const domain = globalThis.YouGeDomain;

const registry = {
  'staff.you.ge': {
    identity: { name: 'Staff workspace' },
    pwa: { id: '/legacy-id', startUrl: '/?installed=1', scope: '/', basePath: '/' },
  },
  '*.example.com': {
    identity: { name: 'Example workspace', shortName: 'Example' },
    pwa: { basePath: '/app/', scope: './', startUrl: './?launchedfrom=homescreen' },
  },
  'example.net': {
    identity: { name: 'Other domain' },
  },
};

function location(hostname, extra = {}) {
  const protocol = extra.protocol || 'https:';
  const port = extra.port ? `:${extra.port}` : '';
  return {
    hostname,
    protocol,
    origin: `${protocol}//${hostname}${port}`,
    pathname: extra.pathname || '/',
    ...extra,
  };
}

test('detects apex, www, and nested subdomains without a fixed supported-domain list', () => {
  const apex = domain.resolve(location('you.ge'), {});
  const www = domain.resolve(location('www.you.ge'), {});
  const nested = domain.resolve(location('team.staff.example.com'), {});
  assert.equal(apex.domain.rootDomain, 'you.ge');
  assert.equal(apex.domain.subdomain, '');
  assert.equal(www.domain.rootDomain, 'you.ge');
  assert.equal(www.domain.subdomain, 'www');
  assert.equal(nested.domain.rootDomain, 'example.com');
  assert.equal(nested.domain.subdomain, 'team.staff');
});

test('root-domain derivation is conservative for compound public suffix examples and IPs', () => {
  assert.equal(domain.resolve(location('portal.example.co.uk'), {}).domain.rootDomain, 'example.co.uk');
  assert.equal(domain.resolve(location('127.0.0.1'), {}).domain.rootDomain, '127.0.0.1');
  assert.equal(domain.resolve(location('localhost'), {}).domain.rootDomain, 'localhost');
});

test('captures HTTPS origin, protocol, pathname, installation origin, and configured base path', () => {
  const result = domain.resolve(location('portal.example.com', { pathname: '/app/reports', port: '8443' }), registry);
  assert.equal(result.domain.origin, 'https://portal.example.com:8443');
  assert.equal(result.domain.protocol, 'https:');
  assert.equal(result.domain.pathname, '/app/reports');
  assert.equal(result.domain.basePath, '/app/');
  assert.equal(result.domain.installOrigin, result.domain.origin);
});

test('resolves exact configuration before wildcard and uses safe defaults for unknown hosts', () => {
  assert.equal(domain.resolve(location('staff.you.ge'), registry).identity.name, 'Staff workspace');
  assert.equal(domain.resolve(location('app.example.com'), registry).identity.name, 'Example workspace');
  const unknown = domain.resolve(location('totally-unlisted.test'), registry);
  assert.equal(unknown.identity.name, 'You.Ge Assistant');
  assert.equal(unknown.domain.configured, false);
  assert.equal(unknown.features.dnsRecovery, true);
});

test('supports path-scoped overrides for multiple apps on one origin', () => {
  const registry = {
    'example.com': { identity: { name: 'Main app' } },
    'example.com/portal/': { identity: { name: 'Portal app' } },
    'shop.example.com': { identity: { name: 'Exact host app' } },
    '*.example.com/portal/': { identity: { name: 'Wildcard portal' } },
  };
  assert.equal(domain.resolve(location('example.com', { pathname: '/portal/orders' }), registry).identity.name, 'Portal app');
  assert.equal(domain.resolve(location('example.com', { pathname: '/other/' }), registry).identity.name, 'Main app');
  assert.equal(domain.resolve(location('shop.example.com', { pathname: '/portal/' }), registry).identity.name, 'Exact host app');
  assert.equal(domain.resolve(location('catalog.example.com', { pathname: '/portal/' }), registry).identity.name, 'Wildcard portal');
});

test('normalizes case and trailing dots and rejects mismatched origin hostnames', () => {
  const normalized = domain.resolve({ hostname: 'WWW.EXAMPLE.COM.', protocol: 'https:', origin: 'https://www.example.com', pathname: '/' }, registry);
  assert.equal(normalized.domain.hostname, 'www.example.com');
  const mismatch = domain.resolve({ hostname: 'example.com', protocol: 'https:', origin: 'https://attacker.invalid', pathname: '/' }, {});
  assert.equal(mismatch.domain.origin, 'https://example.com');
});

test('validates paths, display values, colors, and external manifest destinations', () => {
  const resolved = domain.resolve(location('safe.example'), {
    'safe.example': {
      identity: { name: 'Safe app' },
      branding: { themeColor: 'url(javascript:alert(1))', backgroundColor: '#abc' },
      pwa: { scope: '/../outside/', startUrl: 'https://attacker.invalid/', id: '//attacker.invalid', display: 'surprise' },
      metadata: { 'og:title': 'Workspace', 'script': 'not a meta field' },
    },
  });
  assert.equal(resolved.branding.themeColor, domain.defaults.branding.themeColor);
  assert.equal(resolved.branding.backgroundColor, '#abc');
  assert.equal(resolved.pwa.scope, './');
  assert.equal(resolved.pwa.startUrl, './');
  assert.equal(resolved.pwa.id, './');
  assert.equal(resolved.pwa.display, 'standalone');
  assert.deepEqual(resolved.metadata, { 'og:title': 'Workspace' });
  assert.equal(domain.normalizePath('/app/../admin/', '/'), null);
  assert.equal(domain.normalizePath('/app/%2e%2e/admin/', '/'), null);
  assert.equal(domain.normalizePath('/app/%2fadmin/', '/'), null);
  assert.equal(domain.normalizePath('/app', '/'), '/app/');
});

test('filters shortcut destinations that leave the origin or manifest scope', () => {
  const config = domain.resolve(location('app.example.com'), {
    'app.example.com': {
      pwa: { basePath: '/app/', scope: './' },
      shortcuts: [
        { name: 'Inside', url: './today/' },
        { name: 'Outside scope', url: '/admin/' },
        { name: 'External', url: 'https://attacker.invalid/' },
      ],
    },
  });
  const manifest = domain.manifest(config);
  assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.name), ['Inside']);
});

test('applies per-domain feature flags to generated manifests', () => {
  const config = domain.resolve(location('app.example.com'), {
    'app.example.com': { features: { sharing: false, installation: false } },
  });
  const manifest = domain.manifest(config);
  assert.equal(Object.hasOwn(manifest, 'share_target'), false);
  assert.equal(manifest.display, 'browser');
  assert.equal(config.features.push, true);
  assert.equal(config.features.qr, true);
});

test('creates a domain-relative manifest with isolated identity and scope', () => {
  const config = domain.resolve(location('app.example.com', { pathname: '/app/' }), {
    'app.example.com': {
      identity: { name: 'App Workspace', shortName: 'App', description: 'Scoped app.' },
      pwa: { id: './', startUrl: './?launch=home', scope: './', basePath: '/app/' },
    },
  });
  const manifest = domain.manifest(config);
  assert.equal(manifest.name, 'App Workspace');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './?launch=home');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.share_target.action, '/app/share-target');
  assert.equal(manifest.icons.length, 4);
});

/* ------------------------------------------------------------------ *
 * Audit regression (2026-11): navigation targets carried by push
 * payloads and host markup must be validated by the classic resolver
 * too, because the service worker imports this file, not the SDK.
 * ------------------------------------------------------------------ */

test('safeNavigationUrl keeps in-app paths and http(s), rejects the rest', () => {
  assert.equal(typeof domain.safeNavigationUrl, 'function', 'the classic surface exposes the guard');

  assert.equal(domain.safeNavigationUrl('/inbox?x=1'), '/inbox?x=1');
  assert.equal(domain.safeNavigationUrl('settings/notifications'), 'settings/notifications');
  assert.equal(domain.safeNavigationUrl('#top'), '#top');
  assert.equal(
    domain.safeNavigationUrl('https://app.example.test/deep/link'),
    'https://app.example.test/deep/link',
  );
  assert.equal(domain.safeNavigationUrl('http://localhost:5173/'), 'http://localhost:5173/');
});

test('safeNavigationUrl cannot be walked into a script or another origin', () => {
  const hostile = [
    'javascript:alert(1)',
    '   JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example/pwn',
    '  //evil.example',
    '\\evil.example\\pwn',
    '/\\evil.example',
    'mailto:someone@example.test',
  ];
  for (const value of hostile) {
    assert.equal(domain.safeNavigationUrl(value, '/'), '/', `${JSON.stringify(value)} must fall back`);
    assert.equal(domain.safeNavigationUrl(value, '/home'), '/home', 'an explicit fallback is honoured');
  }
});

test('safeNavigationUrl treats blank and non-string input as "no target"', () => {
  for (const value of [null, undefined, '', '   ', 42, {}, [], true]) {
    assert.equal(domain.safeNavigationUrl(value, '/home'), '/home');
  }
  // Called with no fallback at all, the guard still yields a usable in-app URL.
  assert.equal(domain.safeNavigationUrl('javascript:alert(1)'), '/');
});
