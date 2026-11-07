/*!
 * Adaptive theming — SDK-level unit tests.
 *
 * Covers the shared theme module (`@youge/assistant-sdk/theme`), config
 * validation for every accepted `theme` shape, invalid-value fallbacks, the
 * contrast guard, host detection and the notification level taxonomy.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ASSISTANT_FONT_STACK,
  ASSISTANT_PALETTES,
  BUNDLED_DEFAULTS,
  COLOR_TOKEN_KEYS,
  PROTECTED_VARIABLES,
  THEME_MODES,
  THEME_TOKEN_KEYS,
  YouGeAssistant,
  bestInk,
  contrastRatio,
  detectHostScheme,
  detectHostTypography,
  isSafeCssValue,
  normalizeTheme,
  normalizeToken,
  notificationLevel,
  relativeLuminance,
  resolveTheme,
  themeToCssVariables,
} from '../src/index.js';

/* ------------------------------------------------------------------ *
 * 1. Token validation
 * ------------------------------------------------------------------ */

test('colour tokens accept hex, rgb()/hsl() and the SDK’s own var() references only', () => {
  for (const valid of ['#155eef', '#fff', '#155eefcc', 'rgb(21, 94, 239)', 'rgba(21,94,239,0.5)', 'hsl(222 90% 50%)', 'var(--youge-brand)']) {
    assert.equal(normalizeToken('primary', valid), valid, `accepts ${valid}`);
  }
  for (const invalid of ['red', 'currentColor', 'url(//evil.test/x)', 'javascript:alert(1)', '#12345', 'rgb(1,2,3);background:url(x)', 'var(--page-bg)', 'expression(alert(1))', '#155eef !important']) {
    assert.equal(normalizeToken('primary', invalid), null, `rejects ${invalid}`);
  }
});

test('structural tokens are clamped and unit-normalized', () => {
  assert.equal(normalizeToken('radius', 18), '18px');
  assert.equal(normalizeToken('radius', '400px'), '28px', 'over-sized radius clamps to the maximum');
  assert.equal(normalizeToken('radius', -4), '0px', 'negative radius clamps to zero');
  assert.equal(normalizeToken('radiusSmall', 999), '20px');
  assert.equal(normalizeToken('borderWidth', '1px'), '1px');
  assert.equal(normalizeToken('borderWidth', '9px'), '3px');
  assert.equal(normalizeToken('fontSize', 14), '14px');
  assert.equal(normalizeToken('fontSize', 40), '20px');
  assert.equal(normalizeToken('fontSize', '12em'), null, 'non-px units are rejected');
  assert.equal(normalizeToken('fontFamily', 'Inter, system-ui, sans-serif'), 'Inter, system-ui, sans-serif');
  assert.equal(normalizeToken('fontFamily', 'Inter; } body { display: none'), null, 'declaration breaking values are rejected');
  assert.equal(normalizeToken('fontFamily', 'url(evil.woff)'), null);
  assert.equal(normalizeToken('shadow', '0 18px 40px rgba(15, 23, 42, 0.18)'), '0 18px 40px rgba(15, 23, 42, 0.18)');
  assert.equal(normalizeToken('shadow', 'none'), null, 'a shadow needs at least one length');
  assert.equal(normalizeToken('shadow', '0 1px red;background:url(x)'), null);
  assert.equal(normalizeToken('mystery', '#155eef'), null, 'unknown keys are never accepted');
});

test('custom CSS variables stay inside the --youge-* namespace and away from layout geometry', () => {
  const theme = normalizeTheme({
    mode: 'custom',
    tokens: { primary: '#7c3aed' },
    variables: {
      '--youge-panel-ring': '0 0 0 1px rgba(124, 58, 237, 0.3)',
      '--youge-offset-x': '999px',
      '--youge-fab-size': '10px',
      '--progressierBg': '#fff',
      '--youge-bad': 'red; }',
    },
  });
  assert.deepEqual(theme.variables, { '--youge-panel-ring': '0 0 0 1px rgba(124, 58, 237, 0.3)' });
  assert.ok(theme.warnings.includes('variables:protected:--youge-offset-x'), 'position geometry is protected');
  assert.ok(theme.warnings.includes('variables:protected:--youge-fab-size'), 'launcher size is protected');
  assert.ok(theme.warnings.includes('variables:invalid_name:--progressierBg'), 'foreign namespaces are rejected');
  assert.ok(theme.warnings.includes('variables:invalid_value:--youge-bad'));
  for (const name of PROTECTED_VARIABLES) {
    assert.equal(normalizeTheme({ mode: 'custom', variables: { [name]: '1px' } }).variables[name], undefined);
  }
});

test('isSafeCssValue blocks payloads that could escape a declaration', () => {
  assert.equal(isSafeCssValue('#155eef'), true);
  assert.equal(isSafeCssValue('0 18px 40px rgba(15,23,42,.18)'), true);
  assert.equal(isSafeCssValue('red; background: url(//evil.test)'), false);
  assert.equal(isSafeCssValue('red } body { display: none'), false);
  assert.equal(isSafeCssValue('url(x)'), false);
  assert.equal(isSafeCssValue('anything!important'), false);
  assert.equal(isSafeCssValue(''), false);
  assert.equal(isSafeCssValue(null), false);
});

/* ------------------------------------------------------------------ *
 * 2. Theme modes
 * ------------------------------------------------------------------ */

test('the four documented modes are the complete public set', () => {
  assert.deepEqual([...THEME_MODES], ['auto', 'light', 'dark', 'custom']);
});

test('default configuration is auto mode with the Assistant identity and no host inheritance', () => {
  const assistant = YouGeAssistant.create({ projectId: 'defaults', bindEvents: false });
  const config = assistant.getConfig();
  assert.equal(config.theme, 'auto');
  assert.equal(config.themeConfig.mode, 'auto');
  assert.equal(config.themeConfig.inheritHost, false);
  assert.deepEqual(config.themeConfig.tokens, {});
  assert.equal(assistant.getState().appearance.theme, 'auto');
  assert.deepEqual(assistant.getState().appearance.themeConfig, config.themeConfig);
  assert.deepEqual(BUNDLED_DEFAULTS.theme.mode, 'auto');
  assistant.destroy();

  const resolved = resolveTheme(undefined, { hostScheme: 'light', document: null });
  assert.equal(resolved.mode, 'auto');
  assert.equal(resolved.scheme, 'light');
  assert.equal(resolved.inheritHost, false);
  assert.equal(resolved.variables['--youge-brand'], ASSISTANT_PALETTES.light.primary);
});

test('auto mode follows the host scheme when inheritHost is enabled', () => {
  const dark = resolveTheme({ mode: 'auto', inheritHost: true }, { hostScheme: 'dark', document: null });
  assert.equal(dark.scheme, 'dark');
  assert.equal(dark.inheritHost, true);
  assert.equal(dark.variables['--youge-surface'], ASSISTANT_PALETTES.dark.surface);

  const light = resolveTheme({ mode: 'auto', inheritHost: true }, { hostScheme: 'light', document: null });
  assert.equal(light.scheme, 'light');
  assert.equal(light.variables['--youge-surface'], ASSISTANT_PALETTES.light.surface);
});

test('auto mode follows the host scheme but adopts nothing else without inheritHost', () => {
  const context = {
    hostScheme: 'dark',
    document: fakeDocument({}),
    getComputedStyle: () => ({ colorScheme: 'dark', fontFamily: 'Host Sans, sans-serif' }),
    matchMedia: () => ({ matches: false }),
  };
  const resolved = resolveTheme({ mode: 'auto' }, context);
  assert.equal(resolved.scheme, 'dark', 'the host’s own scheme is detected in auto mode');
  assert.equal(resolved.inheritHost, false);
  assert.equal(
    resolved.variables['--youge-font'],
    ASSISTANT_FONT_STACK,
    'no host typography without inheritHost — only the Assistant stack'
  );

  const adopting = resolveTheme({ mode: 'auto', inheritHost: true }, context);
  assert.equal(adopting.variables['--youge-font'], 'Host Sans, sans-serif', 'inheritHost opts into host typography');

  // No host signal at all: prefers-color-scheme decides.
  const prefersDark = resolveTheme({ mode: 'auto' }, { document: null, matchMedia: () => ({ matches: true }) });
  assert.equal(prefersDark.scheme, 'dark');
  const prefersLight = resolveTheme({ mode: 'auto' }, { document: null, matchMedia: () => ({ matches: false }) });
  assert.equal(prefersLight.scheme, 'light');
});

test('light and dark modes never consult the host or the OS', () => {
  for (const mode of ['light', 'dark']) {
    const resolved = resolveTheme(
      { mode, inheritHost: true, host: { primary: '#ff0000' } },
      { hostScheme: mode === 'light' ? 'dark' : 'light', document: null, matchMedia: () => ({ matches: mode === 'light' }) }
    );
    assert.equal(resolved.scheme, mode, `${mode} pins its own scheme`);
    assert.equal(resolved.inheritHost, false, `${mode} never adopts host values`);
    assert.equal(
      resolved.variables['--youge-brand'],
      ASSISTANT_PALETTES[mode].primary,
      `${mode} keeps the Assistant identity`
    );
  }
});

test('custom mode applies integrator tokens with per-token fallbacks', () => {
  const resolved = resolveTheme({
    mode: 'custom',
    tokens: {
      primary: '#7c3aed',
      surface: '#ffffff',
      text: '#111827',
      mutedText: '#4b5563',
      border: '#e5e7eb',
      fontFamily: 'Inter, system-ui, sans-serif',
      radius: 18,
      shadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
    },
  });
  assert.equal(resolved.mode, 'custom');
  assert.equal(resolved.scheme, 'light', 'custom keeps a deterministic light foundation');
  assert.equal(resolved.variables['--youge-brand'], '#7c3aed');
  assert.equal(resolved.variables['--youge-radius'], '18px');
  assert.equal(resolved.variables['--youge-font'], 'Inter, system-ui, sans-serif');
  assert.equal(resolved.variables['--youge-shadow'], '0 18px 40px rgba(15, 23, 42, 0.16)');
  // Untouched tokens keep the Assistant defaults.
  assert.equal(resolved.variables['--youge-focus'], ASSISTANT_PALETTES.light.focus);
  assert.equal(resolved.variables['--youge-warning'], ASSISTANT_PALETTES.light.warning);
});

test('custom mode without tokens is reported and still renders with the Assistant identity', () => {
  const theme = normalizeTheme({ mode: 'custom' });
  assert.equal(theme.mode, 'custom');
  assert.ok(theme.warnings.includes('theme:custom_without_tokens'));
  assert.equal(resolveTheme(theme).variables['--youge-brand'], ASSISTANT_PALETTES.light.primary);
});

/* ------------------------------------------------------------------ *
 * 3. Invalid configuration → safe fallbacks
 * ------------------------------------------------------------------ */

test('unsupported modes and malformed theme objects fall back to auto with warnings', () => {
  assert.equal(normalizeTheme('neon').mode, 'auto');
  assert.ok(normalizeTheme('neon').warnings.includes('theme:unsupported_mode:neon'));
  assert.equal(normalizeTheme('custom').mode, 'auto', 'a bare "custom" string has no tokens');
  assert.ok(normalizeTheme('custom').warnings.includes('theme:custom_requires_object'));
  assert.equal(normalizeTheme({ mode: 42 }).mode, 'auto');
  assert.equal(normalizeTheme({ mode: 'DARK' }).mode, 'dark', 'case-insensitive mode names are accepted');
  assert.equal(normalizeTheme({ inheritHost: 'yes' }).inheritHost, false);
  assert.ok(normalizeTheme({ inheritHost: 'yes' }).warnings.includes('theme:invalid_inherit_host'));
  assert.deepEqual(normalizeTheme(null), { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: [] });
  assert.deepEqual(normalizeTheme(['dark']), { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: ['theme:invalid_object'] });
});

test('an invalid token never removes the rest of the theme', () => {
  const resolved = resolveTheme({
    mode: 'custom',
    tokens: { primary: 'not-a-color', radius: 'huge', surface: '#0f172a', text: '#f8fafc' },
  });
  assert.equal(resolved.variables['--youge-brand'], ASSISTANT_PALETTES.light.primary, 'invalid primary falls back');
  assert.equal(resolved.variables['--youge-radius'], undefined, 'an invalid radius leaves the CSS default');
  assert.equal(resolved.variables['--youge-surface'], '#0f172a', 'valid tokens still apply');
  assert.ok(resolved.warnings.includes('theme.tokens:invalid_token:primary'));
  assert.ok(resolved.warnings.includes('theme.tokens:invalid_token:radius'));
});

test('executable and secret values are neutralized by the existing config safety pass', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'safety',
    bindEvents: false,
    theme: {
      mode: 'custom',
      tokens: { primary: 'javascript:alert(1)', shadow: 'url(//evil.test/x)' },
      variables: { '--youge-x': 'expression(alert(1))' },
    },
  });
  const config = assistant.getConfig();
  assert.deepEqual(config.themeConfig.tokens, {}, 'no executable token survives');
  assert.deepEqual(config.themeConfig.variables, {});
  assert.ok(config.meta.warnings.length > 0);
  assistant.destroy();
});

test('the contrast guard restores the Assistant’s text colours when host values are unreadable', () => {
  const resolved = resolveTheme({
    mode: 'custom',
    tokens: { surface: '#0f172a', text: '#111827', mutedText: '#1f2937' },
  });
  assert.equal(resolved.variables['--youge-ink'], ASSISTANT_PALETTES.light.text);
  assert.equal(resolved.variables['--youge-muted'], ASSISTANT_PALETTES.light.mutedText);
  assert.ok(resolved.warnings.includes('theme:contrast_guard:text'));
  assert.ok(resolved.warnings.includes('theme:contrast_guard:mutedText'));
});

test('a border that disappears into its surface is restored', () => {
  const resolved = resolveTheme({
    mode: 'custom',
    tokens: { surface: '#ffffff', border: '#fefefe' },
  });
  assert.equal(resolved.variables['--youge-line'], ASSISTANT_PALETTES.light.border);
  assert.ok(resolved.warnings.includes('theme:contrast_guard:border'));
});

test('tone inks are derived from the effective fill, never trusted blindly', () => {
  assert.equal(bestInk('#155eef'), '#ffffff');
  assert.equal(bestInk('#fef3c7'), '#0b1220');
  const resolved = resolveTheme({ mode: 'custom', tokens: { primary: '#fde68a' } });
  assert.equal(resolved.variables['--youge-primary-ink'], '#0b1220', 'a pale primary gets dark ink');
  const dark = resolveTheme({ mode: 'custom', tokens: { primary: '#1e1b4b' } });
  assert.equal(dark.variables['--youge-primary-ink'], '#ffffff');
});

test('WCAG helpers agree with the definitions', () => {
  assert.equal(Math.round(relativeLuminance('#ffffff') * 1000), 1000);
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('var(--youge-brand)'), null);
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(Math.round(contrastRatio('#ffffff', '#b42318') * 100) / 100, 6.57);
});

test('every Assistant palette pair clears the AA floor in light and dark', () => {
  for (const scheme of ['light', 'dark']) {
    const palette = ASSISTANT_PALETTES[scheme];
    const onSurface = contrastRatio(palette.text, palette.surface);
    const muted = contrastRatio(palette.mutedText, palette.surface);
    const primary = contrastRatio(palette.onPrimary, palette.primary);
    assert.ok(onSurface >= 4.5, `${scheme}: text on surface is ${onSurface.toFixed(2)}:1`);
    assert.ok(muted >= 4.5, `${scheme}: muted text on surface is ${muted.toFixed(2)}:1`);
    assert.ok(primary >= 4.5, `${scheme}: onPrimary on primary is ${primary.toFixed(2)}:1`);
    for (const key of COLOR_TOKEN_KEYS) {
      assert.equal(typeof palette[key], 'string', `${scheme}.${key} exists`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * 4. Host detection
 * ------------------------------------------------------------------ */

function fakeDocument(options) {
  const el = {
    attributes: options.attributes || {},
    classList: {
      contains(name) {
        return (options.classes || []).indexOf(name) !== -1;
      },
    },
    style: options.style || {},
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
  };
  return {
    documentElement: el,
    body: options.body || { style: {} },
  };
}

test('host scheme detection reads the signals host frameworks actually ship', () => {
  assert.equal(detectHostScheme({ document: fakeDocument({ attributes: { 'data-theme': 'dark' } }) }), 'dark');
  assert.equal(detectHostScheme({ document: fakeDocument({ attributes: { 'data-bs-theme': 'dark' } }) }), 'dark');
  assert.equal(detectHostScheme({ document: fakeDocument({ attributes: { 'data-color-mode': 'dark' } }) }), 'dark');
  assert.equal(detectHostScheme({ document: fakeDocument({ classes: ['dark'] }) }), 'dark');
  assert.equal(detectHostScheme({ document: fakeDocument({ classes: ['theme-light'] }) }), 'light');
  assert.equal(detectHostScheme({ document: fakeDocument({ style: { colorScheme: 'dark' } }) }), 'dark');
  assert.equal(
    detectHostScheme({ document: fakeDocument({}), getComputedStyle: () => ({ colorScheme: 'dark' }) }),
    'dark',
    'a computed color-scheme is honored'
  );
  assert.equal(
    detectHostScheme({ document: fakeDocument({}), getComputedStyle: () => ({ colorScheme: 'light dark' }), matchMedia: () => ({ matches: true }) }),
    'dark',
    '"light dark" defers to prefers-color-scheme'
  );
  assert.equal(detectHostScheme({ document: null, matchMedia: () => ({ matches: false }) }), 'light');
  assert.equal(detectHostScheme({ hostScheme: 'dark', document: fakeDocument({ attributes: { 'data-theme': 'light' } }) }), 'dark', 'an explicit context override wins');
  assert.equal(detectHostScheme({}), 'light', 'no signal at all defaults to light');
});

test('host detection is defensive: broken host objects never throw', () => {
  const hostile = {
    documentElement: {
      getAttribute() { throw new Error('boom'); },
      classList: { contains() { throw new Error('boom'); } },
      style: null,
    },
    body: null,
  };
  assert.equal(detectHostScheme({ document: hostile, getComputedStyle() { throw new Error('boom'); } }), 'light');
  assert.equal(detectHostTypography({ document: hostile, getComputedStyle() { throw new Error('boom'); } }), null);
});

test('host typography is inherited only when inheritHost is on and no token is set', () => {
  const context = {
    hostScheme: 'light',
    document: fakeDocument({}),
    getComputedStyle: () => ({ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }),
  };
  const adopted = resolveTheme({ mode: 'auto', inheritHost: true }, context);
  assert.equal(adopted.variables['--youge-font'], '"Plus Jakarta Sans", system-ui, sans-serif');

  const explicit = resolveTheme({ mode: 'auto', inheritHost: true, tokens: { fontFamily: 'Inter, sans-serif' } }, context);
  assert.equal(explicit.variables['--youge-font'], 'Inter, sans-serif', 'an explicit token wins over the host');

  const off = resolveTheme({ mode: 'auto' }, context);
  assert.equal(off.variables['--youge-font'], ASSISTANT_FONT_STACK, 'nothing is inherited without inheritHost');
});

test('host color values apply only through explicit host tokens and stay validated', () => {
  const resolved = resolveTheme(
    { mode: 'auto', inheritHost: true, host: { primary: '#0f766e', border: 'url(evil)' } },
    { hostScheme: 'light', document: null }
  );
  assert.equal(resolved.variables['--youge-brand'], '#0f766e');
  assert.equal(resolved.variables['--youge-line'], ASSISTANT_PALETTES.light.border, 'invalid host values fall back');
  assert.equal(
    resolveTheme({ mode: 'light', host: { primary: '#0f766e' } }).variables['--youge-brand'],
    ASSISTANT_PALETTES.light.primary,
    'host values never apply outside auto'
  );
});

/* ------------------------------------------------------------------ *
 * 5. Renderer contract
 * ------------------------------------------------------------------ */

test('themeToCssVariables emits only --youge-* custom properties', () => {
  const resolved = resolveTheme({ mode: 'custom', tokens: { primary: '#7c3aed' }, variables: { '--youge-x': '1px' } });
  const variables = themeToCssVariables(resolved);
  assert.ok(variables['--youge-brand']);
  assert.ok(variables['--youge-x']);
  for (const name of Object.keys(variables)) assert.match(name, /^--youge-[a-z0-9-]+$/);
  assert.deepEqual(themeToCssVariables({ variables: { 'background': 'red', '--youge-ok': '1px' } }), { '--youge-ok': '1px' });
});

/* ------------------------------------------------------------------ *
 * 6. Configuration surface
 * ------------------------------------------------------------------ */

test('theme accepts the legacy string form, the object form and reconfiguration', () => {
  const assistant = YouGeAssistant.create({ projectId: 'shapes', theme: 'light', bindEvents: false });
  assert.equal(assistant.getState().appearance.theme, 'light');

  assistant.configure({ theme: { mode: 'dark', inheritHost: true } });
  assert.equal(assistant.getState().appearance.theme, 'dark');
  assert.equal(assistant.getState().appearance.themeConfig.inheritHost, true);
  assert.equal(assistant.getConfig().theme, 'dark', 'getConfig().theme stays a string');

  assistant.configure({ theme: { mode: 'custom', tokens: { primary: '#7c3aed' } } });
  assert.equal(assistant.getConfig().theme, 'custom');
  assert.deepEqual(assistant.getConfig().themeConfig.tokens, { primary: '#7c3aed' });

  assistant.configure({ theme: 'auto' });
  assert.deepEqual(assistant.getConfig().themeConfig.tokens, {}, 'returning to a string mode clears custom tokens');
  assistant.destroy();
});

test('a published (remote) revision can select a mode but never ship custom tokens', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'remote',
    bindEvents: false,
    publishedConfig: {
      schemaVersion: 1,
      projectId: 'remote',
      theme: 'dark',
    },
  });
  assert.equal(assistant.getConfig().theme, 'dark');
  assert.deepEqual(assistant.getConfig().themeConfig.tokens, {});
  assert.equal(assistant.getConfig().meta.source, 'published');
  assistant.destroy();
});

test('theme warnings surface through meta.warnings without breaking the config', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'warned',
    bindEvents: false,
    theme: { mode: 'custom', tokens: { primary: 'deep-purple', radius: -10 } },
  });
  const config = assistant.getConfig();
  assert.equal(config.theme, 'custom');
  assert.equal(config.themeConfig.tokens.radius, '0px', 'a clamped value is still valid');
  assert.ok(config.meta.warnings.some((code) => code === 'theme.tokens:invalid_token:primary'));
  assert.equal(assistant.getState().appearance.theme, 'custom');
  assistant.destroy();
});

test('the theme surface is additive: no new required option, existing payloads unchanged', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'legacy',
    position: 'bottom-left',
    offsets: { x: 32, y: 40 },
    branding: { name: 'Legacy', shortName: 'L', themeColor: '#123456' },
    theme: 'dark',
    bindEvents: false,
  });
  const state = assistant.getState();
  assert.equal(state.appearance.position, 'bottom-left');
  assert.equal(state.appearance.offsets.x, 32);
  assert.equal(state.appearance.theme, 'dark');
  assert.equal(state.appearance.themeColor, '#123456');
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * 7. Notification levels
 * ------------------------------------------------------------------ */

test('notification levels map every shipped condition to a distinct tier', () => {
  assert.equal(notificationLevel('network:offline', 1), 'critical');
  assert.equal(notificationLevel('dns:failure', 1), 'critical');
  assert.equal(notificationLevel('network:unreachable', 1), 'critical');
  assert.equal(notificationLevel('api:primary-failed', 1), 'error');
  assert.equal(notificationLevel('session:issue', 2), 'warning');
  assert.equal(notificationLevel('api:backup-active', 3), 'info');
  assert.equal(notificationLevel('api:primary-restored', 5), 'success');
  assert.equal(notificationLevel('install:available', 4), 'success');
  assert.equal(notificationLevel('app:update', 5), 'info');
  assert.equal(notificationLevel('feature:new-thing', 5), 'info');
  // Unknown ids fall back to the priority ladder, never to undefined.
  assert.equal(notificationLevel('custom:thing', 1), 'critical');
  assert.equal(notificationLevel('custom:thing', 2), 'warning');
  assert.equal(notificationLevel('', undefined), 'info');
});

test('every notification the engine emits carries a level, and priorities are untouched', () => {
  const assistant = YouGeAssistant.create({ projectId: 'levels', bindEvents: false });
  assistant.setConnectivity(false);
  assistant.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'failover' });
  assistant.setSessionStatus({ state: 'issue', message: 'expired' });
  const notifications = assistant.getState().notifications;
  assert.ok(notifications.length >= 4);
  for (const notice of notifications) {
    assert.ok(['critical', 'error', 'warning', 'info', 'success'].includes(notice.level), `${notice.id} has a level`);
    assert.equal(typeof notice.priority, 'number', 'the priority ladder is unchanged');
    assert.equal(typeof notice.tone, 'string', 'the legacy tone is unchanged');
  }
  assert.deepEqual(notifications.map((n) => n.id), [
    'network:offline',
    'api:primary-failed',
    'session:issue',
    'api:backup-active',
  ]);
  assistant.destroy();
});

test('the level addition does not change dismissal, acknowledgement or persistence rules', () => {
  const assistant = YouGeAssistant.create({ projectId: 'rules', bindEvents: false, storage: null });
  assistant.setConnectivity(false);
  const offline = assistant.getState().notifications.find((n) => n.id === 'network:offline');
  assert.equal(offline.level, 'critical');
  assert.equal(offline.critical, true);
  assert.equal(assistant.dismiss('network:offline'), false, 'critical notices stay persistent');
  assert.equal(assistant.acknowledge('network:offline'), true);
  assert.equal(
    assistant.getState().notifications.some((n) => n.id === 'network:offline'),
    false,
    'acknowledgement still suppresses a critical notice'
  );
  assistant.destroy();
});
