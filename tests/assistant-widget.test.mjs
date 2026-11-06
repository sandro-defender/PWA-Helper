/*!
 * Intelligent Floating Assistant — centralized state + DOM renderer tests.
 * Uses a small VM harness so the classic scripts are exercised without a
 * browser, without network access and without a second state implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const stateSource = readFileSync(fileURLToPath(new URL('../assistant-state.js', import.meta.url)), 'utf8');
const widgetSource = readFileSync(fileURLToPath(new URL('../assistant-widget.js', import.meta.url)), 'utf8');
const widgetCss = readFileSync(fileURLToPath(new URL('../assistant-widget.css', import.meta.url)), 'utf8');
const mainJsx = readFileSync(fileURLToPath(new URL('../example/src/main.jsx', import.meta.url)), 'utf8');
const demoHtml = readFileSync(fileURLToPath(new URL('../demo/index.html', import.meta.url)), 'utf8');
const exampleHtml = readFileSync(fileURLToPath(new URL('../example/index.html', import.meta.url)), 'utf8');
const offlineHtml = readFileSync(fileURLToPath(new URL('../offline.html', import.meta.url)), 'utf8');
const snippetHtml = readFileSync(fileURLToPath(new URL('../snippet.html', import.meta.url)), 'utf8');

function makeTarget() {
  const listeners = new Map();
  return {
    _listeners: listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      const set = listeners.get(type);
      if (set) set.delete(listener);
    },
    _fire(event) {
      const set = listeners.get(event.type);
      if (set) Array.from(set).forEach((listener) => listener(event));
    },
    dispatchEvent(event) {
      this._fire(event);
      return true;
    },
    listenerCount(type) {
      const set = listeners.get(type);
      return set ? set.size : 0;
    },
  };
}

class FakeNode {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = ownerDocument || null;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this._className = '';
    this._textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this._listeners = new Map();
    this.style = {
      setProperty(name, value) { this[name] = value; },
    };
    const self = this;
    const classes = new Set();
    function sync() { self._className = Array.from(classes).join(' '); }
    this.classList = {
      add(...names) { names.forEach((name) => classes.add(name)); sync(); },
      remove(...names) { names.forEach((name) => classes.delete(name)); sync(); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name); else classes.delete(name);
        sync();
        return shouldAdd;
      },
    };
  }

  get className() { return this._className; }
  set className(value) {
    this._className = String(value || '');
    const classes = new Set(this._className.split(/\s+/).filter(Boolean));
    const self = this;
    function sync() { self._className = Array.from(classes).join(' '); }
    this.classList = {
      add(...names) { names.forEach((name) => classes.add(name)); sync(); },
      remove(...names) { names.forEach((name) => classes.delete(name)); sync(); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name); else classes.delete(name);
        sync();
        return shouldAdd;
      },
    };
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get textContent() { return this._textContent; }
  set textContent(value) { this._textContent = String(value == null ? '' : value); this.children = []; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) { this._innerHTML = String(value == null ? '' : value); }
  get firstChild() { return this.children[0] || null; }

  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null; }
  hasAttribute(name) { return this.attributes.has(String(name)); }
  removeAttribute(name) { this.attributes.delete(String(name)); }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  matches(selector) {
    return String(selector).split(',').some((part) => {
      const text = part.trim();
      const attr = /^\[([^\]=]+)(?:=["']([^"']*)["'])?\]$/.exec(text);
      if (attr) {
        if (!this.hasAttribute(attr[1])) return false;
        return attr[2] === undefined || this.getAttribute(attr[1]) === attr[2];
      }
      const className = /^\.([\w-]+)$/.exec(text);
      if (className) return this.classList.contains(className[1]);
      const idName = /^#([\w-]+)$/.exec(text);
      if (idName) return this.id === idName[1];
      const tagName = /^[a-zA-Z][\w-]*$/.exec(text);
      if (tagName) return this.tagName === tagName[0].toUpperCase();
      return false;
    });
  }
  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches && current.matches(selector)) return current;
      current = current.parentNode;
    }
    return null;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(selector, out = []) {
    for (const child of this.children) {
      if (child.matches(selector)) out.push(child);
      child.querySelectorAll(selector, out);
    }
    return out;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    const set = this._listeners.get(type);
    if (set) set.delete(listener);
  }
  _fire(event) {
    const set = this._listeners.get(event.type);
    if (set) Array.from(set).forEach((listener) => listener(event));
  }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function makeDocument(rich) {
  const target = makeTarget();
  const doc = Object.assign({
    readyState: 'complete',
    visibilityState: 'visible',
    activeElement: null,
  }, target);
  if (!rich) {
    doc.body = { appendChild() {}, removeChild() {}, contains() { return false; } };
    doc.createElement = () => ({ setAttribute() {}, appendChild() {}, style: { setProperty() {} } });
    doc.getElementById = () => null;
    doc.querySelector = () => null;
    return doc;
  }
  doc.body = new FakeNode('body', doc);
  doc.createElement = (tag) => new FakeNode(tag, doc);
  doc.getElementById = (id) => findById(doc.body, id);
  doc.querySelector = (selector) => doc.body.querySelector(selector);
  return doc;
}

function makeStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    clear() { map.clear(); },
    _map: map,
  };
}

function makePwa(initial = {}) {
  const pwaState = Object.assign({
    installed: false, standalone: false, canInstall: false, ios: false, safari: false,
    hostname: 'example.test', origin: 'https://example.test',
  }, initial);
  let changeListener = null;
  const calls = { diagnostics: 0, install: 0, showDialog: 0, applyUpdate: 0 };
  return {
    state: pwaState,
    calls,
    config: { features: { installation: true, diagnostics: true } },
    getState() { return Object.assign({}, pwaState); },
    onChange(listener) {
      changeListener = listener;
      listener(this.getState());
      return () => { if (changeListener === listener) changeListener = null; };
    },
    isInstalled() { return pwaState.installed || pwaState.standalone; },
    canInstall() { return pwaState.canInstall; },
    isIOS() { return pwaState.ios; },
    isSafari() { return pwaState.safari; },
    promptInstall() { calls.install += 1; return Promise.resolve({ outcome: 'accepted' }); },
    runNetworkDiagnostics() { calls.diagnostics += 1; return Promise.resolve({ classification: 'normal_connectivity', message: 'OK' }); },
    showNetworkDiagnostics() { calls.showDialog += 1; return {}; },
    applyUpdate() { calls.applyUpdate += 1; },
    emitChange() { if (changeListener) changeListener(this.getState()); },
  };
}

function createContext(options = {}) {
  const document = makeDocument(Boolean(options.richDocument));
  const win = Object.assign({}, makeTarget());
  const storage = options.storage || makeStorage();
  const pwa = options.pwa === null ? null : (options.pwa || makePwa(options.pwaState));
  win.window = win;
  win.self = win;
  win.document = document;
  win.location = {
    href: options.href || 'https://example.test/',
    hostname: 'example.test',
    origin: 'https://example.test',
    protocol: 'https:',
    pathname: '/',
  };
  win.navigator = { onLine: options.online !== false };
  win.localStorage = storage;
  win.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  win.URL = URL;
  win.Date = Date;
  win.Promise = Promise;
  win.JSON = JSON;
  win.Set = Set;
  win.Map = Map;
  win.Math = Math;
  win.Object = Object;
  win.Array = Array;
  win.String = String;
  win.Number = Number;
  win.Boolean = Boolean;
  win.RegExp = RegExp;
  win.Error = Error;
  win.isFinite = isFinite;
  win.parseInt = parseInt;
  win.parseFloat = parseFloat;
  win.encodeURIComponent = encodeURIComponent;
  win.decodeURIComponent = decodeURIComponent;
  win.console = console;
  win.matchMedia = () => ({ matches: Boolean(options.reducedMotion) });
  win.requestAnimationFrame = (fn) => { fn(); return 1; };
  win.setTimeout = (fn) => { fn(); return 1; };
  win.clearTimeout = () => {};
  win.YOU_GE_ASSISTANT_CONFIG = options.config || {};
  win.PWA = pwa;
  win.YouGeDomain = {
    resolve: () => ({
      identity: { name: 'Example Project', shortName: 'Example', description: '' },
      branding: { icon: 'icons/icon-192.png', themeColor: '#155eef' },
      pwa: { basePath: '/' },
      domain: {
        hostname: 'example.test', origin: 'https://example.test', protocol: 'https:',
        pathname: '/', basePath: '/', configured: true,
      },
      features: { installation: true, diagnostics: true },
    }),
  };
  vm.createContext(win);
  vm.runInContext(stateSource, win, { filename: 'assistant-state.js' });
  return { win, document, storage, pwa, api: win.YouGeAssistant };
}

function loadWidget(ctx) {
  vm.runInContext(widgetSource, ctx.win, { filename: 'assistant-widget.js' });
  return ctx.win.YouGeAssistantWidget;
}

function fire(document, node, type, props = {}) {
  const event = Object.assign({ type, target: node, detail: undefined }, props);
  let current = node;
  while (current) {
    if (current._fire) current._fire(event);
    current = current.parentNode;
  }
  document._fire(event);
  return event;
}

function noticeIds(state) { return state.notifications.map((notice) => notice.id); }

/* ------------------------------------------------------------------ *
 * 1–3. Installation capability / already installed / unsupported
 * ------------------------------------------------------------------ */

test('installable browser advertises a native install action at priority 4', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  const state = ctx.api.getState();
  assert.equal(state.installation.support, 'native');
  assert.equal(state.installation.status, 'available');
  assert.equal(state.installation.nativeAvailable, true);
  assert.ok(noticeIds(state).includes('install:available'));
  assert.equal(state.notifications.find((n) => n.id === 'install:available').priority, 4);
  assert.ok(state.availableActions.some((action) => action.id === 'install'));
});

test('already-installed PWA suppresses install suggestions and badges', () => {
  const ctx = createContext({ pwaState: { installed: true, standalone: true, canInstall: true } });
  const state = ctx.api.getState();
  assert.equal(state.installation.status, 'installed');
  assert.equal(noticeIds(state).includes('install:available'), false);
  assert.equal(state.availableActions.some((action) => action.id === 'install'), false);
  assert.equal(state.badge.count, 0);
});

test('unsupported installation browser and disabled module suppress install suggestions', () => {
  const unsupported = createContext({ pwa: null });
  assert.equal(unsupported.api.getState().installation.support, 'none');
  assert.equal(noticeIds(unsupported.api.getState()).includes('install:available'), false);

  const disabled = createContext({
    pwaState: { canInstall: true },
    config: { modules: { installation: false } },
  });
  assert.equal(disabled.api.getState().installation.support, 'none');
  assert.equal(disabled.api.getState().capabilities.installation, false);
});

test('iOS Safari gets platform-specific manual instructions, generic browsers get generic help', () => {
  const ios = createContext({ pwaState: { ios: true, safari: true } });
  assert.equal(ios.api.getState().installation.support, 'manual-ios');
  assert.equal(ios.api.getState().installation.nativeAvailable, false);

  const generic = createContext({ pwaState: { ios: false, safari: false } });
  assert.equal(generic.api.getState().installation.support, 'manual-generic');
});

/* ------------------------------------------------------------------ *
 * 4–7. Network, DNS, primary/backup endpoints and recovery
 * ------------------------------------------------------------------ */

test('network failure raises a persistent critical connectivity notice', () => {
  const ctx = createContext();
  ctx.win.dispatchEvent({ type: 'offline' });
  const state = ctx.api.getState();
  assert.equal(state.network.online, false);
  assert.ok(noticeIds(state).includes('network:offline'));
  const notice = state.notifications.find((n) => n.id === 'network:offline');
  assert.equal(notice.priority, 1);
  assert.equal(notice.critical, true);
  assert.equal(notice.dismissible, false);
  assert.equal(state.badge.tone, 'critical');
  assert.equal(ctx.api.dismiss('network:offline'), false);
});

test('DNS failure classification raises a critical DNS notice with diagnostics action', () => {
  const ctx = createContext();
  ctx.api.setDnsResult({ classification: 'dns_resolution_failure', message: 'NXDOMAIN returned.' });
  const state = ctx.api.getState();
  assert.ok(noticeIds(state).includes('dns:failure'));
  assert.equal(state.notifications.find((n) => n.id === 'dns:failure').priority, 1);
  assert.ok(state.availableActions.some((action) => action.id === 'diagnostics'));
  assert.ok(state.availableActions.some((action) => action.id === 'recovery'));
});

test('primary API failure is critical; backup activation is priority 3; primary recovery is info', () => {
  const ctx = createContext();
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'inactive', active: 'primary', reason: 'Primary timeout.' });
  assert.ok(noticeIds(ctx.api.getState()).includes('api:primary-failed'));
  assert.equal(ctx.api.getState().badge.tone, 'critical');

  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'Using backup.' });
  let state = ctx.api.getState();
  assert.ok(noticeIds(state).includes('api:backup-active'));
  assert.equal(state.notifications.find((n) => n.id === 'api:backup-active').priority, 3);

  ctx.api.setEndpointStatus({ primary: 'healthy', backup: 'inactive', active: 'primary' });
  state = ctx.api.getState();
  assert.equal(noticeIds(state).includes('api:backup-active'), false);
  assert.ok(noticeIds(state).includes('api:primary-restored'));
  assert.equal(state.notifications.find((n) => n.id === 'api:primary-restored').priority, 5);
});

test('published project events update session, endpoint and DNS state without polling', () => {
  const ctx = createContext();
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('youge:session-status', { detail: { state: 'issue', message: 'Session expired.' } }));
  assert.equal(ctx.api.getState().network.session.state, 'issue');
  assert.equal(ctx.api.getState().notifications.find((n) => n.id === 'session:issue').priority, 2);

  ctx.document.dispatchEvent(new ctx.win.CustomEvent('youge:endpoint-status', { detail: { primary: 'failed', backup: 'active', active: 'backup' } }));
  assert.equal(ctx.api.getState().network.endpoints.backup, 'active');

  ctx.document.dispatchEvent(new ctx.win.CustomEvent('youge:dns-result', { detail: { classification: 'dns_records_missing', message: 'No A/AAAA records.' } }));
  assert.equal(ctx.api.getState().network.dns.classification, 'dns_records_missing');
  assert.ok(noticeIds(ctx.api.getState()).includes('dns:failure'));
});

/* ------------------------------------------------------------------ *
 * 8–11. Priority, dismissal, repeats, project scoping
 * ------------------------------------------------------------------ */

test('multiple simultaneous notifications are ordered by the fixed priority ladder', () => {
  const ctx = createContext({
    pwaState: { canInstall: true },
    config: {
      features: [{ id: 'new-insights', label: 'Connection insights', message: 'New capability.' }],
    },
  });
  ctx.win.dispatchEvent({ type: 'offline' });
  ctx.api.setSessionStatus({ state: 'issue', message: 'Session expired.' });
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const state = ctx.api.getState();
  const priorities = state.notifications.map((n) => n.priority);
  assert.deepEqual([...new Set(priorities)], [1, 2, 3, 4, 5]);
  assert.equal(priorities[0], 1);
  assert.equal(priorities[priorities.length - 1], 5);
  assert.equal(state.badge.count, state.notifications.length);
  assert.equal(state.badge.tone, 'critical');
});

test('non-critical suggestions can be dismissed; critical recovery needs acknowledgement', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  assert.equal(ctx.api.dismiss('install:available'), true);
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);
  assert.equal(ctx.api.getState().badge.count, 0);

  ctx.win.dispatchEvent({ type: 'offline' });
  assert.equal(ctx.api.dismiss('network:offline'), false);
  assert.equal(ctx.api.acknowledge('network:offline'), true);
  assert.equal(noticeIds(ctx.api.getState()).includes('network:offline'), false);
});

test('dismissed suggestions stay suppressed until the condition resolves, then can reappear', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  assert.equal(ctx.api.dismiss('install:available'), true);
  ctx.pwa.emitChange();
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);

  // Install the app: the install condition resolves and clears suppression.
  ctx.pwa.state.installed = true;
  ctx.pwa.state.canInstall = false;
  ctx.pwa.emitChange();
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);

  // A later fresh installable state is a new condition and is shown again.
  ctx.pwa.state.installed = false;
  ctx.pwa.state.canInstall = true;
  ctx.pwa.emitChange();
  assert.ok(noticeIds(ctx.api.getState()).includes('install:available'));
});

test('multi-page navigation keeps dismissals through project-scoped storage; projects stay isolated', () => {
  const storage = makeStorage();
  const first = createContext({ storage, pwaState: { canInstall: true }, config: { projectId: 'project-a' } });
  assert.equal(first.api.dismiss('install:available'), true);

  const second = createContext({ storage, pwaState: { canInstall: true }, config: { projectId: 'project-a' } });
  assert.equal(noticeIds(second.api.getState()).includes('install:available'), false, 'dismissal survives navigation');

  second.api.configure({ projectId: 'project-b', branding: { name: 'Project B' } });
  const stateB = second.api.getState();
  assert.equal(stateB.project.id, 'project-b');
  assert.equal(stateB.project.name, 'Project B');
  assert.ok(noticeIds(stateB).includes('install:available'), 'a different project has its own notice state');
  assert.ok(Array.from(storage._map.keys()).some((key) => key.includes('project-a')));
  assert.ok(Array.from(storage._map.keys()).some((key) => key.includes('project-b')));
});

/* ------------------------------------------------------------------ *
 * 12–14. SDK configuration, lifecycle, diagnostics, runtime widget
 * ------------------------------------------------------------------ */

test('SDK configuration controls branding, position, offsets, modules, theme, actions and features', () => {
  const ctx = createContext({
    config: {
      projectId: 'custom-project',
      position: 'bottom-left',
      offsets: { x: 32, y: 40 },
      theme: 'dark',
      branding: { name: 'Custom Brand', shortName: 'Custom', icon: 'icons/icon-192.png', themeColor: '#123456' },
      modules: { failover: false, updates: false },
      actions: [{ id: 'open-help', label: 'Open help', icon: 'help', kind: 'help', priority: 5 }],
      features: [{ id: 'new-capability', label: 'New capability', message: 'Available now.' }],
    },
  });
  const state = ctx.api.getState();
  assert.equal(state.project.id, 'custom-project');
  assert.equal(state.project.name, 'Custom Brand');
  assert.equal(state.appearance.position, 'bottom-left');
  assert.equal(state.appearance.offsets.x, 32);
  assert.equal(state.appearance.offsets.y, 40);
  assert.equal(state.appearance.theme, 'dark');
  assert.equal(state.capabilities.failover, false);
  assert.equal(state.capabilities.updates, false);
  assert.ok(state.availableActions.some((action) => action.id === 'open-help'));
  assert.ok(noticeIds(state).includes('feature:new-capability'));
  assert.equal(state.notifications.find((n) => n.id === 'feature:new-capability').priority, 5);
});

test('PWA update event produces an update action; app-installed event changes install state', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:update', { detail: {} }));
  let state = ctx.api.getState();
  assert.ok(noticeIds(state).includes('app:update'));
  assert.ok(state.availableActions.some((action) => action.id === 'update'));

  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:installed', { detail: {} }));
  state = ctx.api.getState();
  assert.equal(state.installation.status, 'available'); // PWA.getState still reports not installed
  ctx.pwa.state.installed = true;
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:installed', { detail: {} }));
  assert.equal(ctx.api.getState().installation.status, 'installed');
});

test('diagnostics are single-flight and delegated, never duplicated', async () => {
  const ctx = createContext();
  const first = ctx.api.runDiagnostics();
  const second = ctx.api.runDiagnostics();
  assert.equal(first, second, 'concurrent calls share one promise');
  await Promise.all([first, second]);
  assert.equal(ctx.pwa.calls.diagnostics, 1);
  assert.equal(ctx.api.getState().network.dns.classification, 'normal_connectivity');
});

test('listeners bind once, reconfiguration does not duplicate them, and destroy cleans up', () => {
  const ctx = createContext();
  assert.equal(ctx.win.listenerCount('offline'), 1);
  assert.equal(ctx.document.listenerCount('youge:endpoint-status'), 1);
  ctx.api.configure({ projectId: 'still-one' });
  ctx.api.configure({ projectId: 'still-two' });
  assert.equal(ctx.win.listenerCount('offline'), 1);
  assert.equal(ctx.document.listenerCount('youge:endpoint-status'), 1);
  ctx.api.destroy();
  assert.equal(ctx.win.listenerCount('offline'), 0);
  assert.equal(ctx.document.listenerCount('youge:endpoint-status'), 0);
});

test('state core has no fetch, service worker registration, polling, dashboard host or heavy deps', () => {
  const code = stateSource.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /\.register\s*\(/);
  assert.doesNotMatch(code, /setInterval\s*\(/);
  assert.doesNotMatch(code, /staff\.you\.ge/);
  assert.doesNotMatch(code, /\bimport\s/);
  assert.doesNotMatch(code, /ogl|gsap|three|WebGL/);
});

test('widget CSS enforces fixed placement, safe areas, 44px targets, mobile viewport and reduced motion', () => {
  assert.match(widgetCss, /\.youge-assistant-widget\s*\{[^}]*position:\s*fixed/s);
  assert.match(widgetCss, /env\(safe-area-inset/);
  assert.match(widgetCss, /min-height:\s*44px/);
  assert.match(widgetCss, /max-width:\s*480px/);
  assert.match(widgetCss, /100dvh/);
  assert.match(widgetCss, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(widgetCss, /@keyframes/);
});

test('every participating page integrates the widget; React example uses React Bits + centralized state', () => {
  for (const [label, html] of [['demo', demoHtml], ['example', exampleHtml], ['offline', offlineHtml], ['snippet', snippetHtml]]) {
    assert.match(html, /assistant-state\.js/, `${label} loads centralized state`);
    assert.match(html, /YOU_GE_ASSISTANT_CONFIG/, `${label} initializes SDK configuration`);
  }
  assert.match(demoHtml, /assistant-widget\.js/);
  assert.match(offlineHtml, /assistant-widget\.js/);
  assert.match(snippetHtml, /assistant-widget\.js/);
  assert.match(mainJsx, /useSyncExternalStore/);
  for (const name of ['GlareHover', 'SpotlightCard', 'LatticeLoader']) {
    assert.match(mainJsx, new RegExp(name));
  }
  assert.match(mainJsx, /data-pwa-install/);
  assert.match(mainJsx, /data-pwa-diagnostics/);
});

test('DOM renderer mounts a persistent FAB, does not auto-open, and supports click/Escape/keyboard', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.ok(root, 'floating root is mounted');
  assert.equal(root.getAttribute('data-youge-widget'), '');
  const fab = root.querySelector('[data-role="toggle"]');
  const panel = ctx.document.getElementById('youge-assistant-panel');
  assert.ok(fab && panel);
  assert.equal(panel.hidden, true, 'panel never auto-opens');
  assert.equal(fab.getAttribute('aria-expanded'), 'false');
  assert.equal(fab.getAttribute('aria-controls'), 'youge-assistant-panel');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'false');
  assert.ok(root.querySelector('[role="status"]') || root.querySelector('[aria-live]'));

  fire(ctx.document, fab, 'click');
  assert.equal(panel.hidden, false);
  assert.equal(fab.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.classList.contains('is-open'), true);

  ctx.document.dispatchEvent(Object.assign(new ctx.win.CustomEvent('keydown'), { key: 'Escape', type: 'keydown' }));
  assert.equal(fab.getAttribute('aria-expanded'), 'false');
  widget.destroy();
  assert.equal(widget.getRoot(), null);
  assert.equal(ctx.document.listenerCount('keydown'), 0);
});

test('DOM renderer badge is real, prioritized and updates from centralized state', () => {
  const ctx = createContext({ richDocument: true, config: { modules: { installation: false } } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const badge = root.querySelector('.youge-badge');
  assert.ok(badge, 'badge element is rendered');
  assert.equal(badge.hidden, true, 'no badge when there are no alerts');

  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const state = ctx.api.getState();
  assert.ok(state.badge.count >= 2);
  assert.equal(state.badge.tone, 'critical');
  assert.match(root.querySelector('[data-role="toggle"]').getAttribute('aria-label'), /alerts/);
  assert.equal(badge.hidden, false);
  assert.equal(badge.getAttribute('data-tone'), 'critical');
  widget.destroy();
});

test('DOM renderer dismisses suggestions, acknowledges critical alerts, and dispatches project actions once', () => {
  const ctx = createContext({
    richDocument: true,
    pwaState: { canInstall: true },
    config: { actions: [{ id: 'open-help', label: 'Open help', kind: 'help', priority: 5 }] },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');
  fire(ctx.document, fab, 'click');

  const dismiss = root.querySelector('[data-dismiss="install:available"]');
  assert.ok(dismiss, 'install suggestion has a dismiss control');
  fire(ctx.document, dismiss, 'click');
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);

  ctx.win.dispatchEvent({ type: 'offline' });
  const acknowledge = root.querySelector('[data-acknowledge="network:offline"]');
  assert.ok(acknowledge, 'critical recovery has an acknowledge control');
  assert.equal(ctx.api.dismiss('network:offline'), false);
  fire(ctx.document, acknowledge, 'click');
  assert.equal(noticeIds(ctx.api.getState()).includes('network:offline'), false);

  const actions = [];
  ctx.document.addEventListener('youge:action', (event) => actions.push(event.detail));
  const help = root.querySelector('[data-action="open-help"]');
  assert.ok(help, 'project-specific action is rendered');
  fire(ctx.document, help, 'click');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].id, 'open-help');
  assert.equal(actions[0].source, 'widget');
  widget.destroy();
});

test('install and diagnostics actions delegate once to existing pwa.js, with no duplicate requests', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');
  fire(ctx.document, fab, 'click');

  let installs = 0;
  ctx.document.addEventListener('click', (event) => {
    if (event.target.closest('[data-pwa-install]')) installs += 1;
  });
  const installButton = root.querySelector('[data-pwa-install]');
  assert.ok(installButton);
  assert.equal(installButton.getAttribute('data-action'), 'install');
  fire(ctx.document, installButton, 'click');
  assert.equal(installs, 1, 'pwa.js delegation receives exactly one install click');
  assert.equal(ctx.pwa.calls.install, 0, 'widget does not call promptInstall itself');

  const diagnosticsButton = root.querySelector('[data-pwa-diagnostics]');
  assert.ok(diagnosticsButton);
  assert.equal(diagnosticsButton.getAttribute('data-action'), 'diagnostics');
  fire(ctx.document, diagnosticsButton, 'click');
  assert.equal(ctx.pwa.calls.diagnostics, 0, 'existing diagnostics dialog owns the network check');
  widget.destroy();
});

test('widget renderer has no network, polling, SW registration, auto-open or heavy runtime dependencies', () => {
  const code = widgetSource.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /\.register\s*\(/);
  assert.doesNotMatch(code, /setInterval\s*\(/);
  assert.doesNotMatch(code, /\bimport\s/);
  assert.doesNotMatch(code, /ogl|gsap|three|WebGL/);
  assert.doesNotMatch(code, /staff\.you\.ge/);
  assert.match(code, /api\.subscribe\(onState\)/);
  assert.match(code, /api\.subscribe\(onState\)/);
  const afterOnState = code.split('function onState')[1] || '';
  assert.doesNotMatch(afterOnState, /openPanel\(\s*\);/, 'state updates never open the panel');
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): working notice actions, Escape ownership,
 * defensive appearance handling and touch/contrast CSS floors
 * ------------------------------------------------------------------ */

test('a diagnostics notice exposes a working toolkit action instead of an inert button', () => {
  const ctx = createContext({ richDocument: true });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  ctx.api.setDnsResult({ status: 'complete', classification: 'dns_resolution_failure', message: 'NXDOMAIN for this hostname.' });
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');

  const action = root.querySelector('[data-pwa-diagnostics]');
  assert.ok(action, 'the notice action carries the delegated diagnostics hook');
  assert.equal(action.getAttribute('data-action'), 'diagnostics');
  assert.match(action.querySelector('.youge-btn-label').textContent, /diagnostics/i);
  widget.destroy();
});

test('an install notice action reuses the toolkit install flow and its real wording', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');

  const noticeButton = root.querySelectorAll('[data-pwa-install]').find((node) => node.matches('.youge-btn-small'));
  assert.ok(noticeButton, 'the notice itself has an install action, not only the section below it');
  assert.equal(noticeButton.getAttribute('data-action'), 'install');
  assert.match(noticeButton.querySelector('.youge-btn-label').textContent, /Install this app/, 'wording comes from the real capability');
  widget.destroy();
});

test('Escape stays with an open toolkit dialog and still closes the panel on its own', () => {
  const ctx = createContext({ richDocument: true });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const panel = ctx.document.getElementById('youge-assistant-panel');
  const escape = () => ctx.document.dispatchEvent(Object.assign(new ctx.win.CustomEvent('keydown'), { key: 'Escape', type: 'keydown' }));

  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');
  assert.equal(panel.hidden, false, 'panel opens');

  const flow = ctx.document.createElement('div');
  flow.classList.add('pwa-flow');
  ctx.document.body.appendChild(flow);
  escape();
  assert.equal(panel.hidden, false, 'Escape while a toolkit dialog is on top must not close the panel behind it');

  ctx.document.body.removeChild(flow);
  escape();
  assert.equal(root.querySelector('[data-role="toggle"]').getAttribute('aria-expanded'), 'false', 'Escape still closes the panel when nothing else is open');
  widget.destroy();
});

test('hand-built appearance values are re-validated before they reach the DOM', () => {
  const ctx = createContext({ richDocument: true });
  const state = {
    enabled: true,
    project: { name: 'Odd Host', hostname: 'host.test' },
    network: { online: true, endpoints: {}, dns: {} },
    installation: { status: 'unavailable', support: 'none' },
    notifications: [],
    availableActions: [],
    badge: { count: 0, tone: 'none', label: 'No alerts' },
    appearance: {
      position: 'middle-right',
      theme: 'neon',
      offsets: { x: 'lots' },
      themeColor: 'red; background-image: url(//evil.test/x)',
    },
  };
  ctx.win.YouGeAssistant = { getState: () => state, subscribe(fn) { fn(state); return () => {}; } };
  const widget = loadWidget(ctx);
  const root = widget.getRoot();

  assert.equal(root.getAttribute('data-position'), 'bottom-right', 'unsupported positions fall back');
  assert.equal(root.getAttribute('data-theme'), 'auto', 'unsupported themes fall back');
  assert.equal(root.style['--youge-offset-x'], '20px', 'a non-numeric offset never becomes "undefinedpx"');
  assert.equal(root.style['--youge-offset-y'], '20px');
  assert.equal(root.style['--youge-brand'], undefined, 'only a plain hex color may set the brand token');
  widget.destroy();
});

test('widget CSS holds the touch-target floor and dark-mode badge contrast', () => {
  assert.match(widgetCss, /\.youge-btn-small \{[^}]*min-height:\s*44px/, 'small notice buttons stay 44px targets');
  assert.match(widgetCss, /\.youge-badge\[data-tone="auth"\] \{ background: var\(--youge-auth\); color: #ffffff; \}/, 'light auth badge clears AA');
  assert.match(widgetCss, /\[data-theme="dark"\] \.youge-badge\[data-tone="auth"\]/, 'explicit dark theme flips badge ink');
  assert.match(widgetCss, /\[data-theme="auto"\] \.youge-badge\[data-tone="auth"\]/, 'auto dark theme must flip badge ink too');
});
