/*!
 * @youge/assistant-sdk — Android in-app browser detection & Chrome handoff
 * ------------------------------------------------------------------------
 * Framework-independent, dependency-free helpers that detect unsupported or
 * restricted Android in-app browsers (Facebook, Messenger, Instagram and
 * Android System WebView) and build a best-effort Android `intent://` URL
 * that opens the current page in Chrome while preserving the original URL —
 * pathname, query string and hash included.
 *
 * Safety rules (deliberate):
 *   - Nothing navigates unless the caller invokes `open()` AND the detection
 *     is a confident candidate (Android + a known restricted in-app browser).
 *   - A missing or unusable user agent reports `uncertain: true`; uncertain
 *     detections are never candidates, so identification ambiguity can never
 *     trigger a redirect.
 *   - Supported browsers (Chrome, Safari, Firefox, …) are never redirected
 *     and ordinary navigation is never intercepted: no history changes, no
 *     global listeners, no polling.
 *   - When the `intent://` handoff cannot leave the app, `open()` reports the
 *     failure and hands the caller copy-ready manual instructions instead of
 *     retrying or forcing anything.
 */

const ANDROID_RE = /Android/i;
const IOS_RE = /iPhone|iPad|iPod/i;
// Named restricted in-app browsers. Messenger is tested before Facebook:
// Messenger webviews carry Facebook's own FBAN/FBAV markers as well.
const INSTAGRAM_RE = /Instagram/i;
const MESSENGER_RE = /Messenger/i;
const FACEBOOK_RE = /\bFBAN\b|\bFBAV\b|\[FB_IAB|\bFB4A\b|\bFacebook\b/i;
// Android System WebView advertises itself with a `wv)` platform token.
// Standalone Chrome on Android never carries it.
const WEBVIEW_RE = /\bwv\)/i;

export const CHROME_PACKAGE = 'com.android.chrome';
export const CHROME_OFFER_STORAGE_KEY = 'youge-assistant:chrome-offer-dismissed';

/**
 * Classify a user agent for in-app browser restrictions.
 *
 * @param {string} [userAgent]
 * @returns {Readonly<{
 *   ua: string,
 *   android: boolean,
 *   ios: boolean,
 *   inApp: boolean,
 *   restricted: boolean,
 *   uncertain: boolean,
 *   browser: 'facebook' | 'messenger' | 'instagram' | 'webview' | 'none',
 * }>}
 */
export function detectInAppBrowser(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent : '';
  if (!ua.trim()) {
    return Object.freeze({
      ua: '',
      android: false,
      ios: false,
      inApp: false,
      restricted: false,
      uncertain: true,
      browser: 'none',
    });
  }

  const android = ANDROID_RE.test(ua);
  const ios = IOS_RE.test(ua);

  let browser = 'none';
  if (INSTAGRAM_RE.test(ua)) browser = 'instagram';
  else if (MESSENGER_RE.test(ua)) browser = 'messenger';
  else if (FACEBOOK_RE.test(ua)) browser = 'facebook';
  else if (android && WEBVIEW_RE.test(ua)) browser = 'webview';

  const inApp = browser !== 'none';
  return Object.freeze({
    ua,
    android,
    ios,
    inApp,
    restricted: inApp,
    uncertain: false,
    browser,
  });
}

/** True only for a confident Android restricted in-app browser. */
export function isChromeHandoffCandidate(detection) {
  return Boolean(detection && detection.android && detection.restricted && !detection.uncertain);
}

/**
 * Build the Android `intent://` URL that asks Chrome to open `url`.
 *
 * The target keeps the original host, pathname, query string and hash
 * (`intent://host/path?query#hash#Intent;…`). The full original URL is also
 * carried percent-encoded in `S.browser_fallback_url` so it survives the
 * intent round-trip. Returns null for anything that is not an absolute
 * http(s) URL — no other scheme is ever handed to the intent handler.
 *
 * @param {string} url
 * @param {{ packageName?: string }} [options]
 * @returns {string | null}
 */
export function buildChromeIntentUrl(url, options) {
  const packageName = (options && options.packageName) || CHROME_PACKAGE;
  if (typeof url !== 'string' || !url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const scheme = parsed.protocol.slice(0, -1);
  // host + pathname + query — everything before the fragment, verbatim.
  const target = parsed.host + parsed.pathname + parsed.search;
  const fragment = parsed.hash ? parsed.hash.slice(1) : '';
  const fallback = encodeURIComponent(url);
  return `intent://${target}${fragment ? `#${fragment}` : ''}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${fallback};end`;
}

/**
 * Copy-ready manual fallback for when the automatic handoff fails.
 * Plain data — every renderer (widget, React, host app) presents it its own way.
 *
 * @param {string} url
 * @param {Partial<Record<'title' | 'intro' | 'stepCopy' | 'stepSwitch' | 'stepPaste' | 'copyLabel' | 'copiedLabel' | 'openLabel' | 'dismissLabel', string>>} [labels]
 */
export function chromeHandoffInstructions(url, labels) {
  const l = labels || {};
  return Object.freeze({
    title: l.title || 'Open this page in Chrome',
    intro:
      l.intro ||
      'This in-app browser can hide features and break links. Continue in Chrome instead.',
    steps: Object.freeze([
      l.stepCopy || 'Copy the page address shown below.',
      l.stepSwitch || 'Leave this app and open Chrome on your device.',
      l.stepPaste || 'Paste the address into Chrome’s address bar and open it.',
    ]),
    url: typeof url === 'string' ? url : '',
    openLabel: l.openLabel || 'Open in Chrome',
    dismissLabel: l.dismissLabel || 'Not now',
    copyLabel: l.copyLabel || 'Copy address',
    copiedLabel: l.copiedLabel || 'Address copied.',
  });
}

/**
 * Controller shared by every renderer: detection, best-effort intent open and
 * the manual fallback handshake. All environment access is injectable so the
 * flow is testable without a browser.
 *
 * @param {{
 *   userAgent?: string,
 *   location?: { href?: string, assign?: (url: string) => void } | null,
 *   document?: { visibilityState?: string } | null,
 *   assign?: (url: string) => void,
 *   setTimeout?: (fn: () => void, ms: number) => unknown,
 *   clearTimeout?: (id: unknown) => void,
 *   fallbackDelayMs?: number,
 *   packageName?: string,
 *   labels?: Record<string, string>,
 * }} [options]
 */
export function createChromeHandoff(options) {
  const opts = options || {};
  const doc =
    opts.document !== undefined
      ? opts.document
      : typeof document !== 'undefined'
        ? document
        : null;
  const loc =
    opts.location !== undefined
      ? opts.location
      : typeof location !== 'undefined'
        ? location
        : null;
  const detection = detectInAppBrowser(
    opts.userAgent !== undefined
      ? opts.userAgent
      : typeof navigator !== 'undefined' && navigator
        ? navigator.userAgent
        : ''
  );
  const candidate = isChromeHandoffCandidate(detection);

  const assign =
    typeof opts.assign === 'function'
      ? opts.assign
      : loc && typeof loc.assign === 'function'
        ? loc.assign.bind(loc)
        : null;
  const schedule =
    typeof opts.setTimeout === 'function'
      ? opts.setTimeout
      : typeof setTimeout === 'function'
        ? setTimeout
        : null;
  const cancel =
    typeof opts.clearTimeout === 'function'
      ? opts.clearTimeout
      : typeof clearTimeout === 'function'
        ? clearTimeout
        : null;
  const fallbackDelayMs =
    typeof opts.fallbackDelayMs === 'number' && isFinite(opts.fallbackDelayMs)
      ? opts.fallbackDelayMs
      : 900;

  let timer = null;
  let destroyed = false;
  let currentUrl = '';

  function targetUrl(url) {
    if (typeof url === 'string' && url) return url;
    if (loc && typeof loc.href === 'string' && loc.href) return loc.href;
    return currentUrl || '';
  }

  function clearTimer() {
    if (timer !== null && typeof cancel === 'function') cancel(timer);
    timer = null;
  }

  function intentUrl(url) {
    return buildChromeIntentUrl(targetUrl(url), opts);
  }

  function instructions(url) {
    return chromeHandoffInstructions(targetUrl(url), opts.labels);
  }

  function open(url, onFallback) {
    currentUrl = targetUrl(url);
    const manual = instructions(currentUrl);

    if (!candidate) {
      return Object.freeze({ status: 'unsupported', intentUrl: null, instructions: manual });
    }
    const intent = buildChromeIntentUrl(currentUrl, opts);
    const fallback = typeof onFallback === 'function' ? onFallback : null;

    if (!intent || typeof assign !== 'function') {
      // Nothing to attempt with — go straight to the manual instructions.
      if (fallback) fallback(manual);
      return Object.freeze({ status: 'failed', intentUrl: intent, instructions: manual });
    }
    try {
      assign(intent);
    } catch (error) {
      if (fallback) fallback(manual);
      return Object.freeze({ status: 'failed', intentUrl: intent, instructions: manual });
    }

    // Best-effort handshake: if this document is still the visible one after
    // the delay, the intent did not leave the app — show the manual steps.
    if (schedule && doc && !destroyed) {
      clearTimer();
      timer = schedule(function () {
        timer = null;
        if (destroyed) return;
        const visible = !doc.visibilityState || doc.visibilityState === 'visible';
        if (visible && fallback) fallback(manual);
      }, fallbackDelayMs);
    }
    return Object.freeze({ status: 'attempted', intentUrl: intent, instructions: manual });
  }

  function destroy() {
    destroyed = true;
    clearTimer();
  }

  return Object.freeze({
    detection,
    shouldOffer() {
      return candidate;
    },
    intentUrl,
    instructions,
    open,
    destroy,
  });
}
