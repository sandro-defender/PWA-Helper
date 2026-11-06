import type {
  AssistantAction,
  AssistantActionIcon,
  AssistantActionInput,
  AssistantBrandingConfig,
  AssistantConfigInput,
  AssistantConfigMeta,
  AssistantFeature,
  AssistantFeatureInput,
  AssistantModulesConfig,
  AssistantNotificationsConfig,
  AssistantOffsets,
  AssistantPosition,
  AssistantTheme,
  PublishedAssistantConfig,
  PublishedValidationResult,
  ResolvedAssistantConfig,
  StorageLike,
} from './config/index.js';
import type {
  DomainBranding,
  DomainContext,
  DomainFeatures,
  DomainIdentity,
  DomainManifestIcon,
  DomainPwaSettings,
  DomainRegistry,
  DomainRegistryEntry,
  DomainResolver,
  DomainShortcut,
  GeneratedWebManifest,
  LocationInput,
  ResolvedDomainConfig,
} from './domain/index.js';
import type {
  DiagnosticsContext,
  DiagnosticsController,
  DiagnosticsIntegrationOptions,
  DnsDiagnosticSnapshot,
} from './diagnostics/index.js';
import type {
  AssistantInstallationState,
  InstallationStatus,
  InstallationSupport,
  PwaRuntimeLike,
} from './installation/index.js';

export type {
  AssistantAction,
  AssistantActionIcon,
  AssistantActionInput,
  AssistantBrandingConfig,
  AssistantConfigInput,
  AssistantConfigMeta,
  AssistantFeature,
  AssistantFeatureInput,
  AssistantInstallationState,
  AssistantModulesConfig,
  AssistantNotificationsConfig,
  AssistantOffsets,
  AssistantPosition,
  AssistantTheme,
  DiagnosticsContext,
  DiagnosticsController,
  DiagnosticsIntegrationOptions,
  DnsDiagnosticSnapshot,
  DomainBranding,
  DomainContext,
  DomainFeatures,
  DomainIdentity,
  DomainManifestIcon,
  DomainPwaSettings,
  DomainRegistry,
  DomainRegistryEntry,
  DomainResolver,
  DomainShortcut,
  GeneratedWebManifest,
  InstallationStatus,
  InstallationSupport,
  LocationInput,
  PublishedAssistantConfig,
  PublishedValidationResult,
  PwaRuntimeLike,
  ResolvedAssistantConfig,
  ResolvedDomainConfig,
  StorageLike,
};

export type NotificationTone = 'critical' | 'auth' | 'backup' | 'install' | 'info';
export type PrimaryEndpointState = 'unknown' | 'healthy' | 'failed' | 'unavailable' | 'degraded';
export type BackupEndpointState = 'unknown' | 'active' | 'inactive' | 'failed';
export type ActiveEndpointTarget = 'primary' | 'backup' | 'unknown';
export type SessionConditionState = 'unknown' | 'ok' | 'issue';

export interface AssistantProjectInfo {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  themeColor: string;
  hostname: string;
  origin: string;
  basePath: string;
  configured: boolean;
}

export interface AssistantEndpointsState {
  primary: PrimaryEndpointState;
  backup: BackupEndpointState;
  active: ActiveEndpointTarget;
  reason: string;
}

export interface AssistantSessionState {
  state: SessionConditionState;
  message: string;
}

export interface AssistantNetworkState {
  online: boolean;
  dns: DnsDiagnosticSnapshot;
  endpoints: AssistantEndpointsState;
  session: AssistantSessionState;
  updateAvailable: boolean;
  recovery: boolean;
}

export interface AssistantNotification {
  id: string;
  priority: number;
  tone: NotificationTone;
  critical: boolean;
  dismissible: boolean;
  title: string;
  message: string;
  actionId?: string;
}

export interface AssistantBadgeState {
  count: number;
  tone: NotificationTone | 'none';
  label: string;
  priority: number | null;
}

export interface AssistantAppearanceState {
  position: AssistantPosition;
  offsets: AssistantOffsets;
  theme: AssistantTheme;
  themeColor: string;
}

export interface AssistantState {
  enabled: boolean;
  project: AssistantProjectInfo;
  installation: AssistantInstallationState;
  network: AssistantNetworkState;
  capabilities: AssistantModulesConfig;
  notifications: AssistantNotification[];
  availableActions: AssistantAction[];
  badge: AssistantBadgeState;
  appearance: AssistantAppearanceState;
  dismissed: string[];
  acknowledged: string[];
}

export interface AssistantEnvironment {
  root?: Record<string, unknown>;
  window?: Record<string, unknown>;
  document?: Document | Record<string, unknown> | null;
  location?: LocationInput;
  navigator?: { onLine?: boolean } | null;
  storage?: StorageLike | null;
  pwa?: PwaRuntimeLike | null;
  dns?: { check?: (context: DiagnosticsContext, options?: Record<string, unknown>) => Promise<Record<string, unknown>> } | null;
  domainResolver?: Pick<DomainResolver, 'resolve'> | null;
  domainRegistry?: DomainRegistry;
  bindEvents?: boolean;
  exposeGlobal?: boolean;
  useGlobalConfig?: boolean;
}

export interface CreateAssistantOptions extends AssistantConfigInput {
  env?: AssistantEnvironment;
  location?: LocationInput;
  storage?: StorageLike | null;
  pwa?: PwaRuntimeLike | null;
  dns?: AssistantEnvironment['dns'];
  domainResolver?: AssistantEnvironment['domainResolver'];
  bindEvents?: boolean;
  exposeGlobal?: boolean;
}

export interface AssistantConfigSummary {
  enabled: boolean;
  projectId: string;
  domain: string;
  position: AssistantPosition;
  offsets: AssistantOffsets;
  modules: AssistantModulesConfig;
  notifications: AssistantNotificationsConfig;
  branding: AssistantBrandingConfig;
  actions: AssistantAction[];
  features: AssistantFeature[];
  theme: AssistantTheme;
  meta: AssistantConfigMeta;
}

export interface EndpointStatusInput {
  primary?: PrimaryEndpointState;
  backup?: BackupEndpointState;
  active?: ActiveEndpointTarget;
  reason?: string;
}

export interface SessionStatusInput {
  state?: SessionConditionState;
  message?: string;
}

export interface AssistantInstance {
  readonly __state: true;
  readonly version: string;
  readonly PRIORITY: Readonly<{ critical: 1; auth: 2; backup: 3; install: 4; info: 5 }>;
  create(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  attach(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  configure(nextOptions?: AssistantConfigInput): AssistantState;
  getConfig(): AssistantConfigSummary;
  getState(): AssistantState;
  subscribe(listener: (state: AssistantState) => void, options?: { immediate?: boolean }): () => void;
  setConnectivity(online: boolean): AssistantState;
  setEndpointStatus(detail: EndpointStatusInput): AssistantState;
  setSessionStatus(detail: SessionStatusInput): AssistantState;
  setDnsResult(result: Record<string, unknown>): AssistantState;
  setUpdateAvailable(available?: boolean): AssistantState;
  runDiagnostics(options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  requestInstall(options?: Record<string, unknown>): Promise<{ outcome: string }>;
  dismiss(id: string): boolean;
  acknowledge(id: string): boolean;
  isDestroyed(): boolean;
  destroy(): void;
}

export interface YouGeAssistantStatic {
  readonly version: string;
  readonly kitCompatVersion: string;
  readonly schemaVersion: number;
  readonly PRIORITY: Readonly<{ critical: 1; auth: 2; backup: 3; install: 4; info: 5 }>;
  readonly EVENT_NAMES: Readonly<Record<string, string>>;
  create(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  attach(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  getGlobal(targetRoot?: Record<string, unknown>): AssistantInstance | null;
  resolveDomain(locationLike?: LocationInput | string, optionalRegistry?: DomainRegistry): ResolvedDomainConfig;
  buildManifest(config?: ResolvedDomainConfig): GeneratedWebManifest;
  validatePublishedConfig(rawInput: unknown, options?: { expectedProjectId?: string }): PublishedValidationResult;
}

export interface ToolkitSummary {
  hasPwaToolkit: boolean;
  hasAssistantState: boolean;
  pwaVersion: string | null;
  sdkVersion: string;
  origin: string;
  hostname: string;
  installation: AssistantInstallationState;
}

export declare const SDK_VERSION: string;
export declare const KIT_COMPAT_VERSION: string;
export declare const SCHEMA_VERSION: number;
export declare const PRIORITY: Readonly<{ critical: 1; auth: 2; backup: 3; install: 4; info: 5 }>;
export declare const TONE: Readonly<{ 1: 'critical'; 2: 'auth'; 3: 'backup'; 4: 'install'; 5: 'info' }>;
export declare const POSITIONS: readonly AssistantPosition[];
export declare const THEMES: readonly AssistantTheme[];
export declare const ICONS: readonly AssistantActionIcon[];
export declare const EVENT_NAMES: Readonly<Record<string, string>>;
export declare const STORAGE_PREFIXES: Readonly<{ notices: string; lastKnownGood: string }>;

export {
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

export {
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

export {
  connectivityFailure,
  createDiagnosticsIntegration,
  dnsFailure,
  normalizeDnsResult,
  resolveDiagnosticsRunner,
} from './diagnostics/index.js';

export {
  deriveInstallationState,
  readPwaSnapshot,
  requestPwaInstall,
} from './installation/index.js';

export declare function createAssistant(
  initialOptions?: CreateAssistantOptions,
  envOverrides?: AssistantEnvironment
): AssistantInstance;

export declare function attachAssistant(
  options?: CreateAssistantOptions,
  envOverrides?: AssistantEnvironment
): AssistantInstance;

export declare function getGlobalAssistant(targetRoot?: Record<string, unknown>): AssistantInstance | null;

export declare function bridgePwaGlobals(options?: {
  root?: Record<string, unknown>;
  window?: Record<string, unknown>;
  domainRegistry?: DomainRegistry;
  assistantConfig?: CreateAssistantOptions;
  attach?: boolean;
}): {
  bridged: boolean;
  assistant: AssistantInstance | null;
  domain: DomainResolver | null;
};

export declare function readToolkitSummary(targetRoot?: Record<string, unknown>): ToolkitSummary;

export declare const YouGeAssistant: YouGeAssistantStatic;
export default YouGeAssistant;
