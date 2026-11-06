/*!
 * assistant-state.js — centralized You.Ge Assistant state model
 * -------------------------------------------------------------
 * Generated from packages/assistant-sdk/src/ via scripts/sync-sdk-browser.mjs.
 * Do not edit by hand; update packages/assistant-sdk/src/ and run:
 *   npm run sync:sdk
 *
 * Single source of truth for the floating assistant widget, React/ESM adapters
 * and project-level consumers. Keeps state calculation separate from DOM
 * rendering, never calls fetch(), never registers a service worker, and never
 * polls on an interval.
 */
(function (root) {
  'use strict';

  if (!root) return;
  if (root.YouGeAssistant && root.YouGeAssistant.__state &&
      (!root.YouGeAssistant.isDestroyed || !root.YouGeAssistant.isDestroyed())) {
    return;
  }

  /* --- core/constants.js --- */

  const SDK_VERSION = '0.1.0';
  const KIT_COMPAT_VERSION = '1.0.5';
  const SCHEMA_VERSION = 1;
  const PRIORITY = { critical: 1, auth: 2, backup: 3, install: 4, info: 5 };
  Object.freeze(PRIORITY);
  const TONE = { 1: 'critical', 2: 'auth', 3: 'backup', 4: 'install', 5: 'info' };
  Object.freeze(TONE);
  const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  Object.freeze(POSITIONS);
  const THEMES = ['auto', 'light', 'dark'];
  Object.freeze(THEMES);
  const ICONS = ['install', 'diagnostics', 'recovery', 'backup', 'help', 'info', 'update', 'custom'];
  Object.freeze(ICONS);
  const EVENT_NAMES = {
    state: 'youge:state',
    action: 'youge:action',
    endpointStatus: 'youge:endpoint-status',
    sessionStatus: 'youge:session-status',
    dnsResult: 'youge:dns-result',
    pwaReady: 'pwa:ready',
    pwaInstallable: 'pwa:installable',
    pwaInstalled: 'pwa:installed',
    pwaUpdate: 'pwa:update',
    pwaDiagnostics: 'pwa:diagnostics',
  };
  Object.freeze(EVENT_NAMES);
  const STORAGE_PREFIXES = {
    notices: 'youge-assistant:notices:',
    lastKnownGood: 'youge-assistant:lkg:',
  };
  Object.freeze(STORAGE_PREFIXES);

  /* --- core/sanitize.js --- */

  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  const SECRET_KEY_PATTERN = /^(?:secret|secrets|api[_-]?key|private[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|bearer|authorization|credentials|vapid[_-]?private[_-]?key|signing[_-]?key|encryption[_-]?key|cookie|token)$/i;

  const EXECUTABLE_STRING_PATTERN = /(?:^\s*(?:javascript|vbscript|data\s*:\s*text\/javascript)\s*:|<\s*script\b|\beval\s*\(|\bnew\s+Function\s*\()/i;
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const copy = {};
      Object.keys(value).forEach(function (key) {
        if (isUnsafeKey(key)) return;
        copy[key] = clone(value[key]);
      });
      return copy;
    }
    return value;
  }
  function merge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    Object.keys(source).forEach(function (key) {
      if (isUnsafeKey(key)) return;
      const value = source[key];
      if (value === undefined) return;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
        merge(target[key], value);
      } else {
        target[key] = clone(value);
      }
    });
    return target;
  }
  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }
  function safeText(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max || 120);
  }
  function safeRelativeUrl(value) {
    if (typeof value !== 'string' || !value) return false;
    if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) {
      return false;
    }
    let path = value.split(/[?#]/)[0];
    try {
      path = decodeURIComponent(path);
    } catch (error) {
      return false;
    }
    return !path.split('/').some(function (part) { return part === '..'; });
  }
  function safeSameOriginIcon(value, fallback, baseHref, UrlCtor) {
    if (!value) return fallback;
    const URLImpl = UrlCtor || URL;
    try {
      const base = new URLImpl(baseHref || 'https://localhost/');
      const url = new URLImpl(String(value), base);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
      if (url.origin !== base.origin) return fallback;
      return url.pathname + url.search;
    } catch (error) {
      return fallback;
    }
  }
  function isSecretKey(key) {
    return SECRET_KEY_PATTERN.test(String(key || '').trim());
  }
  function isExecutableString(value) {
    return typeof value === 'string' && EXECUTABLE_STRING_PATTERN.test(value);
  }
  function inspectConfigSafety(value, options) {
    const opts = options || {};
    const allowServiceFunctions = Boolean(opts.allowServiceFunctions);
    const report = {
      hasFunction: false,
      hasExecutableString: false,
      secretKeys: [],
    };

    function visit(node, path, depth) {
      if (depth > 12 || node == null) return;
      if (typeof node === 'function') {
        if (allowServiceFunctions && path === 'services.diagnostics') return;
        report.hasFunction = true;
        return;
      }
      if (typeof node === 'string') {
        if (isExecutableString(node)) report.hasExecutableString = true;
        return;
      }
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) {
          visit(node[i], path + '[' + i + ']', depth + 1);
        }
        return;
      }
      if (typeof node === 'object') {
        const keys = Object.keys(node);
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (isUnsafeKey(key)) continue;
          if (isSecretKey(key)) {
            report.secretKeys.push(path ? path + '.' + key : key);
          }
          visit(node[key], path ? path + '.' + key : key, depth + 1);
        }
      }
    }

    visit(value, '', 0);
    return report;
  }
  function sanitizePlainData(value, depth) {
    const level = depth || 0;
    if (level > 12 || value == null) return null;
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (typeof value === 'string') {
      return isExecutableString(value) ? '' : value;
    }
    if (typeof value === 'number') {
      return isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      return value
        .map(function (item) { return sanitizePlainData(item, level + 1); })
        .filter(function (item) { return item !== undefined; });
    }
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach(function (key) {
        if (isUnsafeKey(key) || isSecretKey(key)) return;
        const cleaned = sanitizePlainData(value[key], level + 1);
        if (cleaned !== undefined) out[key] = cleaned;
      });
      return out;
    }
    return undefined;
  }

  /* --- domain/index.js --- */

  const DOMAIN_DEFAULTS = {
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
  function normalizeHost(value) {
    const hostname = String(value || '').trim().toLowerCase().replace(/\.$/, '');
    if (hostname.charAt(0) === '[' && hostname.charAt(hostname.length - 1) === ']') return hostname;
    return hostname;
  }
  function isIpAddress(hostname) {
    if (hostname.indexOf(':') !== -1) return true;
    return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  }
  function rootDomain(hostname) {
    const host = normalizeHost(hostname);
    if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
    const labels = host.split('.');
    const lastTwo = labels.slice(-2).join('.');
    const count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
    return labels.length <= count ? host : labels.slice(-count).join('.');
  }
  function normalizePath(value, fallback) {
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
  function safeNavigationUrl(value, fallback) {
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
  function validateDomainConfig(raw) {
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
  function resolveDomain(locationLike, optionalRegistry) {
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
  function buildManifest(config) {
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
  function createDomainResolver(initialRegistry) {
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

  /* --- config/index.js --- */

  const BUNDLED_DEFAULTS = {
    enabled: true,
    projectId: '',
    domain: '',
    position: 'bottom-right',
    offsets: { x: 20, y: 20 },
    modules: {
      installation: true,
      diagnostics: true,
      recovery: true,
      failover: true,
      help: true,
      updates: true,
    },
    notifications: {
      dismissible: true,
      suppressRepeats: true,
      criticalPersistent: true,
    },
    branding: {
      name: '',
      shortName: '',
      icon: '',
      themeColor: '',
    },
    actions: [],
    features: [],
    theme: 'auto',
  };
  function normalizeActions(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.slice(0, 20).map(function (entry) {
      if (!entry || typeof entry !== 'object') return null;
      if (isExecutableString(entry.id) || isExecutableString(entry.label) || isExecutableString(entry.message)) return null;
      const id = safeText(entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id: id,
        label: safeText(entry.label, 60) || id,
        message: safeText(entry.message, 200),
        icon: ICONS.indexOf(entry.icon) !== -1 ? entry.icon : 'custom',
        priority: clampNumber(entry.priority, PRIORITY.info, 1, 5),
        kind: entry.kind === 'help' ? 'help' : 'custom',
        event: 'youge:action',
      };
    }).filter(Boolean);
  }
  function normalizeFeatures(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.slice(0, 20).map(function (entry) {
      if (!entry || typeof entry !== 'object') return null;
      if (isExecutableString(entry.id) || isExecutableString(entry.label) || isExecutableString(entry.message)) return null;
      const id = safeText(entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id: id,
        label: safeText(entry.label, 60) || id,
        message: safeText(entry.message, 200),
      };
    }).filter(Boolean);
  }

  function parseSchemaMajor(version) {
    if (version === undefined || version === null) return SCHEMA_VERSION;
    if (typeof version === 'number') {
      return Number.isInteger(version) ? version : -1;
    }
    if (typeof version === 'string') {
      const match = /^(\d+)(?:\.\d+){0,2}$/.exec(version.trim());
      return match ? Number(match[1]) : -1;
    }
    return -1;
  }

  function extractLayerOverrides(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};

    if (source.enabled !== undefined) out.enabled = source.enabled !== false;
    if (source.projectId !== undefined) out.projectId = safeText(source.projectId, 80);
    if (typeof source.domain === 'string') out.domain = safeText(source.domain, 253);
    if (source.position !== undefined && POSITIONS.indexOf(source.position) !== -1) {
      out.position = source.position;
    }
    if (source.offsets && typeof source.offsets === 'object') {
      out.offsets = {};
      if (source.offsets.x !== undefined) out.offsets.x = clampNumber(source.offsets.x, BUNDLED_DEFAULTS.offsets.x, 0, 160);
      if (source.offsets.y !== undefined) out.offsets.y = clampNumber(source.offsets.y, BUNDLED_DEFAULTS.offsets.y, 0, 160);
    }
    if (source.modules && typeof source.modules === 'object') {
      out.modules = {};
      Object.keys(BUNDLED_DEFAULTS.modules).forEach(function (key) {
        if (source.modules[key] !== undefined) out.modules[key] = source.modules[key] !== false;
      });
    }
    if (source.notifications && typeof source.notifications === 'object') {
      out.notifications = {};
      if (source.notifications.dismissible !== undefined) {
        out.notifications.dismissible = source.notifications.dismissible !== false;
      }
      if (source.notifications.suppressRepeats !== undefined) {
        out.notifications.suppressRepeats = source.notifications.suppressRepeats !== false;
      }
      if (source.notifications.criticalPersistent !== undefined) {
        out.notifications.criticalPersistent = source.notifications.criticalPersistent !== false;
      }
    }
    if (source.branding && typeof source.branding === 'object') {
      out.branding = {};
      if (source.branding.name !== undefined) out.branding.name = safeText(source.branding.name, 80);
      if (source.branding.shortName !== undefined) out.branding.shortName = safeText(source.branding.shortName, 40);
      if (source.branding.icon !== undefined) {
        const iconStr = String(source.branding.icon || '');
        out.branding.icon = isExecutableString(iconStr) || /^\s*(?:javascript|data|blob):/i.test(iconStr)
          ? ''
          : safeText(iconStr, 200);
      }
      if (source.branding.themeColor !== undefined) {
        out.branding.themeColor = /^#[0-9a-f]{3,8}$/i.test(source.branding.themeColor || '')
          ? source.branding.themeColor
          : '';
      }
    }
    if (Array.isArray(source.actions)) out.actions = normalizeActions(source.actions);
    if (Array.isArray(source.features)) out.features = normalizeFeatures(source.features);
    if (source.theme !== undefined && THEMES.indexOf(source.theme) !== -1) {
      out.theme = source.theme;
    }
    if (source.domainRegistry && typeof source.domainRegistry === 'object' && !Array.isArray(source.domainRegistry)) {
      out.domainRegistry = sanitizePlainData(source.domainRegistry);
    }
    return out;
  }

  function applyLayer(base, layer) {
    if (!layer || typeof layer !== 'object') return base;
    if (layer.enabled !== undefined) base.enabled = layer.enabled;
    if (layer.projectId) base.projectId = layer.projectId;
    if (layer.domain) base.domain = layer.domain;
    if (layer.position) base.position = layer.position;
    if (layer.offsets) {
      if (layer.offsets.x !== undefined) base.offsets.x = layer.offsets.x;
      if (layer.offsets.y !== undefined) base.offsets.y = layer.offsets.y;
    }
    if (layer.modules) {
      Object.keys(layer.modules).forEach(function (key) {
        base.modules[key] = layer.modules[key];
      });
    }
    if (layer.notifications) {
      Object.keys(layer.notifications).forEach(function (key) {
        base.notifications[key] = layer.notifications[key];
      });
    }
    if (layer.branding) {
      Object.keys(layer.branding).forEach(function (key) {
        if (layer.branding[key] !== undefined) base.branding[key] = layer.branding[key];
      });
    }
    if (layer.actions !== undefined) base.actions = clone(layer.actions);
    if (layer.features !== undefined) base.features = clone(layer.features);
    if (layer.theme) base.theme = layer.theme;
    if (layer.domainRegistry) base.domainRegistry = clone(layer.domainRegistry);
    return base;
  }
  function validatePublishedConfig(rawInput, options) {
    const opts = options || {};
    let parsed = rawInput;
    if (typeof rawInput === 'string') {
      try {
        parsed = JSON.parse(rawInput);
      } catch (error) {
        return { valid: false, reason: 'invalid_json', warnings: ['invalid_json'] };
      }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, reason: 'invalid_object', warnings: ['invalid_object'] };
    }

    const safety = inspectConfigSafety(parsed, { allowServiceFunctions: false });
    if (safety.hasFunction) {
      return { valid: false, reason: 'executable_function_rejected', warnings: ['executable_function_rejected'] };
    }
    if (safety.hasExecutableString) {
      return { valid: false, reason: 'executable_code_rejected', warnings: ['executable_code_rejected'] };
    }
    if (safety.secretKeys.length > 0) {
      return {
        valid: false,
        reason: 'secret_fields_rejected',
        secretKeys: safety.secretKeys,
        warnings: ['secret_fields_rejected'],
      };
    }

    const major = parseSchemaMajor(parsed.schemaVersion);
    if (major !== SCHEMA_VERSION) {
      return { valid: false, reason: 'unsupported_schema_version', warnings: ['unsupported_schema_version'] };
    }

    const expectedProjectId = safeText(opts.expectedProjectId || '', 80);
    const declaredProjectId = safeText(parsed.projectId || '', 80);
    if (expectedProjectId && declaredProjectId && expectedProjectId !== declaredProjectId) {
      return { valid: false, reason: 'project_id_mismatch', warnings: ['project_id_mismatch'] };
    }

    const payload = parsed.config && typeof parsed.config === 'object' && !Array.isArray(parsed.config)
      ? Object.assign({}, parsed.config, declaredProjectId ? { projectId: declaredProjectId } : {})
      : parsed;

    return {
      valid: true,
      schemaVersion: SCHEMA_VERSION,
      revision: safeText(parsed.revision || '', 60),
      publishedAt: safeText(parsed.publishedAt || '', 60),
      projectId: declaredProjectId || expectedProjectId,
      config: extractLayerOverrides(payload),
      warnings: [],
    };
  }
  function lkgStorageKey(projectId) {
    return STORAGE_PREFIXES.lastKnownGood + safeText(projectId || 'default', 80);
  }
  function loadLastKnownGood(storage, projectId) {
    const id = safeText(projectId || '', 80);
    if (!storage || !id || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(lkgStorageKey(id));
      if (!raw) return null;
      let record = null;
      try {
        record = JSON.parse(raw);
      } catch (error) {
        return null;
      }
      // A stored recovery record must declare the project it belongs to. Without
      // this, a blob written under this key with no `projectId` would skip the
      // mismatch check and be trusted as this project's last-known-good config.
      if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
      if (safeText(record.projectId || '', 80) !== id) return null;
      const validated = validatePublishedConfig(raw, { expectedProjectId: id });
      return validated.valid ? validated : null;
    } catch (error) {
      return null;
    }
  }
  function saveLastKnownGood(storage, projectId, validatedRecord) {
    const id = safeText(projectId || (validatedRecord && validatedRecord.projectId) || '', 80);
    if (!storage || !id || !validatedRecord || !validatedRecord.valid || typeof storage.setItem !== 'function') {
      return false;
    }
    try {
      const record = {
        schemaVersion: SCHEMA_VERSION,
        revision: validatedRecord.revision || '',
        publishedAt: validatedRecord.publishedAt || '',
        projectId: id,
        config: sanitizePlainData(validatedRecord.config || {}),
      };
      storage.setItem(lkgStorageKey(id), JSON.stringify(record));
      return true;
    } catch (error) {
      return false;
    }
  }
  function normalizeConfig(raw) {
    return resolveAssistantConfig(raw).config;
  }
  function resolveAssistantConfig(rawInput, context) {
    const ctx = context || {};
    const input = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? rawInput : {};
    const warnings = [];

    const localSafety = inspectConfigSafety(
      Object.assign({}, input, { publishedConfig: undefined }),
      { allowServiceFunctions: true }
    );
    if (localSafety.secretKeys.length > 0) warnings.push('secret_fields_stripped');
    if (localSafety.hasExecutableString) warnings.push('executable_value_stripped');
    if (localSafety.hasFunction) warnings.push('unexpected_function_ignored');

    const servicesIn = input.services && typeof input.services === 'object' ? input.services : {};
    const diagnosticsFn = typeof servicesIn.diagnostics === 'function' ? servicesIn.diagnostics : null;

    const base = clone(BUNDLED_DEFAULTS);
    base.domainRegistry = null;

    const explicitProjectId = safeText(input.projectId || '', 80);
    let source = 'defaults';
    let revision = '';
    let publishedAt = '';
    let usedLastKnownGood = false;

    if (input.publishedConfig !== undefined && input.publishedConfig !== null) {
      const validated = validatePublishedConfig(input.publishedConfig, {
        expectedProjectId: explicitProjectId,
      });
      if (validated.valid) {
        applyLayer(base, validated.config);
        source = 'published';
        revision = validated.revision;
        publishedAt = validated.publishedAt;
        const targetProject = explicitProjectId || validated.projectId || ctx.fallbackProjectId || '';
        if (targetProject && ctx.storage) {
          saveLastKnownGood(ctx.storage, targetProject, validated);
        }
      } else {
        warnings.push('published_config_rejected:' + validated.reason);
        const fallbackProject = explicitProjectId || ctx.fallbackProjectId || '';
        const lkg = input.useLastKnownGood !== false
          ? loadLastKnownGood(ctx.storage, fallbackProject)
          : null;
        if (lkg) {
          applyLayer(base, lkg.config);
          source = 'last-known-good';
          revision = lkg.revision;
          publishedAt = lkg.publishedAt;
          usedLastKnownGood = true;
        }
      }
    } else if (input.useLastKnownGood === true) {
      const lookupProject = explicitProjectId || ctx.fallbackProjectId || '';
      const lkg = loadLastKnownGood(ctx.storage, lookupProject);
      if (lkg) {
        applyLayer(base, lkg.config);
        source = 'last-known-good';
        revision = lkg.revision;
        publishedAt = lkg.publishedAt;
        usedLastKnownGood = true;
      }
    }

    const sanitizedOverrides = sanitizePlainData(Object.assign({}, input, {
      publishedConfig: undefined,
      services: undefined,
      window: undefined,
      document: undefined,
      location: undefined,
      navigator: undefined,
      storage: undefined,
      pwa: undefined,
      dns: undefined,
      domainResolver: undefined,
    })) || {};

    const overrideLayer = extractLayerOverrides(sanitizedOverrides);
    if (Object.keys(overrideLayer).length > 0 && source === 'defaults') {
      source = 'overrides';
    }
    applyLayer(base, overrideLayer);

    base.services = {
      diagnostics: diagnosticsFn,
    };

    return {
      config: base,
      meta: {
        schemaVersion: SCHEMA_VERSION,
        source: source,
        revision: revision,
        publishedAt: publishedAt,
        usedLastKnownGood: usedLastKnownGood,
        warnings: warnings,
      },
    };
  }

  /* --- diagnostics/index.js --- */

  const DNS_FAILURE_CLASSIFICATIONS = [
    'nxdomain',
    'dns_resolution_failure',
    'dns_records_missing',
    'possible_dns_interference',
    'dns_failure',
    'dns-error',
    'dns_failed',
    'missing_address_records',
    'servfail',
    'refused',
  ];

  const CONNECTIVITY_FAILURE_CLASSIFICATIONS = [
    'general_internet_failure',
    'application_host_unavailable',
    'backend_unavailable',
    'error',
    'timeout',
  ];
  function dnsFailure(dns) {
    const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
    return DNS_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1;
  }
  function connectivityFailure(dns) {
    const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
    return CONNECTIVITY_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1 || Boolean(dns && dns.failed);
  }
  function normalizeDnsResult(result, DateCtor) {
    const raw = result && typeof result === 'object' ? result : {};
    const DateImpl = DateCtor || Date;
    return {
      status: String(raw.status || 'complete'),
      classification: safeText(raw.classification || 'unknown', 60),
      message: safeText(raw.message || '', 240),
      checkedAt: raw.checkedAt ? safeText(raw.checkedAt, 60) : new DateImpl().toISOString(),
      failed: Boolean(raw.failed),
    };
  }
  function resolveDiagnosticsRunner(options) {
    const opts = options || {};
    if (opts.services && typeof opts.services.diagnostics === 'function') {
      return opts.services.diagnostics;
    }
    const pwa = typeof opts.getPwa === 'function' ? opts.getPwa() : opts.pwa;
    if (pwa && typeof pwa.runNetworkDiagnostics === 'function') {
      return function (runOptions) {
        return pwa.runNetworkDiagnostics(runOptions);
      };
    }
    const dns = typeof opts.getDns === 'function' ? opts.getDns() : opts.dns;
    if (dns && typeof dns.check === 'function') {
      return function (runOptions) {
        const ctx = typeof opts.getContext === 'function' ? opts.getContext() : (opts.context || {});
        return dns.check({
          hostname: ctx.hostname,
          origin: ctx.origin,
          basePath: ctx.basePath || '/',
          online: ctx.online !== false,
        }, runOptions);
      };
    }
    return null;
  }
  function createDiagnosticsIntegration(options) {
    const opts = options || {};
    let inFlight = null;

    function run(runOptions) {
      if (inFlight) return inFlight;
      const runner = resolveDiagnosticsRunner(opts);
      if (!runner) {
        const unavailable = {
          classification: 'unknown',
          message: 'Network diagnostics are not available on this page.',
          status: 'unavailable',
        };
        if (typeof opts.onResult === 'function') opts.onResult(unavailable);
        return Promise.resolve(unavailable);
      }

      if (typeof opts.onStart === 'function') opts.onStart();
      inFlight = Promise.resolve()
        .then(function () { return runner(runOptions); })
        .then(function (result) {
          const safeResult = result && typeof result === 'object' ? result : {};
          if (typeof opts.onResult === 'function') opts.onResult(safeResult);
          return safeResult;
        })
        .catch(function (error) {
          const failed = {
            classification: 'error',
            message: safeText(error && error.message, 200) || 'Diagnostics failed.',
            status: 'error',
            failed: true,
          };
          if (typeof opts.onResult === 'function') opts.onResult(failed);
          return failed;
        })
        .then(function (finalResult) {
          inFlight = null;
          return finalResult;
        });
      return inFlight;
    }

    function clear() {
      inFlight = null;
    }

    return {
      run: run,
      clear: clear,
      isRunning: function () { return Boolean(inFlight); },
    };
  }

  /* --- installation/index.js --- */

  function readPwaSnapshot(pwa) {
    let state = {};
    if (!pwa) return state;
    try {
      if (typeof pwa.getState === 'function') state = pwa.getState() || {};
    } catch (error) {
      state = {};
    }
    return state;
  }
  function deriveInstallationState(options) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    const moduleEnabled = opts.enabled !== false;
    const state = readPwaSnapshot(pwa);

    let installed = Boolean(state.installed || state.standalone);
    let canInstall = Boolean(state.canInstall);
    let ios = Boolean(state.ios);
    let safari = Boolean(state.safari);

    try { if (!installed && pwa && typeof pwa.isInstalled === 'function') installed = Boolean(pwa.isInstalled()); } catch (error) { /* ignore */ }
    try { if (!canInstall && pwa && typeof pwa.canInstall === 'function') canInstall = Boolean(pwa.canInstall()); } catch (error) { /* ignore */ }
    try { if (!ios && pwa && typeof pwa.isIOS === 'function') ios = Boolean(pwa.isIOS()); } catch (error) { /* ignore */ }
    try { if (!safari && pwa && typeof pwa.isSafari === 'function') safari = Boolean(pwa.isSafari()); } catch (error) { /* ignore */ }

    const pwaFeatureAllowed = !pwa || !pwa.config || !pwa.config.features || pwa.config.features.installation !== false;
    const enabled = Boolean(moduleEnabled && pwa && pwaFeatureAllowed);

    let support = 'none';
    if (enabled) {
      if (installed) support = 'installed';
      else if (canInstall) support = 'native';
      else if (ios && safari) support = 'manual-ios';
      else support = 'manual-generic';
    }

    return {
      support: support,
      status: installed ? 'installed' : (support === 'none' ? 'unavailable' : 'available'),
      canInstall: canInstall,
      installed: installed,
      standalone: Boolean(state.standalone),
      ios: ios,
      safari: safari,
      platform: ios ? 'ios' : (canInstall ? 'chromium' : 'generic'),
      nativeAvailable: canInstall,
    };
  }
  function requestPwaInstall(options, promptOptions) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (opts.enabled === false || !pwa || typeof pwa.promptInstall !== 'function') {
      return Promise.resolve({ outcome: 'unsupported' });
    }
    try {
      return Promise.resolve(pwa.promptInstall(promptOptions));
    } catch (error) {
      return Promise.resolve({ outcome: 'error' });
    }
  }

  /* --- assistant/index.js --- */

  function createAssistant(initialOptions, envOverrides) {
    const rawInit = initialOptions && typeof initialOptions === 'object' ? initialOptions : {};
    const envIn = Object.assign(
      {},
      rawInit.env && typeof rawInit.env === 'object' ? rawInit.env : {},
      envOverrides && typeof envOverrides === 'object' ? envOverrides : {}
    );

    const defaultRoot = typeof globalThis !== 'undefined' ? globalThis : {};
    const root = envIn.root || envIn.window || rawInit.window || defaultRoot;
    const useGlobalConfig = Boolean(envIn.useGlobalConfig);
    const exposeGlobal = Boolean(envIn.exposeGlobal || rawInit.exposeGlobal);
    const shouldBindEvents = envIn.bindEvents !== false && rawInit.bindEvents !== false;

    const UrlCtor = root.URL || URL;
    const DateCtor = root.Date || Date;

    function getDoc() {
      if (envIn.document !== undefined) return envIn.document;
      if (rawInit.document !== undefined) return rawInit.document;
      return root.document || null;
    }

    function getStorage() {
      if (envIn.storage !== undefined) return envIn.storage;
      if (rawInit.storage !== undefined) return rawInit.storage;
      try {
        return root.localStorage || null;
      } catch (error) {
        return null;
      }
    }

    function getLocation() {
      if (envIn.location !== undefined) return envIn.location;
      if (rawInit.location !== undefined) return rawInit.location;
      return root.location || {};
    }

    function getNavigator() {
      if (envIn.navigator !== undefined) return envIn.navigator;
      if (rawInit.navigator !== undefined) return rawInit.navigator;
      return root.navigator || null;
    }

    function getPwa() {
      if (envIn.pwa !== undefined) return envIn.pwa;
      if (rawInit.pwa !== undefined) return rawInit.pwa;
      return root.PWA || null;
    }

    function getDns() {
      if (envIn.dns !== undefined) return envIn.dns;
      if (rawInit.dns !== undefined) return rawInit.dns;
      return root.YouGeDns || null;
    }

    let rawOptionsState = Object.assign(
      {},
      useGlobalConfig && root.YOU_GE_ASSISTANT_CONFIG && typeof root.YOU_GE_ASSISTANT_CONFIG === 'object'
        ? root.YOU_GE_ASSISTANT_CONFIG
        : {},
      rawInit
    );

    let resolvedBundle = resolveAssistantConfig(rawOptionsState, {
      storage: getStorage(),
    });
    let config = resolvedBundle.config;
    let configMeta = resolvedBundle.meta;
    let services = config.services;

    const listeners = new Set();
    const listenerCounts = new Map();
    let noticeStore = { dismissed: {}, acknowledged: {} };
    let snapshot = null;
    let bound = false;
    let destroyed = false;
    let unsubscribePwa = null;
    let lastConditionKeys = new Set();

    const nav = getNavigator();
    const conditions = {
      online: nav ? nav.onLine !== false : true,
      dns: { status: 'idle', classification: 'unknown', message: '', checkedAt: null },
      endpoints: { primary: 'unknown', backup: 'inactive', active: 'primary', reason: '' },
      session: { state: 'unknown', message: '' },
      updateAvailable: false,
      recovery: false,
    };

    function effectiveLocation() {
      const loc = getLocation() || {};
      if (config.domain) {
        const explicitHost = String(config.domain).trim();
        const locHost = String(loc.hostname || '').trim().toLowerCase();
        const sameHost = locHost && locHost === explicitHost.toLowerCase();
        return {
          hostname: explicitHost,
          origin: sameHost ? loc.origin : undefined,
          protocol: loc.protocol || 'https:',
          pathname: loc.pathname || '/',
          basePath: loc.basePath || loc.pathname || '/',
        };
      }
      return {
        hostname: loc.hostname,
        origin: loc.origin,
        protocol: loc.protocol,
        pathname: loc.pathname,
        basePath: loc.basePath || loc.pathname || '/',
      };
    }

    function domainContext() {
      const loc = effectiveLocation();
      const fallback = {
        identity: { name: 'You.Ge Assistant', shortName: 'You.Ge', description: '' },
        branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
        pwa: { basePath: '/' },
        domain: {
          hostname: loc.hostname || 'localhost',
          origin: loc.origin || 'https://localhost',
          protocol: loc.protocol || 'https:',
          pathname: loc.pathname || '/',
          basePath: '/',
          configured: false,
        },
        features: { installation: true, diagnostics: true },
      };

      const explicitRegistry = config.domainRegistry || envIn.domainRegistry || rawOptionsState.domainRegistry || null;
      if (explicitRegistry) {
        try {
          return resolveDomain(loc, explicitRegistry) || fallback;
        } catch (error) {
          return fallback;
        }
      }

      const resolver = envIn.domainResolver || rawOptionsState.domainResolver || root.YouGeDomain || null;
      if (resolver && typeof resolver.resolve === 'function') {
        try {
          const resolved = resolver.resolve(loc);
          return resolved || fallback;
        } catch (error) {
          return fallback;
        }
      }

      try {
        const globalRegistry = root.YOU_GE_DOMAIN_REGISTRY && typeof root.YOU_GE_DOMAIN_REGISTRY === 'object'
          ? root.YOU_GE_DOMAIN_REGISTRY
          : {};
        return resolveDomain(loc, globalRegistry) || fallback;
      } catch (error) {
        return fallback;
      }
    }

    function projectInfo() {
      const domain = domainContext();
      const host = domain.domain || {};
      const basePath = domain.pwa && domain.pwa.basePath ? domain.pwa.basePath : (host.basePath || '/');
      const identity = domain.identity || {};
      const branding = domain.branding || {};
      const id = config.projectId || String(host.hostname || 'localhost') + String(basePath);
      const loc = getLocation() || {};
      const baseHref = config.domain
        ? String(host.origin || 'https://localhost') + String(basePath)
        : (loc.href || String(host.origin || 'https://localhost') + '/');
      return {
        id: id,
        name: config.branding.name || identity.name || 'You.Ge Assistant',
        shortName: config.branding.shortName || identity.shortName || 'You.Ge',
        icon: safeSameOriginIcon(config.branding.icon || branding.icon, 'icons/icon-192.png', baseHref, UrlCtor),
        themeColor: config.branding.themeColor || branding.themeColor || '#155eef',
        hostname: String(host.hostname || 'localhost'),
        origin: String(host.origin || 'https://localhost'),
        basePath: String(basePath),
        configured: Boolean(host.configured),
      };
    }

    function persistPublishedLkgIfDerivedProject() {
      if (configMeta.source === 'published' && !config.projectId && rawOptionsState.publishedConfig) {
        const storage = getStorage();
        if (!storage) return;
        const derivedId = projectInfo().id;
        const validated = validatePublishedConfig(rawOptionsState.publishedConfig, { expectedProjectId: '' });
        if (validated.valid && !validated.projectId) {
          saveLastKnownGood(storage, derivedId, validated);
        }
      }
    }

    function storageKey(projectId) {
      return STORAGE_PREFIXES.notices + projectId;
    }

    function loadNotices(projectId) {
      noticeStore = { dismissed: {}, acknowledged: {} };
      const storage = getStorage();
      try {
        const raw = storage && typeof storage.getItem === 'function' ? storage.getItem(storageKey(projectId)) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          noticeStore.dismissed = parsed.dismissed && typeof parsed.dismissed === 'object' ? parsed.dismissed : {};
          noticeStore.acknowledged = parsed.acknowledged && typeof parsed.acknowledged === 'object' ? parsed.acknowledged : {};
        }
      } catch (error) { /* storage unavailable */ }
    }

    function saveNotices(projectId) {
      const storage = getStorage();
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(storageKey(projectId), JSON.stringify(noticeStore));
        }
      } catch (error) { /* storage unavailable */ }
    }

    function noticeKey(projectId, id) {
      return projectId + ':' + id;
    }

    function isSuppressed(projectId, id, critical) {
      const key = noticeKey(projectId, id);
      if (config.notifications.suppressRepeats && noticeStore.dismissed[key]) return true;
      if (critical && noticeStore.acknowledged[key]) return true;
      return false;
    }

    function endpointFailure(endpoints) {
      return endpoints.primary === 'failed' || endpoints.primary === 'unavailable' || endpoints.primary === 'degraded';
    }

    function buildNotifications(project, installation, network) {
      const out = [];
      const activeKeys = new Set();

      function add(notification, conditionKey) {
        activeKeys.add(conditionKey);
        if (isSuppressed(project.id, notification.id, notification.critical)) return;
        out.push(notification);
      }

      if (!network.online) {
        add({
          id: 'network:offline', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'No connection',
          message: 'The app cannot reach the network. Open diagnostics or recovery guidance.',
          actionId: 'diagnostics',
        }, 'network:offline');
      }
      if (dnsFailure(network.dns)) {
        add({
          id: 'dns:failure', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'DNS resolution problem',
          message: network.dns.message || 'The current hostname could not be resolved. Diagnostics are available.',
          actionId: 'diagnostics',
        }, 'dns:failure');
      }
      if (network.online && connectivityFailure(network.dns)) {
        add({
          id: 'network:unreachable', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'Connection problem',
          message: network.dns.message || 'The application host or its backend did not respond.',
          actionId: 'diagnostics',
        }, 'network:unreachable');
      }
      if (endpointFailure(network.endpoints)) {
        add({
          id: 'api:primary-failed', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'Primary API unavailable',
          message: network.endpoints.reason || 'The primary application endpoint is not responding.',
          actionId: 'diagnostics',
        }, 'api:primary-failed');
      }
      if (network.session.state === 'issue') {
        add({
          id: 'session:issue', priority: PRIORITY.auth, tone: TONE[PRIORITY.auth],
          critical: false, dismissible: true, title: 'Session needs attention',
          message: network.session.message || 'Your project reported an authentication or session problem.',
          actionId: 'help',
        }, 'session:issue');
      }
      if (network.endpoints.backup === 'active' || network.endpoints.active === 'backup') {
        add({
          id: 'api:backup-active', priority: PRIORITY.backup, tone: TONE[PRIORITY.backup],
          critical: false, dismissible: true, title: 'Backup connection active',
          message: network.endpoints.reason || 'This project is using its configured backup endpoint.',
          actionId: 'backup-status',
        }, 'api:backup-active');
      }
      if (installation.status === 'available' && installation.support !== 'none') {
        add({
          id: 'install:available', priority: PRIORITY.install, tone: TONE[PRIORITY.install],
          critical: false, dismissible: true, title: 'Installation available',
          message: installation.nativeAvailable
            ? 'This browser offered a native install prompt.'
            : (installation.support === 'manual-ios'
              ? 'Add this app to your home screen from Safari.'
              : 'Use your browser menu to install this app.'),
          actionId: 'install',
        }, 'install:available');
      }
      if (network.recovery) {
        add({
          id: 'api:primary-restored', priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: 'Primary connection restored',
          message: 'The primary endpoint is healthy again.', actionId: 'diagnostics',
        }, 'api:primary-restored');
      }
      if (network.updateAvailable) {
        add({
          id: 'app:update', priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: 'App update available',
          message: 'A new version is ready to apply.', actionId: 'update',
        }, 'app:update');
      }
      config.features.forEach(function (feature) {
        add({
          id: 'feature:' + feature.id, priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: feature.label,
          message: feature.message || 'A new You.Ge Assistant capability is available.',
          actionId: 'feature:' + feature.id,
        }, 'feature:' + feature.id);
      });

      lastConditionKeys.forEach(function (key) {
        if (activeKeys.has(key)) return;
        delete noticeStore.dismissed[noticeKey(project.id, key)];
        delete noticeStore.acknowledged[noticeKey(project.id, key)];
      });
      lastConditionKeys = activeKeys;
      saveNotices(project.id);

      out.sort(function (a, b) { return a.priority - b.priority; });
      return out;
    }

    function buildActions(project, installation, network, notifications) {
      const actions = [];
      function add(action) {
        if (actions.some(function (entry) { return entry.id === action.id; })) return;
        actions.push(action);
      }
      if (config.modules.diagnostics) {
        add({
          id: 'diagnostics', label: 'Run network diagnostics', icon: 'diagnostics',
          priority: notifications.some(function (n) { return n.critical; }) ? 1 : 5,
          kind: 'diagnostics', event: EVENT_NAMES.action, message: 'Check connectivity, DNS and app origin.',
        });
      }
      if (config.modules.recovery && (!network.online || dnsFailure(network.dns) ||
          connectivityFailure(network.dns) || endpointFailure(network.endpoints))) {
        add({
          id: 'recovery', label: 'Recovery guidance', icon: 'recovery', priority: 1,
          kind: 'recovery', event: EVENT_NAMES.action, message: 'Steps to restore this connection.',
        });
      }
      if (config.modules.installation && installation.status === 'available') {
        add({
          id: 'install', label: installation.nativeAvailable ? 'Install this app' : 'Installation instructions',
          icon: 'install', priority: 4, kind: 'install', event: EVENT_NAMES.action,
          message: installation.support === 'manual-ios' ? 'Safari: Share → Add to Home Screen.' : 'Open the browser install prompt or instructions.',
        });
      }
      if (config.modules.failover && (network.endpoints.backup === 'active' || network.endpoints.active === 'backup')) {
        add({
          id: 'backup-status', label: 'Backup connection', icon: 'backup', priority: 3,
          kind: 'backup', event: EVENT_NAMES.action, message: 'The project is using its backup endpoint.',
        });
      }
      if (config.modules.updates && network.updateAvailable) {
        add({
          id: 'update', label: 'Apply app update', icon: 'update', priority: 5,
          kind: 'update', event: EVENT_NAMES.action, message: 'Activate the waiting service worker update.',
        });
      }
      config.actions.forEach(function (action) { add(action); });
      actions.sort(function (a, b) { return a.priority - b.priority; });
      return actions;
    }

    function computeState() {
      const project = projectInfo();
      const pwaSnapshot = readPwaSnapshot(getPwa());
      const installation = deriveInstallationState({
        pwa: getPwa(),
        enabled: config.modules.installation,
      });
      const network = {
        online: conditions.online,
        dns: {
          status: conditions.dns.status,
          classification: conditions.dns.classification,
          message: conditions.dns.message,
          checkedAt: conditions.dns.checkedAt,
        },
        endpoints: {
          primary: conditions.endpoints.primary,
          backup: conditions.endpoints.backup,
          active: conditions.endpoints.active,
          reason: conditions.endpoints.reason,
        },
        session: { state: conditions.session.state, message: conditions.session.message },
        // The toolkit records a waiting worker in its own snapshot before (or
        // without) a `pwa:update` event, so seed from it: otherwise an update
        // detected before the assistant bound stays invisible forever.
        updateAvailable: conditions.updateAvailable || pwaSnapshot.hasUpdate === true,
        recovery: conditions.recovery,
      };
      const notifications = buildNotifications(project, installation, network);
      const availableActions = buildActions(project, installation, network, notifications);
      const top = notifications[0] || null;
      return {
        enabled: config.enabled,
        project: project,
        installation: installation,
        network: network,
        capabilities: {
          installation: config.modules.installation,
          diagnostics: config.modules.diagnostics,
          recovery: config.modules.recovery,
          failover: config.modules.failover,
          help: config.modules.help,
          updates: config.modules.updates,
        },
        notifications: notifications,
        availableActions: availableActions,
        badge: {
          count: notifications.length,
          tone: top ? top.tone : 'none',
          label: top ? top.title : 'No alerts',
          priority: top ? top.priority : null,
        },
        appearance: {
          position: config.position,
          offsets: { x: config.offsets.x, y: config.offsets.y },
          theme: config.theme,
          themeColor: project.themeColor,
        },
        dismissed: Object.keys(noticeStore.dismissed),
        acknowledged: Object.keys(noticeStore.acknowledged),
      };
    }

    function statesEqual(a, b) {
      if (a === b) return true;
      if (!a || !b) return false;
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch (error) {
        return false;
      }
    }

    function emit() {
      if (destroyed) return;
      const next = computeState();
      // Snapshot identity stability. A repeated emit of an unchanged state must
      // not churn listeners, React `useSyncExternalStore` consumers (which would
      // re-render forever) or `localStorage`. Conditions are still re-evaluated
      // above, so dismissal resets and persistence keep happening.
      if (snapshot && statesEqual(snapshot, next)) return;
      snapshot = next;
      const doc = getDoc();
      if (shouldBindEvents && exposeGlobal) {
        try {
          if (doc && typeof doc.dispatchEvent === 'function' && root.CustomEvent) {
            doc.dispatchEvent(new root.CustomEvent(EVENT_NAMES.state, { detail: snapshot }));
          }
        } catch (error) { /* ignore */ }
      }
      listeners.forEach(function (listener) {
        try { listener(snapshot); } catch (error) { /* keep other listeners alive */ }
      });
    }

    function syncPwaSubscription() {
      if (unsubscribePwa || destroyed) return;
      const pwa = getPwa();
      if (pwa && typeof pwa.onChange === 'function') {
        try {
          unsubscribePwa = pwa.onChange(function () { emit(); });
        } catch (error) {
          unsubscribePwa = null;
        }
      }
    }

    const diagnosticsController = createDiagnosticsIntegration({
      get services() { return services; },
      getPwa: getPwa,
      getDns: getDns,
      getContext: function () {
        const project = projectInfo();
        return {
          hostname: project.hostname,
          origin: project.origin,
          basePath: project.basePath,
          online: conditions.online,
        };
      },
      onStart: function () {
        conditions.dns.status = 'running';
        emit();
      },
      onResult: function (result) {
        setDnsResult(result);
      },
    });

    function configure(nextOptions) {
      if (destroyed) return snapshot;
      const baseGlobal = useGlobalConfig && root.YOU_GE_ASSISTANT_CONFIG && typeof root.YOU_GE_ASSISTANT_CONFIG === 'object'
        ? root.YOU_GE_ASSISTANT_CONFIG
        : {};
      const merged = Object.assign({}, baseGlobal, rawOptionsState, nextOptions || {});
      if (services.diagnostics && !(merged.services && typeof merged.services.diagnostics === 'function')) {
        merged.services = Object.assign({}, merged.services || {}, { diagnostics: services.diagnostics });
      }
      rawOptionsState = merged;
      resolvedBundle = resolveAssistantConfig(merged, {
        storage: getStorage(),
        fallbackProjectId: snapshot && snapshot.project ? snapshot.project.id : '',
      });
      config = resolvedBundle.config;
      configMeta = resolvedBundle.meta;
      services = config.services;
      persistPublishedLkgIfDerivedProject();
      loadNotices(projectInfo().id);
      syncPwaSubscription();
      emit();
      return snapshot;
    }

    function getConfig() {
      return {
        enabled: config.enabled,
        projectId: config.projectId,
        domain: config.domain,
        position: config.position,
        offsets: { x: config.offsets.x, y: config.offsets.y },
        modules: clone(config.modules),
        notifications: clone(config.notifications),
        branding: clone(config.branding),
        actions: clone(config.actions),
        features: clone(config.features),
        theme: config.theme,
        meta: clone(configMeta),
      };
    }

    function subscribe(listener, subOptions) {
      if (typeof listener !== 'function' || destroyed) return function () {};
      listeners.add(listener);
      listenerCounts.set(listener, (listenerCounts.get(listener) || 0) + 1);
      if (!subOptions || subOptions.immediate !== false) {
        try { listener(snapshot); } catch (error) { /* ignore */ }
      }
      let active = true;
      // Reference-counted: the same listener may be subscribed by several
      // components/widgets, and unsubscribing one must not silence the others.
      return function () {
        if (!active) return;
        active = false;
        const remaining = (listenerCounts.get(listener) || 0) - 1;
        if (remaining > 0) {
          listenerCounts.set(listener, remaining);
          return;
        }
        listenerCounts.delete(listener);
        listeners.delete(listener);
      };
    }

    function setConnectivity(online) {
      conditions.online = Boolean(online);
      emit();
      return snapshot;
    }

    function setEndpointStatus(detail) {
      const input = detail && typeof detail === 'object' ? detail : {};
      const allowedPrimary = ['unknown', 'healthy', 'failed', 'unavailable', 'degraded'];
      const allowedBackup = ['unknown', 'active', 'inactive', 'failed'];
      const allowedActive = ['primary', 'backup', 'unknown'];
      const previousActive = conditions.endpoints.active;
      if (allowedPrimary.indexOf(input.primary) !== -1) conditions.endpoints.primary = input.primary;
      if (allowedBackup.indexOf(input.backup) !== -1) conditions.endpoints.backup = input.backup;
      if (allowedActive.indexOf(input.active) !== -1) conditions.endpoints.active = input.active;
      conditions.endpoints.reason = safeText(input.reason, 200);
      if (previousActive === 'backup' && conditions.endpoints.active === 'primary' && conditions.endpoints.primary === 'healthy') {
        conditions.recovery = true;
      }
      if (conditions.endpoints.active !== 'primary') conditions.recovery = false;
      emit();
      return snapshot;
    }

    function setSessionStatus(detail) {
      const input = detail && typeof detail === 'object' ? detail : {};
      if (['unknown', 'ok', 'issue'].indexOf(input.state) !== -1) conditions.session.state = input.state;
      conditions.session.message = safeText(input.message, 200);
      emit();
      return snapshot;
    }

    function setDnsResult(result) {
      conditions.dns = normalizeDnsResult(result, DateCtor);
      emit();
      return snapshot;
    }

    function setUpdateAvailable(available) {
      conditions.updateAvailable = available !== false;
      emit();
      return snapshot;
    }

    function runDiagnostics(runOptions) {
      if (destroyed) {
        return Promise.resolve({ classification: 'unknown', message: 'Assistant instance is destroyed.', status: 'unavailable' });
      }
      if (!config.modules.diagnostics) {
        const disabled = { classification: 'disabled', message: 'Network diagnostics are disabled for this project.', status: 'disabled' };
        setDnsResult(disabled);
        return Promise.resolve(disabled);
      }
      return diagnosticsController.run(runOptions);
    }

    function requestInstall(promptOptions) {
      if (destroyed) return Promise.resolve({ outcome: 'unsupported' });
      return requestPwaInstall({
        pwa: getPwa(),
        enabled: config.modules.installation,
      }, promptOptions);
    }

    function dismiss(id) {
      const safeId = safeText(id, 80);
      const notification = (snapshot && snapshot.notifications || []).filter(function (entry) { return entry.id === safeId; })[0];
      if (!notification) return false;
      if (notification.critical && config.notifications.criticalPersistent) return false;
      noticeStore.dismissed[noticeKey(snapshot.project.id, safeId)] = new DateCtor().toISOString();
      saveNotices(snapshot.project.id);
      emit();
      return true;
    }

    function acknowledge(id) {
      const safeId = safeText(id, 80);
      noticeStore.acknowledged[noticeKey(snapshot.project.id, safeId)] = new DateCtor().toISOString();
      saveNotices(snapshot.project.id);
      emit();
      return true;
    }

    const handlers = {
      online: function () { conditions.online = true; emit(); },
      offline: function () { conditions.online = false; emit(); },
      visibility: function () {
        const doc = getDoc();
        if (doc && doc.visibilityState === 'hidden') return;
        syncPwaSubscription();
        emit();
      },
      endpoint: function (event) { setEndpointStatus(event && event.detail); },
      session: function (event) { setSessionStatus(event && event.detail); },
      dns: function (event) { setDnsResult((event && event.detail) || {}); },
      pwaReady: function () { syncPwaSubscription(); emit(); },
      installable: function () { syncPwaSubscription(); emit(); },
      installed: function () { syncPwaSubscription(); emit(); },
      update: function () { conditions.updateAvailable = true; emit(); },
      diagnostics: function (event) { setDnsResult((event && event.detail) || {}); },
      action: function () { /* widgets dispatch actions; host apps listen. No state change. */ },
      storage: function (event) {
        if (!event || !event.key || event.key.indexOf(STORAGE_PREFIXES.notices) !== 0) return;
        loadNotices(snapshot ? snapshot.project.id : projectInfo().id);
        emit();
      },
    };

    function bindOnce() {
      if (bound || !shouldBindEvents) return;
      bound = true;
      const doc = getDoc();
      if (typeof root.addEventListener === 'function') {
        root.addEventListener('online', handlers.online);
        root.addEventListener('offline', handlers.offline);
        root.addEventListener('storage', handlers.storage);
      }
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', handlers.visibility);
        doc.addEventListener(EVENT_NAMES.endpointStatus, handlers.endpoint);
        doc.addEventListener(EVENT_NAMES.sessionStatus, handlers.session);
        doc.addEventListener(EVENT_NAMES.dnsResult, handlers.dns);
        doc.addEventListener(EVENT_NAMES.pwaReady, handlers.pwaReady);
        doc.addEventListener(EVENT_NAMES.pwaInstallable, handlers.installable);
        doc.addEventListener(EVENT_NAMES.pwaInstalled, handlers.installed);
        doc.addEventListener(EVENT_NAMES.pwaUpdate, handlers.update);
        doc.addEventListener(EVENT_NAMES.pwaDiagnostics, handlers.diagnostics);
        doc.addEventListener(EVENT_NAMES.action, handlers.action);
      }
      syncPwaSubscription();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      const doc = getDoc();
      if (bound) {
        if (typeof root.removeEventListener === 'function') {
          root.removeEventListener('online', handlers.online);
          root.removeEventListener('offline', handlers.offline);
          root.removeEventListener('storage', handlers.storage);
        }
        if (doc && typeof doc.removeEventListener === 'function') {
          doc.removeEventListener('visibilitychange', handlers.visibility);
          doc.removeEventListener(EVENT_NAMES.endpointStatus, handlers.endpoint);
          doc.removeEventListener(EVENT_NAMES.sessionStatus, handlers.session);
          doc.removeEventListener(EVENT_NAMES.dnsResult, handlers.dns);
          doc.removeEventListener(EVENT_NAMES.pwaReady, handlers.pwaReady);
          doc.removeEventListener(EVENT_NAMES.pwaInstallable, handlers.installable);
          doc.removeEventListener(EVENT_NAMES.pwaInstalled, handlers.installed);
          doc.removeEventListener(EVENT_NAMES.pwaUpdate, handlers.update);
          doc.removeEventListener(EVENT_NAMES.pwaDiagnostics, handlers.diagnostics);
          doc.removeEventListener(EVENT_NAMES.action, handlers.action);
        }
      }
      if (unsubscribePwa) {
        try { unsubscribePwa(); } catch (error) { /* ignore */ }
        unsubscribePwa = null;
      }
      listeners.clear();
      listenerCounts.clear();
      diagnosticsController.clear();
    }

    const api = {
      __state: true,
      version: SDK_VERSION,
      PRIORITY: PRIORITY,
      create: function (opts, envOpts) { return createAssistant(opts, envOpts); },
      attach: function (opts, envOpts) { return attachAssistant(opts, envOpts); },
      configure: configure,
      getConfig: getConfig,
      getState: function () { return snapshot; },
      subscribe: subscribe,
      setConnectivity: setConnectivity,
      setEndpointStatus: setEndpointStatus,
      setSessionStatus: setSessionStatus,
      setDnsResult: setDnsResult,
      setUpdateAvailable: setUpdateAvailable,
      runDiagnostics: runDiagnostics,
      requestInstall: requestInstall,
      dismiss: dismiss,
      acknowledge: acknowledge,
      isDestroyed: function () { return destroyed; },
      destroy: destroy,
    };

    persistPublishedLkgIfDerivedProject();
    loadNotices(projectInfo().id);
    bindOnce();
    if (!snapshot) emit();

    if (exposeGlobal) {
      root.YouGeAssistant = api;
    }

    return api;
  }
  function getGlobalAssistant(targetRoot) {
    const root = targetRoot || (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!root || !root.YouGeAssistant || !root.YouGeAssistant.__state) return null;
    if (typeof root.YouGeAssistant.isDestroyed === 'function' && root.YouGeAssistant.isDestroyed()) return null;
    return root.YouGeAssistant;
  }
  function attachAssistant(options, envOverrides) {
    const envIn = envOverrides && typeof envOverrides === 'object' ? envOverrides : {};
    const root = envIn.root || envIn.window || (options && options.window) || (typeof globalThis !== 'undefined' ? globalThis : {});
    const existing = getGlobalAssistant(root);
    if (existing) {
      if (!existing.create) existing.create = createAssistant;
      if (!existing.attach) existing.attach = attachAssistant;
      if (!existing.version) existing.version = SDK_VERSION;
      if (options && typeof options === 'object' && Object.keys(options).length > 0 && typeof existing.configure === 'function') {
        existing.configure(options);
      }
      return existing;
    }
    return createAssistant(options, Object.assign({}, envIn, {
      root: root,
      useGlobalConfig: envIn.useGlobalConfig !== false,
      exposeGlobal: true,
    }));
  }

  var api = attachAssistant(root.YOU_GE_ASSISTANT_CONFIG || {}, {
    root: root,
    useGlobalConfig: true,
  });

  root.YouGeAssistantSDK = {
    version: SDK_VERSION,
    kitCompatVersion: KIT_COMPAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    PRIORITY: PRIORITY,
    EVENT_NAMES: EVENT_NAMES,
    create: createAssistant,
    attach: attachAssistant,
    getGlobal: getGlobalAssistant,
    resolveDomain: resolveDomain,
    buildManifest: buildManifest,
    domain: createDomainResolver(root.YOU_GE_DOMAIN_REGISTRY || {}),
    validatePublishedConfig: validatePublishedConfig,
  };

  root.YouGeAssistant = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
