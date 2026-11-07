/**
 * Adaptive theming — public types for `@youge/assistant-sdk`.
 *
 * `theme` is a single configuration surface: a mode plus optional validated
 * tokens. It is accepted both as the original string form
 * (`'auto' | 'light' | 'dark'`) and as the object form below.
 */

export type ThemeMode = 'auto' | 'light' | 'dark' | 'custom';
export type ResolvedColorScheme = 'light' | 'dark';

export type ThemeColorToken =
  | 'primary'
  | 'onPrimary'
  | 'background'
  | 'surface'
  | 'surfaceSoft'
  | 'text'
  | 'mutedText'
  | 'border'
  | 'focus'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

export type ThemeStructureToken =
  | 'fontFamily'
  | 'fontSize'
  | 'radius'
  | 'radiusSmall'
  | 'borderWidth'
  | 'shadow';

export type ThemeToken = ThemeColorToken | ThemeStructureToken;

/**
 * Theme tokens. Colours accept `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`hsl()`
 * or one of the SDK's own `var(--youge-…)` references; lengths accept a number
 * (interpreted as px and clamped) or a `px` string; `shadow` accepts a bounded
 * CSS box-shadow. Invalid values are dropped per token and reported in
 * `getConfig().meta.warnings` — they never throw.
 */
export interface AssistantThemeTokens {
  primary?: string;
  onPrimary?: string;
  background?: string;
  surface?: string;
  surfaceSoft?: string;
  text?: string;
  mutedText?: string;
  border?: string;
  focus?: string;
  success?: string;
  info?: string;
  warning?: string;
  error?: string;
  critical?: string;
  fontFamily?: string;
  fontSize?: number | string;
  radius?: number | string;
  radiusSmall?: number | string;
  borderWidth?: number | string;
  shadow?: string;
}

/** Optional custom CSS variables. Restricted to `--youge-*` and away from the
 * variables that own placement and hit-area geometry. */
export type AssistantThemeVariables = Record<string, string>;

export interface AssistantThemeInput {
  /** Defaults to `'auto'`. */
  mode?: ThemeMode;
  /**
   * Adopt validated host values. In `auto` this includes the host's light/dark
   * scheme and, when no `fontFamily` token is set, the host's font stack.
   * `light`/`dark` never read the host.
   */
  inheritHost?: boolean;
  tokens?: AssistantThemeTokens;
  /** Explicit host values, validated exactly like `tokens` (lower priority). */
  host?: AssistantThemeTokens;
  variables?: AssistantThemeVariables;
}

/** The accepted `theme` configuration value (object form or 0.x string form). */
export type AssistantThemeConfig = AssistantThemeInput | 'auto' | 'light' | 'dark';

/** Normalized, JSON-safe theme record (invalid values already removed). */
export interface NormalizedTheme {
  mode: ThemeMode;
  inheritHost: boolean;
  tokens: Partial<Record<string, string>>;
  host: Partial<Record<string, string>>;
  variables: Record<string, string>;
  warnings: string[];
}

export interface ThemeResolutionContext {
  document?: Document | Record<string, unknown> | null;
  root?: Record<string, unknown>;
  matchMedia?: (query: string) => { matches?: boolean } | null;
  getComputedStyle?: ((element: unknown) => Record<string, unknown>) | null;
  /** Explicit override, mainly for tests and server rendering. */
  hostScheme?: ResolvedColorScheme;
}

/** Fully resolved theme: the values a renderer applies. */
export interface ResolvedTheme {
  mode: ThemeMode;
  scheme: ResolvedColorScheme;
  inheritHost: boolean;
  tokens: Record<string, string>;
  variables: Record<string, string>;
  warnings: string[];
}

export type NotificationLevel = 'critical' | 'error' | 'warning' | 'info' | 'success';

/** Notification tier metadata shared by the DOM widget and the React adapter. */
export declare const NOTIFICATION_LEVELS: readonly NotificationLevel[];
export type NotificationShape =
  | { type: 'path'; d: string }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'dot'; cx: number; cy: number };

/**
 * Declarative glyph primitives per level. React-based renderers map these onto
 * elements instead of injecting markup; the DOM widget uses the string form.
 */
export declare const NOTIFICATION_LEVEL_SHAPES: Readonly<Record<NotificationLevel, readonly NotificationShape[]>>;
export declare const NOTIFICATION_LEVEL_SVG_ATTRIBUTES: Readonly<Record<string, string>>;
/** Inner SVG markup for one level ('' for an unknown level). */
export declare function notificationLevelMarkup(level: string): string;
/** Clamp any value onto a known level (`'info'` when unknown). */
export declare function normalizeNotificationLevel(level: unknown): NotificationLevel;
/** Inner SVG markup per level (no scripts, no external references). */
export declare const NOTIFICATION_LEVEL_ICONS: Readonly<Record<NotificationLevel, string>>;
export declare const NOTIFICATION_LEVEL_LABELS: Readonly<Record<NotificationLevel, string>>;

export declare const THEME_MODES: readonly ThemeMode[];
export declare const COLOR_TOKEN_KEYS: readonly ThemeColorToken[];
export declare const THEME_TOKEN_KEYS: readonly ThemeToken[];
export declare const TOKEN_CSS_VARIABLES: Readonly<Record<ThemeToken, readonly string[]>>;
export declare const PROTECTED_VARIABLES: readonly string[];
export declare const ASSISTANT_PALETTES: Readonly<{
  light: Readonly<Record<ThemeColorToken, string>>;
  dark: Readonly<Record<ThemeColorToken, string>>;
}>;
export declare const ASSISTANT_FONT_STACK: string;
export declare const THEME_DEFAULTS: Readonly<NormalizedTheme>;

export declare function isSafeCssValue(value: unknown, maxLength?: number): boolean;
export declare function normalizeColor(value: unknown): string | null;
export declare function normalizeFontFamily(value: unknown): string | null;
export declare function normalizeLength(value: unknown, min: number, max: number): number | null;
export declare function normalizeShadow(value: unknown): string | null;
export declare function normalizeToken(key: string, value: unknown): string | number | null;
export declare function normalizeThemeVariables(
  raw: unknown,
  warnings?: string[]
): Record<string, string>;
export declare function normalizeTheme(raw?: AssistantThemeConfig | null): NormalizedTheme;

export declare function relativeLuminance(color: string): number | null;
export declare function contrastRatio(a: string, b: string): number | null;
export declare function bestInk(background: string, candidates?: string[], fallback?: string): string;

export declare function detectHostScheme(context?: ThemeResolutionContext): ResolvedColorScheme;
export declare function detectHostTypography(
  context?: ThemeResolutionContext
): { fontFamily: string } | null;

export declare function resolveTheme(
  themeInput?: AssistantThemeConfig | NormalizedTheme | null,
  context?: ThemeResolutionContext
): ResolvedTheme;

export declare function themeToCssVariables(resolved: ResolvedTheme): Record<string, string>;
