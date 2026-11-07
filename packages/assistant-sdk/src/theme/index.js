/*!
 * @youge/assistant-sdk/theme — adaptive theme tokens, validation and resolution
 * ---------------------------------------------------------------------------
 * One dependency-free source of truth for the Assistant's visual identity and
 * for the optional adaptation to a host website. The same module feeds the
 * classic `assistant-state.js` bundle, the DOM widget (`assistant-widget.js`)
 * and the React example, so light / dark / auto / custom can never drift apart.
 *
 * Design rules enforced here:
 *   - The You.Ge Assistant palette is the foundation; host values are opt-in.
 *   - Every integrator value is validated. An invalid value never throws: it is
 *     dropped, its default is used and a warning code is reported.
 *   - Nothing here reads or writes the DOM. `resolveTheme` receives an explicit
 *     context (`document`, `matchMedia`), which keeps the module pure, testable
 *     and SSR-safe.
 *   - Host adaptation only ever *adds* validated values. Layout, position,
 *     z-index, offsets, launcher sizing and interaction behaviour are not
 *     themeable, so a host stylesheet cannot move or disable the widget.
 */

export const THEME_MODES = ['auto', 'light', 'dark', 'custom'];
Object.freeze(THEME_MODES);

/** Public token keys. Colours first, then the non-colour design tokens. */
export const COLOR_TOKEN_KEYS = [
  'primary',
  'onPrimary',
  'background',
  'surface',
  'surfaceSoft',
  'text',
  'mutedText',
  'border',
  'focus',
  'success',
  'info',
  'warning',
  'error',
  'critical',
];
Object.freeze(COLOR_TOKEN_KEYS);

export const THEME_TOKEN_KEYS = COLOR_TOKEN_KEYS.concat([
  'fontFamily',
  'fontSize',
  'radius',
  'radiusSmall',
  'borderWidth',
  'shadow',
]);
Object.freeze(THEME_TOKEN_KEYS);

/**
 * Public token -> CSS custom property. `error`/`warning`/`success` also drive
 * the legacy tone variables (`--youge-critical`, `--youge-auth`,
 * `--youge-install`) so existing stylesheets and integrations keep working.
 */
export const TOKEN_CSS_VARIABLES = {
  primary: ['--youge-brand'],
  onPrimary: ['--youge-on-brand'],
  background: ['--youge-background'],
  surface: ['--youge-surface'],
  surfaceSoft: ['--youge-surface-soft'],
  text: ['--youge-ink'],
  mutedText: ['--youge-muted'],
  border: ['--youge-line'],
  focus: ['--youge-focus'],
  success: ['--youge-success', '--youge-install'],
  info: ['--youge-info', '--youge-backup'],
  warning: ['--youge-warning', '--youge-auth'],
  error: ['--youge-error', '--youge-critical'],
  // `critical` is the most specific severity token: applied after `error` so an
  // explicit critical colour wins when both are provided.
  critical: ['--youge-critical', '--youge-error'],
  fontFamily: ['--youge-font'],
  fontSize: ['--youge-font-size'],
  radius: ['--youge-radius'],
  radiusSmall: ['--youge-radius-small'],
  borderWidth: ['--youge-border-width'],
  shadow: ['--youge-shadow'],
};
Object.freeze(TOKEN_CSS_VARIABLES);

/**
 * Variables owned by the widget and the layout system. An integrator may not
 * set them through `theme.variables`: they control placement and hit-area
 * geometry, which requirement 3 forbids a host from overriding.
 */
export const PROTECTED_VARIABLES = [
  '--youge-offset-x',
  '--youge-offset-y',
  '--youge-fab-size',
  '--youge-fab-glyph',
  '--youge-motion-fast',
  '--youge-motion-state',
];
Object.freeze(PROTECTED_VARIABLES);

/** The Assistant's own identity. Never derived from the host. */
export const ASSISTANT_PALETTES = Object.freeze({
  light: Object.freeze({
    primary: '#155eef',
    onPrimary: '#ffffff',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceSoft: '#f8fafc',
    text: '#0f172a',
    mutedText: '#475569',
    border: '#e2e8f0',
    focus: '#155eef',
    success: '#067647',
    info: '#475467',
    warning: '#b54708',
    error: '#b42318',
    critical: '#b42318',
  }),
  dark: Object.freeze({
    primary: '#84adff',
    onPrimary: '#0b1220',
    background: '#0b1220',
    surface: '#0b1220',
    surfaceSoft: '#111c2f',
    text: '#f8fafc',
    mutedText: '#cbd5e1',
    border: '#334155',
    focus: '#84adff',
    success: '#a6f4c5',
    info: '#cbd5e1',
    warning: '#fec84b',
    error: '#fda29b',
    critical: '#fda29b',
  }),
});

export const THEME_DEFAULTS = Object.freeze({
  mode: 'auto',
  inheritHost: false,
  tokens: Object.freeze({}),
  host: Object.freeze({}),
  variables: Object.freeze({}),
});

// The system-font stack the Assistant ships with. Kept in sync with the
// literal in assistant-widget.css so `fontFamily` has an honest default.
export const ASSISTANT_FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ------------------------------------------------------------------ *
 * Value validation
 * ------------------------------------------------------------------ */

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/a-z]*\)$/i;
const TOKEN_VAR_REFERENCE = /^var\(--youge-[a-z0-9-]{1,48}\)$/;
const UNSAFE_CSS = /[\\;{}<>]|!\s*important|url\s*\(|expression\s*\(|@import|javascript:/i;
const FONT_FAMILY = /^[A-Za-z0-9"'][A-Za-z0-9\s,'"_-]{0,118}$/;
const PX_LENGTH = /^(\d{1,3})px$/;
const NUMBER = /^\d{1,3}$/;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Bounded safety gate for any CSS value the integrator supplies.
 * Rejects declaration-breaking characters and expression-capable payloads.
 */
export function isSafeCssValue(value, maxLength) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || text.length > (maxLength || 200)) return false;
  if (UNSAFE_CSS.test(text)) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) return false;
  return true;
}

/** Accept only a plain hex, a bounded rgb()/hsl() call or one of our own vars. */
export function normalizeColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length > 60) return null;
  if (HEX_COLOR.test(text)) return text;
  if (FUNCTION_COLOR.test(text) && isSafeCssValue(text, 60)) return text;
  if (TOKEN_VAR_REFERENCE.test(text)) return text;
  return null;
}

export function normalizeFontFamily(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!FONT_FAMILY.test(text)) return null;
  // A stack with no generic fallback can resolve to nothing on unusual
  // platforms; the Assistant always appends its own generic last resort in CSS.
  return text;
}

export function normalizeLength(value, min, max) {
  if (typeof value === 'number' && isFinite(value)) return clamp(Math.round(value), min, max);
  /* numeric strings and px strings are handled below */
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const px = PX_LENGTH.exec(text);
  if (px) return clamp(Number(px[1]), min, max);
  const bare = NUMBER.exec(text);
  if (bare) return clamp(Number(bare[1]), min, max);
  return null;
}

export function normalizeShadow(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!isSafeCssValue(text, 160)) return null;
  if (text.indexOf('px') === -1) return null;
  return text;
}

/**
 * Validate one token by key. Returns the CSS string to apply, or `null` when
 * the value is not acceptable (the caller then falls back to the Assistant
 * default). Length tokens are always normalized to a `px` string.
 */
export function normalizeToken(key, value) {
  if (value === undefined || value === null || value === '') return null;
  if (COLOR_TOKEN_KEYS.indexOf(key) !== -1) return normalizeColor(value);
  switch (key) {
    case 'fontFamily':
      return normalizeFontFamily(value);
    case 'fontSize':
      return px(normalizeLength(value, 10, 20));
    case 'radius':
      return px(normalizeLength(value, 0, 28));
    case 'radiusSmall':
      return px(normalizeLength(value, 0, 20));
    case 'borderWidth':
      return px(normalizeLength(value, 0, 3));
    case 'shadow':
      return normalizeShadow(value);
    default:
      return null;
  }
}

function px(number) {
  return number === null ? null : number + 'px';
}

function normalizeTokenMap(raw, warnings, warningPrefix) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).forEach(function (key) {
    if (THEME_TOKEN_KEYS.indexOf(key) === -1) {
      // Unknown keys are ignored, never forwarded to the DOM.
      warnings.push(warningPrefix + ':unknown_token:' + String(key).slice(0, 40));
      return;
    }
    const value = normalizeToken(key, raw[key]);
    if (value === null) {
      warnings.push(warningPrefix + ':invalid_token:' + key);
      return;
    }
    out[key] = value;
  });
  return out;
}

/**
 * Optional custom CSS variables. Restricted to `--youge-*`, to safe values and
 * away from the variables that own placement and hit-area geometry.
 */
export function normalizeThemeVariables(raw, warnings) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const list = warnings || [];
  Object.keys(raw).forEach(function (key) {
    const name = String(key);
    if (!/^--youge-[a-z0-9-]{1,40}$/.test(name)) {
      list.push('variables:invalid_name:' + name.slice(0, 40));
      return;
    }
    if (PROTECTED_VARIABLES.indexOf(name) !== -1) {
      list.push('variables:protected:' + name);
      return;
    }
    const value = raw[key];
    if (!isSafeCssValue(value, 160)) {
      list.push('variables:invalid_value:' + name);
      return;
    }
    out[name] = String(value).trim();
  });
  return out;
}

/**
 * Normalize any accepted `theme` shape into a stable, JSON-safe record.
 *
 * Accepted inputs:
 *   'auto' | 'light' | 'dark'         (0.x string form, unchanged behaviour)
 *   { mode, inheritHost, tokens, host, variables }
 *
 * `mode: 'custom'` is only available through the object form: a bare
 * `'custom'` string has no tokens to apply, so it falls back to `'auto'`.
 */
export function normalizeTheme(raw) {
  const warnings = [];
  let source = raw;

  if (typeof source === 'string') {
    const mode = source.trim().toLowerCase();
    if (mode === 'auto' || mode === 'light' || mode === 'dark') {
      return { mode: mode, inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
    }
    if (mode === 'custom') warnings.push('theme:custom_requires_object');
    else warnings.push('theme:unsupported_mode:' + mode.slice(0, 20));
    return { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    if (source !== undefined && source !== null) warnings.push('theme:invalid_object');
    return { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
  }

  let mode = 'auto';
  const requested = source.mode;
  if (requested === undefined || requested === null) {
    // Object form without an explicit mode keeps the documented default.
    mode = 'auto';
  } else if (typeof requested === 'string' && THEME_MODES.indexOf(requested.trim().toLowerCase()) !== -1) {
    mode = requested.trim().toLowerCase();
  } else {
    warnings.push('theme:unsupported_mode:' + String(requested).slice(0, 20));
  }

  let inheritHost = source.inheritHost === true;
  if (source.inheritHost !== undefined && typeof source.inheritHost !== 'boolean') {
    warnings.push('theme:invalid_inherit_host');
    inheritHost = false;
  }

  const tokens = normalizeTokenMap(source.tokens, warnings, 'theme.tokens');
  const host = normalizeTokenMap(source.host, warnings, 'theme.host');
  const variables = normalizeThemeVariables(source.variables, warnings);

  if (mode === 'custom' && Object.keys(tokens).length === 0) {
    warnings.push('theme:custom_without_tokens');
  }

  return {
    mode: mode,
    inheritHost: inheritHost,
    tokens: tokens,
    host: host,
    variables: variables,
    warnings: warnings,
  };
}

/* ------------------------------------------------------------------ *
 * Contrast utilities (WCAG 2.1 relative luminance)
 * ------------------------------------------------------------------ */

function expandHex(hex) {
  const body = String(hex).replace('#', '');
  if (body.length === 3 || body.length === 4) {
    return body.slice(0, 3).replace(/./g, function (c) { return c + c; });
  }
  return body.slice(0, 6);
}

/** Relative luminance of a `#rgb`/`#rrggbb` colour; `null` for references. */
export function relativeLuminance(color) {
  if (typeof color !== 'string' || !HEX_COLOR.test(color.trim())) return null;
  const body = expandHex(color.trim());
  const channels = [0, 2, 4].map(function (index) {
    const value = parseInt(body.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio; `null` when either colour is not a plain hex value. */
export function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  if (first === null || second === null) return null;
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + 0.05) / (low + 0.05);
}

/**
 * Pick the most legible foreground for a fill. References (`var(--…)`) and
 * non-hex values keep the provided default because they cannot be measured.
 */
export function bestInk(background, candidates, fallback) {
  const pool = (candidates && candidates.length ? candidates : ['#ffffff', '#0b1220']);
  if (contrastRatio(background, pool[0]) === null) return fallback || pool[0];
  let best = null;
  let bestRatio = -1;
  for (let i = 0; i < pool.length; i += 1) {
    const ratio = contrastRatio(background, pool[i]);
    if (ratio === null) continue;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = pool[i];
    }
    if (ratio >= 4.5) {
      best = pool[i];
      break;
    }
  }
  return best || fallback || pool[0];
}

/* ------------------------------------------------------------------ *
 * Host detection (read-only, defensive)
 * ------------------------------------------------------------------ */

const SCHEME_ATTRIBUTES = ['data-theme', 'data-color-mode', 'data-bs-theme', 'data-scheme', 'data-user-color-scheme'];
const DARK_CLASSES = ['dark', 'theme-dark', 'dark-mode', 'dark-theme'];
const LIGHT_CLASSES = ['light', 'theme-light', 'light-mode', 'light-theme'];

function readElementScheme(element) {
  if (!element) return null;
  // Every read is guarded: a host page may expose a throwing getter here, and
  // theme detection must never be able to break the widget.
  try {
    if (typeof element.getAttribute === 'function') {
      for (let i = 0; i < SCHEME_ATTRIBUTES.length; i += 1) {
        const value = element.getAttribute(SCHEME_ATTRIBUTES[i]);
        if (value === 'dark') return 'dark';
        if (value === 'light') return 'light';
      }
    }
  } catch (error) { /* ignore and keep looking */ }
  try {
    const list = element.classList;
    if (list && typeof list.contains === 'function') {
      for (let i = 0; i < DARK_CLASSES.length; i += 1) {
        if (list.contains(DARK_CLASSES[i])) return 'dark';
      }
      for (let i = 0; i < LIGHT_CLASSES.length; i += 1) {
        if (list.contains(LIGHT_CLASSES[i])) return 'light';
      }
    }
  } catch (error) { /* ignore */ }
  try {
    const inline = element.style && typeof element.style === 'object' ? element.style.colorScheme : '';
    if (typeof inline === 'string' && inline.trim()) {
      const value = inline.trim().toLowerCase();
      if (value === 'dark') return 'dark';
      if (value === 'light') return 'light';
    }
  } catch (error) { /* ignore */ }
  return null;
}

function readComputedScheme(context, element) {
  const getStyle = context.getComputedStyle
    || (context.root && typeof context.root.getComputedStyle === 'function' ? context.root.getComputedStyle : null);
  if (!getStyle || !element) return null;
  try {
    const style = getStyle.call(context.root || null, element);
    const declared = style && style.colorScheme;
    if (typeof declared !== 'string') return null;
    const value = declared.trim().toLowerCase();
    // "light dark" means both are supported: the media query decides.
    if (value === 'dark') return 'dark';
    if (value === 'light') return 'light';
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Resolve the host page's light/dark scheme.
 *
 * Order: an explicit `context.hostScheme`, then the host's own scheme signal
 * (`data-theme`, `data-color-mode`, `data-bs-theme`, `data-scheme`, a
 * dark/light class, an inline `color-scheme`), then the computed
 * `color-scheme`, then `prefers-color-scheme`, then light.
 */
export function detectHostScheme(context) {
  const ctx = context || {};
  if (ctx.hostScheme === 'dark' || ctx.hostScheme === 'light') return ctx.hostScheme;

  const doc = ctx.document || (ctx.root && ctx.root.document) || null;
  const element = doc ? (doc.documentElement || null) : null;
  let fromAttributes = null;
  try {
    fromAttributes = readElementScheme(element) || readElementScheme(doc && doc.body);
  } catch (error) { /* ignore */ }
  if (fromAttributes) return fromAttributes;

  const computed = readComputedScheme(ctx, element);
  if (computed) return computed;

  const query = ctx.matchMedia
    || (ctx.root && typeof ctx.root.matchMedia === 'function' ? ctx.root.matchMedia : null);
  if (typeof query === 'function') {
    try {
      const result = query.call(ctx.root || null, '(prefers-color-scheme: dark)');
      if (result && result.matches === true) return 'dark';
      if (result && result.matches === false) return 'light';
    } catch (error) { /* fall through */ }
  }
  return 'light';
}

/**
 * Optionally read the host's typography. Only the font stack is inherited:
 * colours come from explicit `theme.host` values, never from a computed style
 * guess, so a host can never drag contrast down silently.
 */
export function detectHostTypography(context) {
  const ctx = context || {};
  const doc = ctx.document || (ctx.root && ctx.root.document) || null;
  if (!doc || !doc.body) return null;
  const getStyle = ctx.getComputedStyle
    || (ctx.root && typeof ctx.root.getComputedStyle === 'function' ? ctx.root.getComputedStyle : null);
  if (!getStyle) return null;
  try {
    const style = getStyle.call(ctx.root || null, doc.body);
    const family = style && typeof style.fontFamily === 'string' ? style.fontFamily : '';
    const normalized = normalizeFontFamily(family);
    return normalized ? { fontFamily: normalized } : null;
  } catch (error) {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

const INKABLE_TONES = ['primary', 'success', 'info', 'warning', 'error', 'critical'];

/**
 * Resolve a theme into the values a renderer needs.
 *
 * @param {unknown} themeInput         raw `theme` value or a normalized record
 * @param {object}  [context]          { document, matchMedia, getComputedStyle, root, hostScheme, seedPrimary }
 *
 * `context.seedPrimary` is a validated colour that acts as the lowest-priority
 * primary — it keeps the long-standing `branding.themeColor` behaviour working
 * without letting it override an explicit `theme.tokens.primary`. It is only
 * accepted as a plain colour value.
 * @returns {{
 *   mode: 'auto'|'light'|'dark'|'custom',
 *   scheme: 'light'|'dark',
 *   inheritHost: boolean,
 *   tokens: Record<string, string>,
 *   variables: Record<string, string>,
 *   warnings: string[],
 * }}
 */
export function resolveTheme(themeInput, context) {
  const ctx = context || {};
  // `normalizeTheme` is idempotent: normalizing an already-normalized record
  // returns the same validated values, so callers may pass either shape.
  const theme = normalizeTheme(themeInput);
  const warnings = (theme.warnings || []).slice();

  const mode = THEME_MODES.indexOf(theme.mode) !== -1 ? theme.mode : 'auto';
  const inheritHost = theme.inheritHost === true;

  // Light/Dark never consult the host or the OS. Auto always detects the
  // host's light/dark scheme (that is what `auto` means); `inheritHost` only
  // controls whether host *values* — colours and typography — are adopted on
  // top of the Assistant's own palette. Custom keeps the integrator's palette
  // on a deterministic light foundation.
  let scheme = 'light';
  if (mode === 'dark') scheme = 'dark';
  else if (mode === 'light' || mode === 'custom') scheme = 'light';
  else scheme = detectHostScheme(ctx);

  const base = Object.assign({}, ASSISTANT_PALETTES[scheme]);
  const hostLayer = {};

  if (mode === 'auto' && inheritHost) {
    Object.keys(theme.host || {}).forEach(function (key) { hostLayer[key] = theme.host[key]; });
    if (!hostLayer.fontFamily) {
      const typography = detectHostTypography(ctx);
      if (typography && typography.fontFamily) hostLayer.fontFamily = typography.fontFamily;
    }
  }

  const merged = Object.assign({}, base, hostLayer, theme.tokens || {});
  // `branding.themeColor` remains a supported way to set the project's primary
  // colour. It ranks below any explicit theme token and below host adaptation.
  if (!hostLayer.primary && !(theme.tokens && theme.tokens.primary)) {
    const seed = ctx.seedPrimary === undefined ? null : normalizeColor(ctx.seedPrimary);
    if (seed) {
      // A project brand colour is a *light-scheme* identity value. On a dark
      // surface it is only kept when it is still legible there; otherwise the
      // Assistant's dark-adapted brand is used, which is what keeps a deep
      // brand blue from becoming unreadable on a dark panel.
      const legible = scheme !== 'dark' || (contrastRatio(seed, base.surface) || 0) >= 4.5;
      if (legible) merged.primary = seed;
      else warnings.push('theme:contrast_guard:seedPrimary');
    }
  }

  // --- Contrast guard: never let a host or integrator value reduce
  // readability below the AA floor for body text. The Assistant's own value is
  // restored per token instead of rejecting the whole theme.
  const surface = merged.surface;
  const guards = [
    ['text', base.text, 4.5],
    ['mutedText', base.mutedText, 4.5],
    ['onPrimary', base.onPrimary, 4.5],
  ];
  guards.forEach(function (entry) {
    const key = entry[0];
    const ratio = contrastRatio(merged[key], key === 'onPrimary' ? merged.primary : surface);
    if (ratio !== null && ratio < entry[2]) {
      warnings.push('theme:contrast_guard:' + key);
      merged[key] = entry[1];
    }
  });

  // A border that matches its surface is invisible: restore the Assistant's.
  const borderRatio = contrastRatio(merged.border, surface);
  if (borderRatio !== null && borderRatio < 1.2) {
    warnings.push('theme:contrast_guard:border');
    merged.border = base.border;
  }

  // The font stack always resolves to something concrete, so the renderer can
  // publish it as a variable instead of leaving the CSS default implicit.
  if (!merged.fontFamily) merged.fontFamily = ASSISTANT_FONT_STACK;

  // Tone inks are derived, never trusted: a fill only keeps a white label when
  // white actually clears 4.5:1 against it.
  const variables = {};
  INKABLE_TONES.forEach(function (tone) {
    if (!merged[tone]) return;
    const ink = bestInk(merged[tone], ['#ffffff', '#0b1220', base.text], base.text);
    variables['--youge-' + tone + '-ink'] = ink;
  });

  Object.keys(merged).forEach(function (key) {
    const targets = TOKEN_CSS_VARIABLES[key];
    if (!targets) return;
    targets.forEach(function (name) { variables[name] = merged[key]; });
  });

  // Integrator variables are applied last: they are explicit opt-in overrides
  // of the (validated) token variables, never of layout geometry.
  Object.keys(theme.variables || {}).forEach(function (name) {
    if (PROTECTED_VARIABLES.indexOf(name) === -1) variables[name] = theme.variables[name];
  });

  const tokens = {};
  Object.keys(merged).forEach(function (key) {
    if (merged[key] !== undefined && merged[key] !== null) tokens[key] = merged[key];
  });

  return {
    mode: mode,
    scheme: scheme,
    inheritHost: mode === 'auto' && inheritHost,
    tokens: tokens,
    variables: variables,
    warnings: warnings,
  };
}

/**
 * Convert a resolved theme into `style` assignments for a DOM node.
 * Only `--youge-*` custom properties are ever produced.
 */
export function themeToCssVariables(resolved) {
  const out = {};
  const source = resolved && resolved.variables ? resolved.variables : {};
  Object.keys(source).forEach(function (name) {
    if (/^--youge-[a-z0-9-]+$/.test(name) && isSafeCssValue(source[name], 160)) {
      out[name] = source[name];
    }
  });
  return out;
}
