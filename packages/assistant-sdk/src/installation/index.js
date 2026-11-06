/*!
 * @youge/assistant-sdk/installation — PWA installation integration
 * -----------------------------------------------------------------
 * Reuses the existing window.PWA installation experience. It never registers
 * a service worker, never captures beforeinstallprompt in competition with
 * pwa.js, and never claims programmatic installation without a browser prompt.
 */

export function readPwaSnapshot(pwa) {
  let state = {};
  if (!pwa) return state;
  try {
    if (typeof pwa.getState === 'function') state = pwa.getState() || {};
  } catch (error) {
    state = {};
  }
  return state;
}

export function deriveInstallationState(options) {
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

export function requestPwaInstall(options, promptOptions) {
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
