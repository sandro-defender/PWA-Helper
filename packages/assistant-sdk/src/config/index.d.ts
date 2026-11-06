import type { DomainRegistry } from '../domain/index.js';

export type AssistantPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type AssistantTheme = 'auto' | 'light' | 'dark';
export type AssistantActionIcon = 'install' | 'diagnostics' | 'recovery' | 'backup' | 'help' | 'info' | 'update' | 'custom';

export interface AssistantOffsets {
  x: number;
  y: number;
}

export interface AssistantModulesConfig {
  installation: boolean;
  diagnostics: boolean;
  recovery: boolean;
  failover: boolean;
  help: boolean;
  updates: boolean;
}

export interface AssistantNotificationsConfig {
  dismissible: boolean;
  suppressRepeats: boolean;
  criticalPersistent: boolean;
}

export interface AssistantBrandingConfig {
  name: string;
  shortName: string;
  icon: string;
  themeColor: string;
}

export interface AssistantActionInput {
  id: string;
  label?: string;
  message?: string;
  icon?: AssistantActionIcon;
  priority?: number;
  kind?: 'help' | 'custom';
}

export interface AssistantAction {
  id: string;
  label: string;
  message: string;
  icon: AssistantActionIcon;
  priority: number;
  kind: 'help' | 'custom' | 'diagnostics' | 'recovery' | 'install' | 'backup' | 'update';
  event: string;
}

export interface AssistantFeatureInput {
  id: string;
  label?: string;
  message?: string;
}

export interface AssistantFeature {
  id: string;
  label: string;
  message: string;
}

export interface PublishedAssistantConfig {
  schemaVersion?: number | string;
  revision?: string;
  publishedAt?: string;
  projectId?: string;
  enabled?: boolean;
  domain?: string;
  position?: AssistantPosition;
  offsets?: Partial<AssistantOffsets>;
  modules?: Partial<AssistantModulesConfig>;
  notifications?: Partial<AssistantNotificationsConfig>;
  branding?: Partial<AssistantBrandingConfig>;
  actions?: AssistantActionInput[];
  features?: AssistantFeatureInput[];
  theme?: AssistantTheme;
  domainRegistry?: DomainRegistry;
  config?: Omit<PublishedAssistantConfig, 'schemaVersion' | 'revision' | 'publishedAt' | 'config'>;
}

export interface AssistantConfigInput {
  enabled?: boolean;
  projectId?: string;
  domain?: string;
  position?: AssistantPosition;
  offsets?: Partial<AssistantOffsets>;
  modules?: Partial<AssistantModulesConfig>;
  notifications?: Partial<AssistantNotificationsConfig>;
  branding?: Partial<AssistantBrandingConfig>;
  actions?: AssistantActionInput[];
  features?: AssistantFeatureInput[];
  theme?: AssistantTheme;
  domainRegistry?: DomainRegistry;
  publishedConfig?: PublishedAssistantConfig | string | null;
  useLastKnownGood?: boolean;
  services?: {
    diagnostics?: (() => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
  };
}

export interface ResolvedAssistantConfig {
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
  domainRegistry: DomainRegistry | null;
  services: {
    diagnostics: (() => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
  };
}

export interface AssistantConfigMeta {
  schemaVersion: number;
  source: 'defaults' | 'published' | 'last-known-good' | 'overrides';
  revision: string;
  publishedAt: string;
  usedLastKnownGood: boolean;
  warnings: string[];
}

export interface PublishedValidationResult {
  valid: boolean;
  reason?: string;
  secretKeys?: string[];
  schemaVersion?: number;
  revision?: string;
  publishedAt?: string;
  projectId?: string;
  config?: Partial<ResolvedAssistantConfig>;
  warnings: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export declare const BUNDLED_DEFAULTS: Omit<ResolvedAssistantConfig, 'domainRegistry' | 'services'>;
export declare function normalizeActions(raw?: unknown): AssistantAction[];
export declare function normalizeFeatures(raw?: unknown): AssistantFeature[];
export declare function validatePublishedConfig(
  rawInput: unknown,
  options?: { expectedProjectId?: string }
): PublishedValidationResult;
export declare function lkgStorageKey(projectId: string): string;
export declare function loadLastKnownGood(storage: StorageLike | null | undefined, projectId: string): PublishedValidationResult | null;
export declare function saveLastKnownGood(storage: StorageLike | null | undefined, projectId: string, validatedRecord: PublishedValidationResult): boolean;
export declare function normalizeConfig(raw?: AssistantConfigInput): ResolvedAssistantConfig;
export declare function resolveAssistantConfig(
  rawInput?: AssistantConfigInput,
  context?: { storage?: StorageLike | null; fallbackProjectId?: string }
): { config: ResolvedAssistantConfig; meta: AssistantConfigMeta };
