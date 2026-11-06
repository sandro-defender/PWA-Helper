export interface DomainIdentity {
  name: string;
  shortName: string;
  description: string;
}

export interface DomainManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

export interface DomainBranding {
  themeColor: string;
  backgroundColor: string;
  iconSet: string;
  icon: string;
  appleTouchIcon: string;
  splashIcon: string;
  favicon: string;
  icons: DomainManifestIcon[];
}

export interface DomainPwaSettings {
  enabled: boolean;
  startUrl: string;
  scope: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  id: string;
  basePath?: string | null;
}

export interface DomainFeatures {
  installation: boolean;
  offline: boolean;
  sharing: boolean;
  push: boolean;
  badges: boolean;
  qr: boolean;
  diagnostics: boolean;
  dnsRecovery: boolean;
}

export interface DomainShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: DomainManifestIcon[];
}

export interface DomainContext {
  hostname: string;
  origin: string;
  protocol: string;
  subdomain: string;
  rootDomain: string;
  pathname: string;
  basePath: string;
  installOrigin: string;
  matchedRegistryKey: string | null;
  configured: boolean;
}

export interface DomainRegistryEntry {
  identity?: Partial<DomainIdentity>;
  branding?: Partial<DomainBranding>;
  pwa?: Partial<DomainPwaSettings>;
  features?: Partial<DomainFeatures>;
  instructions?: Record<string, unknown>;
  metadata?: Record<string, string>;
  shortcuts?: DomainShortcut[];
  diagnostics?: {
    appProbePath?: string;
    backendProbePath?: string;
  };
}

export type DomainRegistry = Record<string, DomainRegistryEntry>;

export interface LocationInput {
  hostname?: string;
  origin?: string;
  protocol?: string;
  pathname?: string;
  basePath?: string;
  port?: string;
}

export interface ResolvedDomainConfig {
  identity: DomainIdentity;
  branding: DomainBranding;
  pwa: DomainPwaSettings;
  features: DomainFeatures;
  instructions: Record<string, unknown>;
  metadata: Record<string, string>;
  shortcuts: DomainShortcut[];
  domain: DomainContext;
}

export interface GeneratedWebManifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  dir: string;
  icons: DomainManifestIcon[];
  categories: string[];
  prefer_related_applications: boolean;
  shortcuts: DomainShortcut[];
  share_target?: {
    action: string;
    method: string;
    enctype: string;
    params: Record<string, unknown>;
  };
}

export interface DomainResolver {
  defaults: Omit<ResolvedDomainConfig, 'domain' | 'shortcuts'>;
  resolve(locationLike?: LocationInput | string, overrideRegistry?: DomainRegistry): ResolvedDomainConfig;
  manifest(config?: ResolvedDomainConfig): GeneratedWebManifest;
  normalizeHost(value: string): string;
  normalizePath(value?: string, fallback?: string): string | null;
  rootDomain(hostname: string): string;
  validateConfig(raw?: DomainRegistryEntry | null): Omit<ResolvedDomainConfig, 'domain'>;
  setRegistry(nextRegistry: DomainRegistry): void;
  getRegistry(): DomainRegistry;
}

export declare const DOMAIN_DEFAULTS: Omit<ResolvedDomainConfig, 'domain' | 'shortcuts'>;
export declare function normalizeHost(value?: string): string;
export declare function isIpAddress(hostname: string): boolean;
export declare function rootDomain(hostname: string): string;
export declare function normalizePath(value?: string, fallback?: string): string | null;
export declare function validateDomainConfig(raw?: DomainRegistryEntry | null): Omit<ResolvedDomainConfig, 'domain'>;
export declare function resolveDomain(locationLike?: LocationInput | string, optionalRegistry?: DomainRegistry): ResolvedDomainConfig;
export declare function buildManifest(config?: ResolvedDomainConfig): GeneratedWebManifest;
export declare function createDomainResolver(initialRegistry?: DomainRegistry): DomainResolver;
