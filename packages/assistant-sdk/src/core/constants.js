/*!
 * @you-ge/assistant-sdk — core constants
 */

export const SDK_VERSION = '0.1.0';
export const KIT_COMPAT_VERSION = '1.0.5';
export const SCHEMA_VERSION = 1;

export const PRIORITY = { critical: 1, auth: 2, backup: 3, install: 4, info: 5 };
Object.freeze(PRIORITY);

export const TONE = { 1: 'critical', 2: 'auth', 3: 'backup', 4: 'install', 5: 'info' };
Object.freeze(TONE);

export const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
Object.freeze(POSITIONS);

export const THEMES = ['auto', 'light', 'dark'];
Object.freeze(THEMES);

export const ICONS = ['install', 'diagnostics', 'recovery', 'backup', 'help', 'info', 'update', 'custom'];
Object.freeze(ICONS);

export const EVENT_NAMES = {
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

export const STORAGE_PREFIXES = {
  notices: 'youge-assistant:notices:',
  lastKnownGood: 'youge-assistant:lkg:',
};
Object.freeze(STORAGE_PREFIXES);
