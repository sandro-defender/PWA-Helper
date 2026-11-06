/*!
 * @you-ge/assistant-sdk — public entry point
 * ------------------------------------------
 * Framework-independent SDK core for You.Ge Assistant.
 */

import {
  EVENT_NAMES,
  ICONS,
  KIT_COMPAT_VERSION,
  POSITIONS,
  PRIORITY,
  SCHEMA_VERSION,
  SDK_VERSION,
  STORAGE_PREFIXES,
  THEMES,
  TONE,
} from './core/constants.js';
import {
  BUNDLED_DEFAULTS,
  lkgStorageKey,
  loadLastKnownGood,
  normalizeActions,
  normalizeConfig,
  normalizeFeatures,
  resolveAssistantConfig,
  saveLastKnownGood,
  validatePublishedConfig,
} from './config/index.js';
import {
  DOMAIN_DEFAULTS,
  buildManifest,
  createDomainResolver,
  isIpAddress,
  normalizeHost,
  normalizePath,
  resolveDomain,
  rootDomain,
  safeNavigationUrl,
  validateDomainConfig,
} from './domain/index.js';
import {
  connectivityFailure,
  createDiagnosticsIntegration,
  dnsFailure,
  normalizeDnsResult,
  resolveDiagnosticsRunner,
} from './diagnostics/index.js';
import {
  deriveInstallationState,
  readPwaSnapshot,
  requestPwaInstall,
} from './installation/index.js';
import {
  attachAssistant,
  createAssistant,
  getGlobalAssistant,
} from './assistant/index.js';
import {
  bridgePwaGlobals,
  readToolkitSummary,
} from './adapters/pwa-kit.js';

export const YouGeAssistant = Object.freeze({
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
  validatePublishedConfig: validatePublishedConfig,
});

export {
  SDK_VERSION,
  KIT_COMPAT_VERSION,
  SCHEMA_VERSION,
  PRIORITY,
  TONE,
  POSITIONS,
  THEMES,
  ICONS,
  EVENT_NAMES,
  STORAGE_PREFIXES,
  BUNDLED_DEFAULTS,
  normalizeActions,
  normalizeFeatures,
  normalizeConfig,
  validatePublishedConfig,
  lkgStorageKey,
  loadLastKnownGood,
  saveLastKnownGood,
  resolveAssistantConfig,
  DOMAIN_DEFAULTS,
  normalizeHost,
  isIpAddress,
  rootDomain,
  normalizePath,
  validateDomainConfig,
  resolveDomain,
  safeNavigationUrl,
  buildManifest,
  createDomainResolver,
  dnsFailure,
  connectivityFailure,
  normalizeDnsResult,
  resolveDiagnosticsRunner,
  createDiagnosticsIntegration,
  readPwaSnapshot,
  deriveInstallationState,
  requestPwaInstall,
  createAssistant,
  attachAssistant,
  getGlobalAssistant,
  bridgePwaGlobals,
  readToolkitSummary,
};

export default YouGeAssistant;
