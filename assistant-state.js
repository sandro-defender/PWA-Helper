/*!
 * assistant-state.js — You.Ge Assistant centralized widget state
 * ------------------------------------------------------------------
 * Dependency-free classic script. Load after domain-config.js / pwa.js and
 * before assistant-widget.js (or before a React renderer).
 *
 * Provides: window.YouGeAssistant
 *   configure(options)            project/widget SDK configuration
 *   getState()                    stable, JSON-serializable snapshot
 *   subscribe(listener)           event-driven updates -> unsubscribe()
 *   setEndpointStatus(detail)     primary/backup/failover status (published, not probed)
 *   setSessionStatus(detail)      auth/session condition (published, not authenticated here)
 *   setDnsResult(result)          DNS/network diagnostic result
 *   runDiagnostics()              on-demand, single-flight, delegates to PWA/SDK
 *   requestInstall()              delegates to the browser install event
 *   dismiss(id) / acknowledge(id) notification suppression
 *   destroy()                     removes every listener
 *
 * It never registers a service worker, never calls fetch(), never polls, and
 * never treats hostname detection as authentication. Remote configuration is
 * data-only; functions are accepted only from local SDK config services.
 */
(function (root) {
  'use strict';

  if (root.YouGeAssistant && root.YouGeAssistant.__state) return;

  var PRIORITY = { critical: 1, auth: 2, backup: 3, install: 4, info: 5 };
  var TONE = { 1: 'critical', 2: 'auth', 3: 'backup', 4: 'install', 5: 'info' };
  var POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  var ICONS = ['install', 'diagnostics', 'recovery', 'backup', 'help', 'info', 'update', 'custom'];
  var DEFAULT_CONFIG = {
    enabled: true,
    projectId: '',
    position: 'bottom-right',
    offsets: { x: 20, y: 20 },
    modules: { installation: true, diagnostics: true, recovery: true, failover: true, help: true, updates: true },
    notifications: { dismissible: true, suppressRepeats: true, criticalPersistent: true },
    branding: { name: '', shortName: '', icon: '', themeColor: '' },
    actions: [],
    features: [],
    theme: 'auto',
  };

  var config = normalizeConfig(root.YOU_GE_ASSISTANT_CONFIG || {});
  var services = config.services;
  var listeners = new Set();
  var noticeStore = { dismissed: {}, acknowledged: {} };
  var snapshot = null;
  var bound = false;
  var destroyed = false;
  var unsubscribePwa = null;
  var diagnosticsInFlight = null;
  var lastConditionKeys = new Set();
  var conditions = {
    online: root.navigator ? root.navigator.onLine !== false : true,
    dns: { status: 'idle', classification: 'unknown', message: '', checkedAt: null },
    endpoints: { primary: 'unknown', backup: 'inactive', active: 'primary', reason: '' },
    session: { state: 'unknown', message: '' },
    updateAvailable: false,
    recovery: false,
  };

  /* ------------------------------------------------------------------ *
   * Validation helpers. State is always data-only and serializable.
   * ------------------------------------------------------------------ */

  function clampNumber(value, fallback, min, max) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function safeText(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max || 120);
  }

  function safeIcon(value, fallback) {
    if (!value) return fallback;
    try {
      var base = new root.URL(root.location && root.location.href ? root.location.href : 'https://localhost/');
      var url = new root.URL(String(value), base);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
      if (url.origin !== base.origin) return fallback; // project icons stay same-origin
      return url.pathname + url.search;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeActions(raw) {
    if (!Array.isArray(raw)) return [];
    var seen = new Set();
    return raw.slice(0, 20).map(function (entry) {
      var id = safeText(entry && entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
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
    var seen = new Set();
    return raw.slice(0, 20).map(function (entry) {
      var id = safeText(entry && entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return { id: id, label: safeText(entry.label, 60) || id, message: safeText(entry.message, 200) };
    }).filter(Boolean);
  }

  function normalizeConfig(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var modules = Object.assign({}, DEFAULT_CONFIG.modules, raw.modules || {});
    Object.keys(modules).forEach(function (key) { modules[key] = modules[key] !== false; });
    var notifications = Object.assign({}, DEFAULT_CONFIG.notifications, raw.notifications || {});
    var branding = Object.assign({}, DEFAULT_CONFIG.branding, raw.branding || {});
    var offsets = Object.assign({}, DEFAULT_CONFIG.offsets, raw.offsets || {});
    var servicesIn = raw.services && typeof raw.services === 'object' ? raw.services : {};
    return {
      enabled: raw.enabled !== false,
      projectId: safeText(raw.projectId, 80),
      position: POSITIONS.indexOf(raw.position) !== -1 ? raw.position : DEFAULT_CONFIG.position,
      offsets: {
        x: clampNumber(offsets.x, DEFAULT_CONFIG.offsets.x, 0, 160),
        y: clampNumber(offsets.y, DEFAULT_CONFIG.offsets.y, 0, 160),
      },
      modules: modules,
      notifications: {
        dismissible: notifications.dismissible !== false,
        suppressRepeats: notifications.suppressRepeats !== false,
        criticalPersistent: notifications.criticalPersistent !== false,
      },
      branding: {
        name: safeText(branding.name, 80),
        shortName: safeText(branding.shortName, 40),
        icon: safeText(branding.icon, 200),
        themeColor: /^#[0-9a-f]{3,8}$/i.test(branding.themeColor || '') ? branding.themeColor : '',
      },
      actions: normalizeActions(raw.actions),
      features: normalizeFeatures(raw.features),
      theme: ['auto', 'light', 'dark'].indexOf(raw.theme) !== -1 ? raw.theme : 'auto',
      services: {
        diagnostics: typeof servicesIn.diagnostics === 'function' ? servicesIn.diagnostics : null,
      },
    };
  }

  function domainContext() {
    var loc = root.location || {};
    var fallback = {
      identity: { name: 'You.Ge Assistant', shortName: 'You.Ge', description: '' },
      branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/' },
      domain: {
        hostname: loc.hostname || 'localhost', origin: loc.origin || 'https://localhost',
        protocol: loc.protocol || 'https:', pathname: loc.pathname || '/', basePath: '/', configured: false,
      },
      features: { installation: true, diagnostics: true },
    };
    if (!root.YouGeDomain || typeof root.YouGeDomain.resolve !== 'function') return fallback;
    try {
      var resolved = root.YouGeDomain.resolve({
        hostname: loc.hostname, origin: loc.origin, protocol: loc.protocol,
        pathname: loc.pathname, basePath: loc.pathname || '/',
      });
      return resolved || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function projectInfo() {
    var domain = domainContext();
    var host = domain.domain || {};
    var basePath = domain.pwa && domain.pwa.basePath ? domain.pwa.basePath : '/';
    var identity = domain.identity || {};
    var branding = domain.branding || {};
    var id = config.projectId || String(host.hostname || 'localhost') + String(basePath);
    return {
      id: id,
      name: config.branding.name || identity.name || 'You.Ge Assistant',
      shortName: config.branding.shortName || identity.shortName || 'You.Ge',
      icon: safeIcon(config.branding.icon || branding.icon, 'icons/icon-192.png'),
      themeColor: config.branding.themeColor || branding.themeColor || '#155eef',
      hostname: String(host.hostname || 'localhost'),
      origin: String(host.origin || 'https://localhost'),
      basePath: String(basePath),
      configured: Boolean(host.configured),
    };
  }

  function storageKey(projectId) {
    return 'youge-assistant:notices:' + projectId;
  }

  function loadNotices(projectId) {
    noticeStore = { dismissed: {}, acknowledged: {} };
    try {
      var raw = root.localStorage && root.localStorage.getItem(storageKey(projectId));
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        noticeStore.dismissed = parsed.dismissed && typeof parsed.dismissed === 'object' ? parsed.dismissed : {};
        noticeStore.acknowledged = parsed.acknowledged && typeof parsed.acknowledged === 'object' ? parsed.acknowledged : {};
      }
    } catch (error) { /* storage unavailable */ }
  }

  function saveNotices(projectId) {
    try {
      if (root.localStorage) root.localStorage.setItem(storageKey(projectId), JSON.stringify(noticeStore));
    } catch (error) { /* storage unavailable */ }
  }

  function noticeKey(projectId, id) { return projectId + ':' + id; }
  function isSuppressed(projectId, id, critical) {
    var key = noticeKey(projectId, id);
    if (config.notifications.suppressRepeats && noticeStore.dismissed[key]) return true;
    if (critical && noticeStore.acknowledged[key]) return true;
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Derived state
   * ------------------------------------------------------------------ */

  function pwaState() {
    var pwa = root.PWA;
    var state = {};
    if (!pwa) return state;
    try { if (typeof pwa.getState === 'function') state = pwa.getState() || {}; } catch (error) { state = {}; }
    return state;
  }

  function installationState() {
    var pwa = root.PWA;
    var state = pwaState();
    var installed = Boolean(state.installed || state.standalone);
    var canInstall = Boolean(state.canInstall);
    var ios = Boolean(state.ios);
    var safari = Boolean(state.safari);
    try { if (!installed && pwa && typeof pwa.isInstalled === 'function') installed = pwa.isInstalled(); } catch (error) { /* ignore */ }
    try { if (!canInstall && pwa && typeof pwa.canInstall === 'function') canInstall = pwa.canInstall(); } catch (error) { /* ignore */ }
    try { if (!ios && pwa && typeof pwa.isIOS === 'function') ios = pwa.isIOS(); } catch (error) { /* ignore */ }
    try { if (!safari && pwa && typeof pwa.isSafari === 'function') safari = pwa.isSafari(); } catch (error) { /* ignore */ }

    var enabled = config.modules.installation && Boolean(pwa) &&
      (!root.PWA || !root.PWA.config || root.PWA.config.features.installation !== false);
    var support = 'none';
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

  // Classification names produced by dns-diagnostics.js. A DoH lookup is never
  // proof of an ISP problem, so "possible" results are labelled as diagnostics,
  // not as certainty.
  function dnsFailure(dns) {
    var classification = String(dns.classification || 'unknown').toLowerCase();
    return ['nxdomain', 'dns_resolution_failure', 'dns_records_missing',
      'possible_dns_interference', 'dns_failure', 'dns-error', 'dns_failed',
      'missing_address_records', 'servfail', 'refused'].indexOf(classification) !== -1;
  }

  function connectivityFailure(dns) {
    var classification = String(dns.classification || 'unknown').toLowerCase();
    return ['general_internet_failure', 'application_host_unavailable',
      'backend_unavailable', 'error', 'timeout'].indexOf(classification) !== -1 || Boolean(dns.failed);
  }

  function endpointFailure(endpoints) {
    return endpoints.primary === 'failed' || endpoints.primary === 'unavailable' || endpoints.primary === 'degraded';
  }

  function buildNotifications(project, installation, network) {
    var out = [];
    var activeKeys = new Set();

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
      // Only when the browser still reports a connection: offline already has
      // its own critical alert and must not produce a duplicate.
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

    // A resolved condition clears its suppression so it can be shown again if
    // it reappears later. Critical alerts otherwise remain until acknowledged.
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
    var actions = [];
    function add(action) {
      if (actions.some(function (entry) { return entry.id === action.id; })) return;
      actions.push(action);
    }
    if (config.modules.diagnostics) {
      add({
        id: 'diagnostics', label: 'Run network diagnostics', icon: 'diagnostics',
        priority: notifications.some(function (n) { return n.critical; }) ? 1 : 5,
        kind: 'diagnostics', event: 'youge:action', message: 'Check connectivity, DNS and app origin.',
      });
    }
    if (config.modules.recovery && (!network.online || dnsFailure(network.dns) ||
        connectivityFailure(network.dns) || endpointFailure(network.endpoints))) {
      add({
        id: 'recovery', label: 'Recovery guidance', icon: 'recovery', priority: 1,
        kind: 'recovery', event: 'youge:action', message: 'Steps to restore this connection.',
      });
    }
    if (config.modules.installation && installation.status === 'available') {
      add({
        id: 'install', label: installation.nativeAvailable ? 'Install this app' : 'Installation instructions',
        icon: 'install', priority: 4, kind: 'install', event: 'youge:action',
        message: installation.support === 'manual-ios' ? 'Safari: Share → Add to Home Screen.' : 'Open the browser install prompt or instructions.',
      });
    }
    if (config.modules.failover && (network.endpoints.backup === 'active' || network.endpoints.active === 'backup')) {
      add({
        id: 'backup-status', label: 'Backup connection', icon: 'backup', priority: 3,
        kind: 'backup', event: 'youge:action', message: 'The project is using its backup endpoint.',
      });
    }
    if (config.modules.updates && network.updateAvailable) {
      add({
        id: 'update', label: 'Apply app update', icon: 'update', priority: 5,
        kind: 'update', event: 'youge:action', message: 'Activate the waiting service worker update.',
      });
    }
    config.actions.forEach(function (action) { add(action); });
    actions.sort(function (a, b) { return a.priority - b.priority; });
    return actions;
  }

  function computeState() {
    var project = projectInfo();
    var installation = installationState();
    var network = {
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
      updateAvailable: conditions.updateAvailable,
      recovery: conditions.recovery,
    };
    var notifications = buildNotifications(project, installation, network);
    var availableActions = buildActions(project, installation, network, notifications);
    var top = notifications[0] || null;
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

  function emit() {
    if (destroyed) return;
    snapshot = computeState();
    try {
      if (root.document && typeof root.document.dispatchEvent === 'function' && root.CustomEvent) {
        root.document.dispatchEvent(new root.CustomEvent('youge:state', { detail: snapshot }));
      }
    } catch (error) { /* ignore */ }
    listeners.forEach(function (listener) {
      try { listener(snapshot); } catch (error) { /* keep other listeners alive */ }
    });
  }

  /* ------------------------------------------------------------------ *
   * Public SDK surface
   * ------------------------------------------------------------------ */

  function configure(options) {
    if (destroyed) return api.getState();
    var merged = Object.assign({}, root.YOU_GE_ASSISTANT_CONFIG || {}, options || {});
    // Preserve locally injected services across reconfiguration.
    if (services.diagnostics && !(merged.services && typeof merged.services.diagnostics === 'function')) {
      merged.services = Object.assign({}, merged.services || {}, { diagnostics: services.diagnostics });
    }
    config = normalizeConfig(merged);
    services = config.services;
    loadNotices(projectInfo().id);
    emit();
    return snapshot;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    try { listener(snapshot); } catch (error) { /* ignore */ }
    return function () { listeners.delete(listener); };
  }

  function setEndpointStatus(detail) {
    detail = detail && typeof detail === 'object' ? detail : {};
    var allowedPrimary = ['unknown', 'healthy', 'failed', 'unavailable', 'degraded'];
    var allowedBackup = ['unknown', 'active', 'inactive', 'failed'];
    var allowedActive = ['primary', 'backup', 'unknown'];
    var previousActive = conditions.endpoints.active;
    if (allowedPrimary.indexOf(detail.primary) !== -1) conditions.endpoints.primary = detail.primary;
    if (allowedBackup.indexOf(detail.backup) !== -1) conditions.endpoints.backup = detail.backup;
    if (allowedActive.indexOf(detail.active) !== -1) conditions.endpoints.active = detail.active;
    conditions.endpoints.reason = safeText(detail.reason, 200);
    if (previousActive === 'backup' && conditions.endpoints.active === 'primary' && conditions.endpoints.primary === 'healthy') {
      conditions.recovery = true;
    }
    if (conditions.endpoints.active !== 'primary') conditions.recovery = false;
    emit();
    return snapshot;
  }

  function setSessionStatus(detail) {
    detail = detail && typeof detail === 'object' ? detail : {};
    if (['unknown', 'ok', 'issue'].indexOf(detail.state) !== -1) conditions.session.state = detail.state;
    conditions.session.message = safeText(detail.message, 200);
    emit();
    return snapshot;
  }

  function setDnsResult(result) {
    result = result && typeof result === 'object' ? result : {};
    conditions.dns = {
      status: String(result.status || 'complete'),
      classification: safeText(result.classification || 'unknown', 60),
      message: safeText(result.message || '', 240),
      checkedAt: result.checkedAt || new root.Date().toISOString(),
      failed: Boolean(result.failed),
    };
    emit();
    return snapshot;
  }

  function runDiagnostics() {
    if (diagnosticsInFlight) return diagnosticsInFlight;
    var runner = services.diagnostics ||
      (root.PWA && typeof root.PWA.runNetworkDiagnostics === 'function' ? root.PWA.runNetworkDiagnostics : null);
    if (!runner) {
      var unavailable = { classification: 'unknown', message: 'Network diagnostics are not available on this page.', status: 'unavailable' };
      setDnsResult(unavailable);
      return Promise.resolve(unavailable);
    }
    conditions.dns.status = 'running';
    emit();
    diagnosticsInFlight = Promise.resolve()
      .then(function () { return runner(); })
      .then(function (result) { setDnsResult(result || {}); return result; })
      .catch(function (error) {
        var failed = { classification: 'error', message: safeText(error && error.message, 200) || 'Diagnostics failed.', status: 'error', failed: true };
        setDnsResult(failed);
        return failed;
      })
      .then(function (result) { diagnosticsInFlight = null; return result; });
    return diagnosticsInFlight;
  }

  function requestInstall() {
    if (!config.modules.installation || !root.PWA || typeof root.PWA.promptInstall !== 'function') {
      return Promise.resolve({ outcome: 'unsupported' });
    }
    try { return Promise.resolve(root.PWA.promptInstall()); }
    catch (error) { return Promise.resolve({ outcome: 'error' }); }
  }

  function dismiss(id) {
    id = safeText(id, 80);
    var notification = (snapshot && snapshot.notifications || []).filter(function (entry) { return entry.id === id; })[0];
    if (!notification) return false;
    if (notification.critical && config.notifications.criticalPersistent) return false;
    noticeStore.dismissed[noticeKey(snapshot.project.id, id)] = new root.Date().toISOString();
    saveNotices(snapshot.project.id);
    emit();
    return true;
  }

  function acknowledge(id) {
    id = safeText(id, 80);
    noticeStore.acknowledged[noticeKey(snapshot.project.id, id)] = new root.Date().toISOString();
    saveNotices(snapshot.project.id);
    emit();
    return true;
  }

  /* ------------------------------------------------------------------ *
   * One-time event bindings
   * ------------------------------------------------------------------ */

  var handlers = {
    online: function () { conditions.online = true; emit(); },
    offline: function () { conditions.online = false; emit(); },
    visibility: function () {
      if (root.document && root.document.visibilityState === 'hidden') return;
      emit(); // re-read PWA state; no network request
    },
    endpoint: function (event) { setEndpointStatus(event.detail); },
    session: function (event) { setSessionStatus(event.detail); },
    dns: function (event) { setDnsResult(event.detail || {}); },
    installable: function () { emit(); },
    installed: function () { emit(); },
    update: function () { conditions.updateAvailable = true; emit(); },
    diagnostics: function (event) { setDnsResult(event.detail || {}); },
    action: function () { /* widgets dispatch actions; host apps listen. No state change. */ },
    storage: function (event) {
      if (!event || !event.key || event.key.indexOf('youge-assistant:notices:') !== 0) return;
      loadNotices(snapshot ? snapshot.project.id : projectInfo().id);
      emit();
    },
  };

  function bindOnce() {
    if (bound) return;
    bound = true;
    if (typeof root.addEventListener === 'function') {
      root.addEventListener('online', handlers.online);
      root.addEventListener('offline', handlers.offline);
      root.addEventListener('storage', handlers.storage);
    }
    if (root.document && typeof root.document.addEventListener === 'function') {
      root.document.addEventListener('visibilitychange', handlers.visibility);
      root.document.addEventListener('youge:endpoint-status', handlers.endpoint);
      root.document.addEventListener('youge:session-status', handlers.session);
      root.document.addEventListener('youge:dns-result', handlers.dns);
      root.document.addEventListener('pwa:installable', handlers.installable);
      root.document.addEventListener('pwa:installed', handlers.installed);
      root.document.addEventListener('pwa:update', handlers.update);
      root.document.addEventListener('pwa:diagnostics', handlers.diagnostics);
      root.document.addEventListener('youge:action', handlers.action);
    }
    if (root.PWA && typeof root.PWA.onChange === 'function') {
      try { unsubscribePwa = root.PWA.onChange(function () { emit(); }); } catch (error) { unsubscribePwa = null; }
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (typeof root.removeEventListener === 'function') {
      root.removeEventListener('online', handlers.online);
      root.removeEventListener('offline', handlers.offline);
      root.removeEventListener('storage', handlers.storage);
    }
    if (root.document && typeof root.document.removeEventListener === 'function') {
      root.document.removeEventListener('visibilitychange', handlers.visibility);
      root.document.removeEventListener('youge:endpoint-status', handlers.endpoint);
      root.document.removeEventListener('youge:session-status', handlers.session);
      root.document.removeEventListener('youge:dns-result', handlers.dns);
      root.document.removeEventListener('pwa:installable', handlers.installable);
      root.document.removeEventListener('pwa:installed', handlers.installed);
      root.document.removeEventListener('pwa:update', handlers.update);
      root.document.removeEventListener('pwa:diagnostics', handlers.diagnostics);
      root.document.removeEventListener('youge:action', handlers.action);
    }
    if (unsubscribePwa) { try { unsubscribePwa(); } catch (error) { /* ignore */ } }
    listeners.clear();
    diagnosticsInFlight = null;
  }

  var api = {
    __state: true,
    PRIORITY: PRIORITY,
    configure: configure,
    getState: function () { return snapshot; },
    subscribe: subscribe,
    setEndpointStatus: setEndpointStatus,
    setSessionStatus: setSessionStatus,
    setDnsResult: setDnsResult,
    runDiagnostics: runDiagnostics,
    requestInstall: requestInstall,
    dismiss: dismiss,
    acknowledge: acknowledge,
    destroy: destroy,
  };

  root.YouGeAssistant = api;
  loadNotices(projectInfo().id);
  bindOnce();
  emit();
})(typeof globalThis !== 'undefined' ? globalThis : this);
