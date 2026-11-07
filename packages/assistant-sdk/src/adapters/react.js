/*!
 * @youge/assistant-sdk/react — optional React external-store adapter
 * -------------------------------------------------------------------
 * Zero runtime dependency on 'react'. Pass React's useSyncExternalStore hook
 * from the host application so the SDK core and package remain completely
 * framework-independent while giving React 18/19 apps tear-free subscriptions,
 * referentially stable selector caching, and SSR snapshot support.
 */

import { EVENT_NAMES } from '../core/constants.js';
import { attachAssistant } from '../assistant/index.js';

export const FALLBACK_ASSISTANT_STATE = Object.freeze({
  enabled: true,
  project: Object.freeze({
    id: 'assistant',
    name: 'You.Ge Assistant',
    shortName: 'You.Ge',
    hostname: 'localhost',
    origin: 'https://localhost',
    basePath: '/',
    icon: 'icons/icon-192.png',
    themeColor: '#155eef',
    configured: false,
  }),
  installation: Object.freeze({
    status: 'unavailable',
    support: 'none',
    canInstall: false,
    nativeAvailable: false,
    installed: false,
    standalone: false,
    ios: false,
    safari: false,
    platform: 'generic',
  }),
  network: Object.freeze({
    online: true,
    dns: Object.freeze({ status: 'idle', classification: 'unknown', message: '', checkedAt: null }),
    endpoints: Object.freeze({ primary: 'unknown', backup: 'inactive', active: 'primary', reason: '' }),
    session: Object.freeze({ state: 'unknown', message: '' }),
    updateAvailable: false,
    recovery: false,
  }),
  capabilities: Object.freeze({
    installation: true,
    diagnostics: true,
    recovery: true,
    failover: true,
    help: true,
    updates: true,
    chromeHandoff: true,
  }),
  notifications: Object.freeze([]),
  availableActions: Object.freeze([]),
  badge: Object.freeze({ count: 0, tone: 'none', label: 'No alerts', priority: null }),
  appearance: Object.freeze({ position: 'bottom-right', offsets: Object.freeze({ x: 20, y: 20 }), theme: 'auto', themeColor: '#155eef' }),
  dismissed: Object.freeze([]),
  acknowledged: Object.freeze([]),
});

export function getExternalStoreBindings(assistantOrGetter, selector, fallbackState) {
  const fallback = fallbackState || FALLBACK_ASSISTANT_STATE;
  const resolve = typeof assistantOrGetter === 'function'
    ? assistantOrGetter
    : function () { return assistantOrGetter || attachAssistant(); };

  // A getter may attach/configure the assistant, which emits a brand-new
  // snapshot. `getSnapshot` runs on every render, so the resolved instance is
  // memoized: re-resolving per render would re-configure per render and make
  // `useSyncExternalStore` loop forever.
  let cachedInstance = null;
  function resolveInstance() {
    if (cachedInstance && !(typeof cachedInstance.isDestroyed === 'function' && cachedInstance.isDestroyed())) {
      return cachedInstance;
    }
    const instance = resolve();
    if (instance) cachedInstance = instance;
    return instance || null;
  }

  let hasCached = false;
  let lastState = null;
  let lastSelected = undefined;

  function selectFrom(rawState) {
    const state = rawState || fallback;
    if (typeof selector !== 'function') return state;
    if (hasCached && state === lastState) return lastSelected;
    const nextSelected = selector(state);
    if (hasCached && Object.is(lastSelected, nextSelected)) {
      lastState = state;
      return lastSelected;
    }
    hasCached = true;
    lastState = state;
    lastSelected = nextSelected;
    return nextSelected;
  }

  return {
    subscribe: function (onStoreChange) {
      const instance = resolveInstance();
      if (!instance || typeof instance.subscribe !== 'function') return function () {};
      return instance.subscribe(onStoreChange, { immediate: false });
    },
    getSnapshot: function () {
      const instance = resolveInstance();
      const current = instance && typeof instance.getState === 'function' ? instance.getState() : null;
      return selectFrom(current);
    },
    getServerSnapshot: function () {
      return selectFrom(fallback);
    },
  };
}

export function createUseAssistant(useSyncExternalStore, assistantOrGetter, fallbackState) {
  if (typeof useSyncExternalStore !== 'function') {
    throw new TypeError('createUseAssistant requires React useSyncExternalStore');
  }
  const baseBindings = getExternalStoreBindings(assistantOrGetter, null, fallbackState);

  return function useAssistant(selector) {
    const state = useSyncExternalStore(
      baseBindings.subscribe,
      baseBindings.getSnapshot,
      baseBindings.getServerSnapshot
    );
    return typeof selector === 'function' ? selector(state) : state;
  };
}

export function dispatchAssistantAction(id, kind, options) {
  const opts = options || {};
  const root = opts.root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const doc = opts.document || root.document || null;
  const assistant = opts.assistant || (root.YouGeAssistant && root.YouGeAssistant.__state ? root.YouGeAssistant : null);
  const pwa = opts.pwa || root.PWA || null;
  const source = opts.source || 'react-widget';

  if (doc && typeof doc.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
    doc.dispatchEvent(new root.CustomEvent(EVENT_NAMES.action, {
      detail: { id: id, kind: kind || 'custom', source: source },
    }));
  }
  if (id === 'update' && pwa && typeof pwa.applyUpdate === 'function') {
    pwa.applyUpdate();
  }
  if (id === 'diagnostics' && (!pwa || typeof pwa.showNetworkDiagnostics !== 'function') && assistant && typeof assistant.runDiagnostics === 'function') {
    assistant.runDiagnostics();
  }
}

export function createReactAdapter(options) {
  const opts = options || {};
  if (typeof opts.useSyncExternalStore !== 'function') {
    throw new TypeError('createReactAdapter requires { useSyncExternalStore } from React');
  }
  let cachedAdapterAssistant = null;
  const resolveAssistant = function () {
    if (cachedAdapterAssistant) return cachedAdapterAssistant;
    cachedAdapterAssistant = opts.assistant || attachAssistant(opts.config, opts.env);
    return cachedAdapterAssistant;
  };
  const useAssistant = createUseAssistant(
    opts.useSyncExternalStore,
    resolveAssistant,
    opts.fallbackState
  );

  return {
    getAssistant: resolveAssistant,
    useAssistant: useAssistant,
    dispatchAction: function (id, kind) {
      return dispatchAssistantAction(id, kind, {
        assistant: resolveAssistant(),
        source: opts.source || 'react-widget',
        root: opts.env && opts.env.root,
      });
    },
  };
}
