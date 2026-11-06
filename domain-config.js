/*!
 * domain-config.js — You.Ge Assistant domain detection and public configuration.
 * Safe to load as a classic script before pwa.js. Configure
 * globalThis.YOU_GE_DOMAIN_REGISTRY before this file when embedding the kit.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
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

  var registry = root.YOU_GE_DOMAIN_REGISTRY || {};
  var KNOWN_COMPOUND_SUFFIXES = {
    'co.uk': true, 'org.uk': true, 'ac.uk': true, 'gov.uk': true,
    'com.au': true, 'net.au': true, 'org.au': true,
    'co.nz': true, 'com.br': true, 'com.cn': true, 'com.sg': true,
    'co.jp': true, 'co.in': true, 'com.tr': true, 'com.mx': true,
  };
  var VALID_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
  var VALID_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
  var META_KEYS = {
    'og:title': true, 'og:description': true, 'og:image': true, 'og:type': true,
    'og:site_name': true, 'og:url': true, 'twitter:card': true, 'twitter:title': true,
    'twitter:description': true, 'twitter:image': true,
  };

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      var copy = {};
      Object.keys(value).forEach(function (key) { copy[key] = clone(value[key]); });
      return copy;
    }
    return value;
  }

  function merge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    Object.keys(source).forEach(function (key) {
      var value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
        merge(target[key], value);
      } else {
        target[key] = clone(value);
      }
    });
    return target;
  }

  function normalizeHost(value) {
    var hostname = String(value || '').trim().toLowerCase().replace(/\.$/, '');
    if (hostname.charAt(0) === '[' && hostname.charAt(hostname.length - 1) === ']') return hostname;
    return hostname;
  }

  function isIpAddress(hostname) {
    if (hostname.indexOf(':') !== -1) return true;
    return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  }

  function rootDomain(hostname) {
    var host = normalizeHost(hostname);
    if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
    var labels = host.split('.');
    var lastTwo = labels.slice(-2).join('.');
    var count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
    return labels.length <= count ? host : labels.slice(-count).join('.');
  }

  function normalizePath(value, fallback) {
    var path = String(value || fallback || '/').trim();
    if (!path || path.charAt(0) !== '/') return null;
    if (path.indexOf('\\') !== -1 || /[\u0000-\u001f]/.test(path)) return null;
    var normalized = path.replace(/\/+/g, '/');
    var parts = normalized.split('/');
    if (parts.some(function (part) {
      try {
        var decoded = decodeURIComponent(part);
        return decoded === '.' || decoded === '..' || decoded.indexOf('/') !== -1 || decoded.indexOf(String.fromCharCode(92)) !== -1;
      } catch (error) { return true; }
    })) return null;
    return normalized.charAt(normalized.length - 1) === '/' ? normalized : normalized + '/';
  }

  var NAVIGATION_SCHEME = /^([a-z][a-z0-9+.-]*):/i;

  // Validate a navigation target that came from page markup or a push payload.
  // Only http(s) absolute URLs and root/relative paths survive: script-capable
  // schemes (javascript:, data:, blob:), control characters that URL parsers
  // strip, and network-path forms (//evil.example, \evil.example) fall back.
  function safeNavigationUrl(value, fallback) {
    var safeFallback = typeof fallback === 'string' && fallback ? fallback : '/';
    var raw = typeof value === 'string' ? value.trim() : '';
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return safeFallback;
    var scheme = NAVIGATION_SCHEME.exec(raw);
    if (scheme) {
      var name = scheme[1].toLowerCase();
      return name === 'http' || name === 'https' ? raw : safeFallback;
    }
    var authority = raw.split(/[?#]/)[0];
    if (authority.indexOf('\\') !== -1) return safeFallback;
    if (raw.charAt(0) === '/' && raw.charAt(1) === '/') return safeFallback;
    return raw;
  }

  function validConfig(raw) {
    var config = merge(clone(DEFAULTS), raw || {});
    if (typeof config.identity.name !== 'string' || !config.identity.name.trim()) config.identity.name = DEFAULTS.identity.name;
    if (typeof config.identity.shortName !== 'string' || !config.identity.shortName.trim()) config.identity.shortName = DEFAULTS.identity.shortName;
    if (typeof config.identity.description !== 'string') config.identity.description = DEFAULTS.identity.description;
    var safeMetadata = {};
    if (config.metadata && typeof config.metadata === 'object' && !Array.isArray(config.metadata)) {
      Object.keys(config.metadata).forEach(function (key) {
        var value = config.metadata[key];
        if (META_KEYS[key.toLowerCase()] && typeof value === 'string') {
          safeMetadata[key.toLowerCase()] = value.replace(/[\u0000-\u001f]/g, '').slice(0, 512);
        }
      });
    }
    config.metadata = safeMetadata;
    if (config.pwa.basePath != null) config.pwa.basePath = normalizePath(config.pwa.basePath, '/') || null;
    if (!VALID_COLOR.test(String(config.branding.themeColor))) config.branding.themeColor = DEFAULTS.branding.themeColor;
    if (!VALID_COLOR.test(String(config.branding.backgroundColor))) config.branding.backgroundColor = DEFAULTS.branding.backgroundColor;
    config.pwa.scope = String(config.pwa.scope || './');
    if (config.pwa.scope.charAt(0) === '/') config.pwa.scope = normalizePath(config.pwa.scope, '/') || './';
    else if (!/^\.{1,2}\/?$/.test(config.pwa.scope) || config.pwa.scope.indexOf('..') !== -1) config.pwa.scope = './';
    config.pwa.startUrl = String(config.pwa.startUrl || './');
    config.pwa.id = String(config.pwa.id || './');
    function safeRelativeUrl(value) {
      if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) return false;
      var path = value.split(/[?#]/)[0];
      try { path = decodeURIComponent(path); } catch (error) { return false; }
      return !path.split('/').some(function (part) { return part === '..'; });
    }
    if (!safeRelativeUrl(config.pwa.startUrl)) config.pwa.startUrl = './';
    if (!safeRelativeUrl(config.pwa.id)) config.pwa.id = './';
    ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
      if (typeof config.branding[key] !== 'string' || !safeRelativeUrl(config.branding[key]) || /^\s*(?:javascript|data|blob):/i.test(config.branding[key])) {
        config.branding[key] = DEFAULTS.branding[key];
      }
    });
    if (!/^(standalone|fullscreen|minimal-ui|browser)$/.test(config.pwa.display)) config.pwa.display = 'standalone';
    if (!Array.isArray(config.branding.icons) || !config.branding.icons.length) config.branding.icons = clone(DEFAULTS.branding.icons);
    config.branding.icons = config.branding.icons.filter(function (icon) {
      return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) &&
        !/^\s*(?:javascript|data|blob):/i.test(icon.src) &&
        typeof icon.sizes === 'string' && /^\d+x\d+(?:\s+\d+x\d+)*$/.test(icon.sizes);
    });
    if (!config.branding.icons.length) config.branding.icons = clone(DEFAULTS.branding.icons);
    config.shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(function (shortcut) {
      return shortcut && typeof shortcut.name === 'string' && shortcut.name.trim() &&
        typeof shortcut.url === 'string' && safeRelativeUrl(shortcut.url);
    }).map(function (shortcut) {
      var safe = { name: shortcut.name, url: shortcut.url };
      if (typeof shortcut.short_name === 'string') safe.short_name = shortcut.short_name;
      if (typeof shortcut.description === 'string') safe.description = shortcut.description;
      if (Array.isArray(shortcut.icons)) {
        safe.icons = shortcut.icons.filter(function (icon) {
          return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) && typeof icon.sizes === 'string';
        }).map(function (icon) { return { src: icon.src, sizes: icon.sizes, type: icon.type || 'image/png' }; });
      }
      return safe;
    }) : [];
    config.features = merge(clone(DEFAULTS.features), config.features || {});
    Object.keys(DEFAULTS.features).forEach(function (key) { config.features[key] = config.features[key] !== false; });
    config.pwa.enabled = config.pwa.enabled !== false;
    return config;
  }

  function hostPatternMatches(pattern, hostname) {
    if (VALID_HOST.test(pattern)) return pattern === hostname ? { exact: true, specificity: pattern.length } : null;
    if (pattern.slice(0, 2) !== '*.') return null;
    var suffix = pattern.slice(2);
    if (!VALID_HOST.test(suffix) || hostname === suffix || hostname.slice(-(suffix.length + 1)) !== '.' + suffix) return null;
    return { exact: false, specificity: suffix.length };
  }

  function registryEntry(hostname, pathname, source) {
    var pathEntries = Object.keys(source).map(function (key) {
      var slash = key.indexOf('/');
      if (slash === -1) return null;
      var hostPattern = key.slice(0, slash).toLowerCase();
      var path = normalizePath('/' + key.slice(slash + 1), null);
      var hostMatch = hostPatternMatches(hostPattern, hostname);
      var currentPath = String(pathname || '/');
      if (!path || !hostMatch || (currentPath !== path.slice(0, -1) && !currentPath.startsWith(path))) return null;
      return { key: key, value: source[key], exact: hostMatch.exact, specificity: hostMatch.specificity, pathLength: path.length };
    }).filter(Boolean).sort(function (a, b) {
      return Number(b.exact) - Number(a.exact) || b.pathLength - a.pathLength || b.specificity - a.specificity;
    });
    var exactPathEntries = pathEntries.filter(function (entry) { return entry.exact; });
    if (exactPathEntries.length) return exactPathEntries[0];
    if (Object.prototype.hasOwnProperty.call(source, hostname) && VALID_HOST.test(hostname)) {
      return { key: hostname, value: source[hostname] };
    }
    var wildcardPathEntries = pathEntries.filter(function (entry) { return !entry.exact; });
    if (wildcardPathEntries.length) return wildcardPathEntries[0];
    var keys = Object.keys(source).filter(function (key) {
      if (key.indexOf('/') !== -1) return false;
      return Boolean(hostPatternMatches(key, hostname));
    }).sort(function (a, b) { return b.length - a.length; });
    return keys.length ? { key: keys[0], value: source[keys[0]] } : null;
  }

  function resolve(locationLike, optionalRegistry) {
    var location = locationLike || (root.location || {});
    var hostname = normalizeHost(location.hostname || 'localhost');
    var protocol = String(location.protocol || 'https:').toLowerCase();
    var origin;
    try {
      origin = location.origin || new URL(protocol + '//' + hostname).origin;
      var parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') throw new Error('unsupported protocol');
      if (normalizeHost(parsedOrigin.hostname) !== hostname) throw new Error('origin hostname mismatch');
      origin = parsedOrigin.origin;
      protocol = parsedOrigin.protocol;
    } catch (error) {
      protocol = 'https:';
      origin = protocol + '//' + (VALID_HOST.test(hostname) ? hostname : 'localhost');
    }

    var pathname = String(location.pathname || '/');
    if (pathname.charAt(0) !== '/') pathname = '/';
    var source = optionalRegistry || registry;
    var entry = registryEntry(hostname, pathname, source);
    var config = validConfig(entry ? entry.value : null);
    var basePath = normalizePath(config.pwa.basePath || location.basePath || '/', '/');
    if (!basePath) basePath = '/';
    var domain = rootDomain(hostname);
    var subdomain = hostname === domain ? '' : hostname.slice(0, -(domain.length + 1));

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

  function manifest(config) {
    var resolved = config || resolve();
    var pwa = resolved.pwa;
    var branding = resolved.branding;
    var manifestBase = new URL('manifest.webmanifest', new URL(resolved.domain.basePath, resolved.domain.origin));
    var appScope = new URL(pwa.scope, manifestBase);
    var shortcuts = (resolved.shortcuts || []).filter(function (shortcut) {
      try {
        var destination = new URL(shortcut.url, manifestBase);
        return destination.origin === appScope.origin && destination.pathname.startsWith(appScope.pathname);
      } catch (error) { return false; }
    });
    var output = {
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
        params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'file', accept: ['image/*', 'video/*', 'audio/*', 'text/plain', 'application/pdf'] }] },
      },
    };
    if (resolved.features.sharing === false) delete output.share_target;
    return output;
  }

  root.YouGeDomain = {
    defaults: clone(DEFAULTS),
    resolve: resolve,
    manifest: manifest,
    normalizeHost: normalizeHost,
    normalizePath: normalizePath,
    rootDomain: rootDomain,
    safeNavigationUrl: safeNavigationUrl,
    validateConfig: validConfig,
    setRegistry: function (nextRegistry) { registry = nextRegistry && typeof nextRegistry === 'object' ? nextRegistry : {}; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
