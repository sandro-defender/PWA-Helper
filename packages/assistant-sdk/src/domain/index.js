/*!
 * @youge/assistant-sdk/domain — domain resolution and manifest validation
 * ------------------------------------------------------------------------
 * Hostname detection is public configuration input only, never authentication.
 * Unknown or unlisted domains always receive neutral, same-origin defaults.
 */

import { clone, merge, safeRelativeUrl } from '../core/sanitize.js';

export const DOMAIN_DEFAULTS = {
  identity: {
    name: 'You.Ge Assistant',
    shortName: 'You.Ge',
    description: 'Your installable, offline-ready web assistant.',
  },
  branding: {
    themeColor: '#155eef',
    backgroundColor: '#f8fafc',
    iconSet: 'default',
    icon: 'icons/icon-192.png',
    appleTouchIcon: 'icons/apple-touch-icon.png',
    splashIcon: 'icons/icon-512.png',
    favicon: 'icons/favicon-32.png',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  pwa: {
    enabled: true,
    startUrl: './?launchedfrom=homescreen',
    scope: './',
    display: 'standalone',
    id: './',
  },
  features: {
    installation: true,
    offline: true,
    sharing: true,
    push: true,
    badges: true,
    qr: true,
    diagnostics: true,
    dnsRecovery: true,
  },
  instructions: {},
  metadata: {},
};

const KNOWN_COMPOUND_SUFFIXES = {
  'co.uk': true, 'org.uk': true, 'ac.uk': true, 'gov.uk': true,
  'com.au': true, 'net.au': true, 'org.au': true,
  'co.nz': true, 'com.br': true, 'com.cn': true, 'com.sg': true,
  'co.jp': true, 'co.in': true, 'com.tr': true, 'com.mx': true,
};

const VALID_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
const VALID_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const META_KEYS = {
  'og:title': true, 'og:description': true, 'og:image': true, 'og:type': true,
  'og:site_name': true, 'og:url': true, 'twitter:card': true, 'twitter:title': true,
  'twitter:description': true, 'twitter:image': true,
};

export function normalizeHost(value) {
  const hostname = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (hostname.charAt(0) === '[' && hostname.charAt(hostname.length - 1) === ']') return hostname;
  return hostname;
}

export function isIpAddress(hostname) {
  if (hostname.indexOf(':') !== -1) return true;
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

export function rootDomain(hostname) {
  const host = normalizeHost(hostname);
  if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  const count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
  return labels.length <= count ? host : labels.slice(-count).join('.');
}

export function normalizePath(value, fallback) {
  const path = String(value || fallback || '/').trim();
  if (!path || path.charAt(0) !== '/') return null;
  if (path.indexOf('\\') !== -1 || /[\u0000-\u001f]/.test(path)) return null;
  const normalized = path.replace(/\/+/g, '/');
  const parts = normalized.split('/');
  if (parts.some(function (part) {
    try {
      const decoded = decodeURIComponent(part);
      return decoded === '.' || decoded === '..' || decoded.indexOf('/') !== -1 || decoded.indexOf(String.fromCharCode(92)) !== -1;
    } catch (error) {
      return true;
    }
  })) return null;
  return normalized.charAt(normalized.length - 1) === '/' ? normalized : normalized + '/';
}

const NAVIGATION_SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Validate a navigation target that came from page markup or a push payload.
 *
 * Push payloads and host attributes are data, not instructions: this keeps only
 * http(s) absolute URLs and root/relative paths, and rejects script-capable
 * schemes (`javascript:`, `data:`, `blob:`, `filesystem:`), control characters
 * that URL parsers strip (`javascript\u0000:`), and network-path forms such as
 * `//evil.example` or `\evil.example`. Anything unsafe yields the fallback.
 */
export function safeNavigationUrl(value, fallback) {
  const safeFallback = typeof fallback === 'string' && fallback ? fallback : '/';
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return safeFallback;
  const scheme = NAVIGATION_SCHEME.exec(raw);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    return name === 'http' || name === 'https' ? raw : safeFallback;
  }
  const authority = raw.split(/[?#]/)[0];
  if (authority.indexOf('\\') !== -1) return safeFallback;
  if (raw.charAt(0) === '/' && raw.charAt(1) === '/') return safeFallback;
  return raw;
}

export function validateDomainConfig(raw) {
  const safeInput = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const config = merge(clone(DOMAIN_DEFAULTS), {
    identity: safeInput.identity,
    branding: safeInput.branding,
    pwa: safeInput.pwa,
    features: safeInput.features,
    instructions: safeInput.instructions,
    metadata: safeInput.metadata,
    shortcuts: safeInput.shortcuts,
    diagnostics: safeInput.diagnostics,
  });

  if (typeof config.identity.name !== 'string' || !config.identity.name.trim()) {
    config.identity.name = DOMAIN_DEFAULTS.identity.name;
  }
  if (typeof config.identity.shortName !== 'string' || !config.identity.shortName.trim()) {
    config.identity.shortName = DOMAIN_DEFAULTS.identity.shortName;
  }
  if (typeof config.identity.description !== 'string') {
    config.identity.description = DOMAIN_DEFAULTS.identity.description;
  }

  const safeMetadata = {};
  if (config.metadata && typeof config.metadata === 'object' && !Array.isArray(config.metadata)) {
    Object.keys(config.metadata).forEach(function (key) {
      const value = config.metadata[key];
      if (META_KEYS[key.toLowerCase()] && typeof value === 'string') {
        safeMetadata[key.toLowerCase()] = value.replace(/[\u0000-\u001f]/g, '').slice(0, 512);
      }
    });
  }
  config.metadata = safeMetadata;

  if (config.pwa.basePath != null) config.pwa.basePath = normalizePath(config.pwa.basePath, '/') || null;
  if (!VALID_COLOR.test(String(config.branding.themeColor))) config.branding.themeColor = DOMAIN_DEFAULTS.branding.themeColor;
  if (!VALID_COLOR.test(String(config.branding.backgroundColor))) config.branding.backgroundColor = DOMAIN_DEFAULTS.branding.backgroundColor;

  config.pwa.scope = String(config.pwa.scope || './');
  if (config.pwa.scope.charAt(0) === '/') config.pwa.scope = normalizePath(config.pwa.scope, '/') || './';
  else if (!/^\.{1,2}\/?$/.test(config.pwa.scope) || config.pwa.scope.indexOf('..') !== -1) config.pwa.scope = './';

  config.pwa.startUrl = String(config.pwa.startUrl || './');
  config.pwa.id = String(config.pwa.id || './');
  if (!safeRelativeUrl(config.pwa.startUrl)) config.pwa.startUrl = './';
  if (!safeRelativeUrl(config.pwa.id)) config.pwa.id = './';

  ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
    if (typeof config.branding[key] !== 'string' || !safeRelativeUrl(config.branding[key]) || /^\s*(?:javascript|data|blob):/i.test(config.branding[key])) {
      config.branding[key] = DOMAIN_DEFAULTS.branding[key];
    }
  });

  if (!/^(standalone|fullscreen|minimal-ui|browser)$/.test(config.pwa.display)) config.pwa.display = 'standalone';
  if (!Array.isArray(config.branding.icons) || !config.branding.icons.length) {
    config.branding.icons = clone(DOMAIN_DEFAULTS.branding.icons);
  }
  config.branding.icons = config.branding.icons.filter(function (icon) {
    return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) &&
      !/^\s*(?:javascript|data|blob):/i.test(icon.src) &&
      typeof icon.sizes === 'string' && /^\d+x\d+(?:\s+\d+x\d+)*$/.test(icon.sizes);
  });
  if (!config.branding.icons.length) config.branding.icons = clone(DOMAIN_DEFAULTS.branding.icons);

  config.shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(function (shortcut) {
    return shortcut && typeof shortcut.name === 'string' && shortcut.name.trim() &&
      typeof shortcut.url === 'string' && safeRelativeUrl(shortcut.url);
  }).map(function (shortcut) {
    const safe = { name: shortcut.name, url: shortcut.url };
    if (typeof shortcut.short_name === 'string') safe.short_name = shortcut.short_name;
    if (typeof shortcut.description === 'string') safe.description = shortcut.description;
    if (Array.isArray(shortcut.icons)) {
      safe.icons = shortcut.icons.filter(function (icon) {
        return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) && typeof icon.sizes === 'string';
      }).map(function (icon) {
        return { src: icon.src, sizes: icon.sizes, type: icon.type || 'image/png' };
      });
    }
    return safe;
  }) : [];

  config.features = merge(clone(DOMAIN_DEFAULTS.features), config.features || {});
  Object.keys(DOMAIN_DEFAULTS.features).forEach(function (key) {
    config.features[key] = config.features[key] !== false;
  });
  config.pwa.enabled = config.pwa.enabled !== false;
  return config;
}

function hostPatternMatches(pattern, hostname) {
  if (VALID_HOST.test(pattern)) return pattern === hostname ? { exact: true, specificity: pattern.length } : null;
  if (pattern.slice(0, 2) !== '*.') return null;
  const suffix = pattern.slice(2);
  if (!VALID_HOST.test(suffix) || hostname === suffix || hostname.slice(-(suffix.length + 1)) !== '.' + suffix) return null;
  return { exact: false, specificity: suffix.length };
}

function registryEntry(hostname, pathname, source) {
  if (!source || typeof source !== 'object') return null;
  const pathEntries = Object.keys(source).map(function (key) {
    const slash = key.indexOf('/');
    if (slash === -1) return null;
    const hostPattern = key.slice(0, slash).toLowerCase();
    const path = normalizePath('/' + key.slice(slash + 1), null);
    const hostMatch = hostPatternMatches(hostPattern, hostname);
    const currentPath = String(pathname || '/');
    if (!path || !hostMatch || (currentPath !== path.slice(0, -1) && !currentPath.startsWith(path))) return null;
    return { key: key, value: source[key], exact: hostMatch.exact, specificity: hostMatch.specificity, pathLength: path.length };
  }).filter(Boolean).sort(function (a, b) {
    return Number(b.exact) - Number(a.exact) || b.pathLength - a.pathLength || b.specificity - a.specificity;
  });
  const exactPathEntries = pathEntries.filter(function (entry) { return entry.exact; });
  if (exactPathEntries.length) return exactPathEntries[0];
  if (Object.prototype.hasOwnProperty.call(source, hostname) && VALID_HOST.test(hostname)) {
    return { key: hostname, value: source[hostname] };
  }
  const wildcardPathEntries = pathEntries.filter(function (entry) { return !entry.exact; });
  if (wildcardPathEntries.length) return wildcardPathEntries[0];
  const keys = Object.keys(source).filter(function (key) {
    if (key.indexOf('/') !== -1) return false;
    return Boolean(hostPatternMatches(key, hostname));
  }).sort(function (a, b) { return b.length - a.length; });
  return keys.length ? { key: keys[0], value: source[keys[0]] } : null;
}

export function resolveDomain(locationLike, optionalRegistry) {
  const defaultLocation = typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location : {};
  const location = typeof locationLike === 'string'
    ? { hostname: locationLike }
    : (locationLike || defaultLocation);

  const hostname = normalizeHost(location.hostname || 'localhost');
  let protocol = String(location.protocol || 'https:').toLowerCase();
  let origin;
  try {
    origin = location.origin || new URL(protocol + '//' + hostname).origin;
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') throw new Error('unsupported protocol');
    if (normalizeHost(parsedOrigin.hostname) !== hostname) throw new Error('origin hostname mismatch');
    origin = parsedOrigin.origin;
    protocol = parsedOrigin.protocol;
  } catch (error) {
    protocol = 'https:';
    origin = protocol + '//' + (VALID_HOST.test(hostname) ? hostname : 'localhost');
  }

  let pathname = String(location.pathname || '/');
  if (pathname.charAt(0) !== '/') pathname = '/';
  const fallbackRegistry = typeof globalThis !== 'undefined' && globalThis.YOU_GE_DOMAIN_REGISTRY
    ? globalThis.YOU_GE_DOMAIN_REGISTRY
    : {};
  const source = optionalRegistry || fallbackRegistry;
  const entry = registryEntry(hostname, pathname, source);
  const config = validateDomainConfig(entry ? entry.value : null);
  let basePath = normalizePath(config.pwa.basePath || location.basePath || '/', '/');
  if (!basePath) basePath = '/';
  const domain = rootDomain(hostname);
  const subdomain = hostname === domain ? '' : hostname.slice(0, -(domain.length + 1));

  config.domain = {
    hostname: hostname,
    origin: origin,
    protocol: protocol,
    subdomain: subdomain,
    rootDomain: domain,
    pathname: pathname,
    basePath: basePath,
    installOrigin: origin,
    matchedRegistryKey: entry ? entry.key : null,
    configured: Boolean(entry),
  };
  return config;
}

export function buildManifest(config) {
  const resolved = config || resolveDomain();
  const pwa = resolved.pwa;
  const branding = resolved.branding;
  const manifestBase = new URL('manifest.webmanifest', new URL(resolved.domain.basePath, resolved.domain.origin));
  const appScope = new URL(pwa.scope, manifestBase);
  const shortcuts = (resolved.shortcuts || []).filter(function (shortcut) {
    try {
      const destination = new URL(shortcut.url, manifestBase);
      return destination.origin === appScope.origin && destination.pathname.startsWith(appScope.pathname);
    } catch (error) {
      return false;
    }
  });
  const output = {
    id: pwa.id,
    name: resolved.identity.name,
    short_name: resolved.identity.shortName,
    description: resolved.identity.description,
    start_url: pwa.startUrl,
    scope: pwa.scope,
    display: resolved.pwa.enabled === false || resolved.features.installation === false ? 'browser' : pwa.display,
    theme_color: branding.themeColor,
    background_color: branding.backgroundColor,
    dir: 'auto',
    icons: clone(branding.icons),
    categories: ['utilities', 'productivity'],
    prefer_related_applications: false,
    shortcuts: clone(shortcuts),
    share_target: {
      action: new URL('share-target', new URL(resolved.domain.basePath, resolved.domain.origin)).pathname,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [{ name: 'file', accept: ['image/*', 'video/*', 'audio/*', 'text/plain', 'application/pdf'] }],
      },
    },
  };
  if (resolved.features.sharing === false) delete output.share_target;
  return output;
}

export function createDomainResolver(initialRegistry) {
  let registry = initialRegistry && typeof initialRegistry === 'object' ? clone(initialRegistry) : {};
  return {
    defaults: clone(DOMAIN_DEFAULTS),
    resolve: function (locationLike, overrideRegistry) {
      return resolveDomain(locationLike, overrideRegistry || registry);
    },
    manifest: function (config) {
      return buildManifest(config || resolveDomain(undefined, registry));
    },
    normalizeHost: normalizeHost,
    normalizePath: normalizePath,
    rootDomain: rootDomain,
    safeNavigationUrl: safeNavigationUrl,
    validateConfig: validateDomainConfig,
    setRegistry: function (nextRegistry) {
      registry = nextRegistry && typeof nextRegistry === 'object' ? clone(nextRegistry) : {};
    },
    getRegistry: function () {
      return clone(registry);
    },
  };
}
