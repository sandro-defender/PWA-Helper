export interface DnsDiagnosticSnapshot {
  status: string;
  classification: string;
  message: string;
  checkedAt: string | null;
  failed?: boolean;
}

export interface DiagnosticsContext {
  hostname?: string;
  origin?: string;
  basePath?: string;
  online?: boolean;
}

export interface DiagnosticsIntegrationOptions {
  services?: {
    diagnostics?: ((options?: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
  };
  pwa?: {
    runNetworkDiagnostics?: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  } | null;
  getPwa?: () => { runNetworkDiagnostics?: (options?: Record<string, unknown>) => Promise<Record<string, unknown>> } | null;
  dns?: {
    check?: (context: DiagnosticsContext, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  } | null;
  getDns?: () => { check?: (context: DiagnosticsContext, options?: Record<string, unknown>) => Promise<Record<string, unknown>> } | null;
  context?: DiagnosticsContext;
  getContext?: () => DiagnosticsContext;
  onStart?: () => void;
  onResult?: (result: Record<string, unknown>) => void;
}

export interface DiagnosticsController {
  run(runOptions?: Record<string, unknown>): Promise<Record<string, unknown>>;
  clear(): void;
  isRunning(): boolean;
}

export declare function dnsFailure(dns?: Partial<DnsDiagnosticSnapshot> | null): boolean;
export declare function connectivityFailure(dns?: Partial<DnsDiagnosticSnapshot> | null): boolean;
export declare function normalizeDnsResult(result?: Record<string, unknown> | null, DateCtor?: DateConstructor): DnsDiagnosticSnapshot;
export declare function resolveDiagnosticsRunner(
  options?: DiagnosticsIntegrationOptions
): ((runOptions?: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
export declare function createDiagnosticsIntegration(options?: DiagnosticsIntegrationOptions): DiagnosticsController;
