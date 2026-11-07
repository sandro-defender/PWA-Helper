import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHROME_OFFER_STORAGE_KEY,
  CHROME_PACKAGE,
  buildChromeIntentUrl,
  chromeHandoffInstructions,
  createChromeHandoff,
  detectInAppBrowser,
  isChromeHandoffCandidate,
} from '../src/browser/index.js';

/* ------------------------------------------------------------------ *
 * Audit regressions (0.1.1): Android in-app browser detection +       *
 * Chrome handoff — identification, intent URL building, the           *
 * best-effort open handshake and the manual fallback.                 *
 * ------------------------------------------------------------------ */

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const ANDROID_FACEBOOK =
  'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/460.0.0.36.107;]';
const ANDROID_MESSENGER =
  'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 [FBAN/MessengerForAndroid;FBAV/431.0.0.29.119;]';
const ANDROID_INSTAGRAM =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 Instagram 312.0.0.0.0 Android';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 11; RMX2151; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36';
const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

test('the browser helper module stays dependency-free and network-free', async () => {
  const source = readFileSync(new URL('../src/browser/index.js', import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\.register\s*\(/);
  assert.doesNotMatch(source, /\bsetInterval\s*\(/);
  assert.doesNotMatch(source, /^import\s/m);
  assert.doesNotMatch(source, /staff\.you\.ge|workers\.dev/);
  const browserModule = await import('../src/browser/index.js');
  assert.equal(typeof browserModule.detectInAppBrowser, 'function');
});

test('supported browsers (Android Chrome, iOS Safari, desktop Chrome) are never candidates', () => {
  for (const ua of [ANDROID_CHROME, IOS_SAFARI, DESKTOP_CHROME]) {
    const detection = detectInAppBrowser(ua);
    assert.equal(detection.uncertain, false, ua.slice(0, 30));
    assert.equal(detection.inApp, false, ua.slice(0, 30));
    assert.equal(detection.restricted, false, ua.slice(0, 30));
    assert.equal(isChromeHandoffCandidate(detection), false, ua.slice(0, 30));
  }
  assert.equal(detectInAppBrowser(IOS_SAFARI).ios, true);
  assert.equal(detectInAppBrowser(IOS_SAFARI).android, false);
  assert.equal(detectInAppBrowser(ANDROID_CHROME).android, true);
});

test('Facebook, Messenger and Instagram in-app browsers on Android are confident candidates', () => {
  const facebook = detectInAppBrowser(ANDROID_FACEBOOK);
  assert.equal(facebook.android, true);
  assert.equal(facebook.inApp, true);
  assert.equal(facebook.restricted, true);
  assert.equal(facebook.uncertain, false);
  assert.equal(facebook.browser, 'facebook');
  assert.equal(isChromeHandoffCandidate(facebook), true);

  const messenger = detectInAppBrowser(ANDROID_MESSENGER);
  assert.equal(messenger.inApp, true);
  assert.equal(messenger.browser, 'messenger', 'Messenger wins over its FBAN parent markers');
  assert.equal(isChromeHandoffCandidate(messenger), true);

  const instagram = detectInAppBrowser(ANDROID_INSTAGRAM);
  assert.equal(instagram.inApp, true);
  assert.equal(instagram.browser, 'instagram');
  assert.equal(isChromeHandoffCandidate(instagram), true);
});

test('the generic Android webview marker is restricted but an iOS in-app is not a candidate', () => {
  const webview = detectInAppBrowser(ANDROID_WEBVIEW);
  assert.equal(webview.android, true);
  assert.equal(webview.browser, 'webview');
  assert.equal(webview.restricted, true);
  assert.equal(isChromeHandoffCandidate(webview), true);

  const iosFacebook = detectInAppBrowser(ANDROID_FACEBOOK.replace('Linux; Android 13; SM-A536B', 'iPhone; CPU iPhone OS 17_4 like Mac OS X').replace('Mobile Safari', 'Mobile Safari'));
  assert.equal(iosFacebook.ios, true);
  assert.equal(iosFacebook.inApp, true, 'iOS Facebook in-app is still identified');
  assert.equal(isChromeHandoffCandidate(iosFacebook), false, 'the handoff only exists for Android');
});

test('a missing or non-string user agent is uncertain and never a candidate', () => {
  for (const ua of [undefined, null, '', '   ', 42]) {
    const detection = detectInAppBrowser(ua);
    assert.equal(detection.uncertain, true, String(ua));
    assert.equal(detection.inApp, false, String(ua));
    assert.equal(isChromeHandoffCandidate(detection), false, String(ua));
    assert.equal(isChromeHandoffCandidate(null), false);
    assert.equal(isChromeHandoffCandidate(undefined), false);
  }
  assert.equal(detectInAppBrowser('').ua, '');
});

test('the intent URL preserves the original pathname, query string and hash', () => {
  const original = 'https://example.test/staff/home?tab=2&next=%2Fdeep#section-4';
  const intent = buildChromeIntentUrl(original);
  assert.equal(
    intent,
    `intent://example.test/staff/home?tab=2&next=%2Fdeep#section-4#Intent;scheme=https;package=${CHROME_PACKAGE};S.browser_fallback_url=${encodeURIComponent(original)};end`
  );
  // The fragment stays readable in the handoff URL and the full original URL
  // also survives percent-encoded in the fallback slot.
  assert.ok(intent.includes('#section-4#Intent;'));
  assert.ok(intent.includes(encodeURIComponent(original)));
});

test('the intent URL honours a custom package and rejects anything but absolute http(s)', () => {
  const custom = buildChromeIntentUrl('https://example.test/x', { packageName: 'com.example.browser' });
  assert.ok(custom.includes('package=com.example.browser'));

  const http = buildChromeIntentUrl('http://example.test/plain');
  assert.ok(http.includes('scheme=http'));

  assert.equal(buildChromeIntentUrl('notaurl'), null);
  assert.equal(buildChromeIntentUrl('javascript:alert(1)'), null);
  assert.equal(buildChromeIntentUrl(''), null);
  assert.equal(buildChromeIntentUrl(undefined), null);
  assert.equal(buildChromeIntentUrl(42), null);
});

test('manual instructions are plain copy-ready data with the original URL attached', () => {
  const instructions = chromeHandoffInstructions('https://example.test/a?b=1#f');
  assert.equal(instructions.url, 'https://example.test/a?b=1#f');
  assert.equal(instructions.steps.length, 3);
  assert.match(instructions.title, /Chrome/);
  assert.match(instructions.openLabel, /Open in Chrome/);
  assert.equal(typeof instructions.dismissLabel, 'string');

  const custom = chromeHandoffInstructions('https://x.test/', { title: 'Custom title', openLabel: 'Go' });
  assert.equal(custom.title, 'Custom title');
  assert.equal(custom.openLabel, 'Go');
});

test('createChromeHandoff only offers on confident Android in-app detections', () => {
  const facebook = createChromeHandoff({ userAgent: ANDROID_FACEBOOK, location: { href: 'https://example.test/' } });
  assert.equal(facebook.shouldOffer(), true);
  assert.equal(facebook.detection.browser, 'facebook');

  const chrome = createChromeHandoff({ userAgent: ANDROID_CHROME, location: { href: 'https://example.test/' } });
  assert.equal(chrome.shouldOffer(), false);
  assert.equal(chrome.detection.browser, 'none');

  const unknown = createChromeHandoff({ userAgent: '', location: { href: 'https://example.test/' } });
  assert.equal(unknown.shouldOffer(), false);
  assert.equal(unknown.detection.uncertain, true);
});

test('a successful handoff attempts the intent and reports attempted', () => {
  const assigned = [];
  const handoff = createChromeHandoff({
    userAgent: ANDROID_FACEBOOK,
    location: { href: 'https://example.test/staff?q=1#top' },
    assign: (url) => assigned.push(url),
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  const result = handoff.open();
  assert.equal(result.status, 'attempted');
  assert.equal(assigned.length, 1);
  assert.match(assigned[0], /^intent:\/\/example\.test\/staff\?q=1#top#Intent;/);
  assert.equal(result.intentUrl, assigned[0]);
  assert.equal(result.instructions.url, 'https://example.test/staff?q=1#top');
});

test('a failing handoff reports failed and hands over the manual instructions', () => {
  const handoff = createChromeHandoff({
    userAgent: ANDROID_FACEBOOK,
    location: { href: 'https://example.test/a?b=2#frag' },
    assign: () => {
      throw new Error('no intent handler');
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  let manual = null;
  const result = handoff.open(undefined, (instructions) => {
    manual = instructions;
  });
  assert.equal(result.status, 'failed');
  assert.ok(manual, 'the manual fallback fires immediately on failure');
  assert.equal(manual.url, 'https://example.test/a?b=2#frag', 'the original URL is preserved verbatim');
  assert.equal(manual.steps.length, 3);
});

test('an unsupported detection never navigates and never schedules a fallback', () => {
  const assigned = [];
  const handoff = createChromeHandoff({
    userAgent: DESKTOP_CHROME,
    location: { href: 'https://example.test/' },
    assign: (url) => assigned.push(url),
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  let fallbackFired = false;
  const result = handoff.open(undefined, () => {
    fallbackFired = true;
  });
  assert.equal(result.status, 'unsupported');
  assert.equal(assigned.length, 0, 'no intent URL is ever attempted for supported browsers');
  assert.equal(fallbackFired, false);
  assert.equal(result.intentUrl, null);
});

test('the delayed fallback fires only when the document is still visible', () => {
  const timers = [];
  const handoff = createChromeHandoff({
    userAgent: ANDROID_MESSENGER,
    location: { href: 'https://example.test/m?thread=1' },
    assign: () => {},
    document: { visibilityState: 'visible' },
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout: () => {},
    fallbackDelayMs: 750,
  });
  let manual = null;
  const result = handoff.open(undefined, (instructions) => {
    manual = instructions;
  });
  assert.equal(result.status, 'attempted');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 750);
  assert.equal(manual, null, 'the fallback waits for the delay');
  timers[0].fn();
  assert.ok(manual, 'still visible after the delay → manual instructions');
  assert.equal(manual.url, 'https://example.test/m?thread=1');

  const hiddenTimers = [];
  const hiddenHandoff = createChromeHandoff({
    userAgent: ANDROID_MESSENGER,
    location: { href: 'https://example.test/' },
    assign: () => {},
    document: { visibilityState: 'hidden' },
    setTimeout: (fn) => {
      hiddenTimers.push(fn);
      return hiddenTimers.length;
    },
    clearTimeout: () => {},
  });
  let hiddenFallback = false;
  hiddenHandoff.open(undefined, () => {
    hiddenFallback = true;
  });
  hiddenTimers[0]();
  assert.equal(hiddenFallback, false, 'the page left the app (tab hidden) → no manual prompt');
});

test('destroy cancels the pending fallback timer', () => {
  const cancelled = [];
  const handoff = createChromeHandoff({
    userAgent: ANDROID_INSTAGRAM,
    location: { href: 'https://example.test/' },
    assign: () => {},
    document: { visibilityState: 'visible' },
    setTimeout: (fn) => ({ fn }),
    clearTimeout: (id) => cancelled.push(id),
  });
  handoff.open();
  handoff.destroy();
  assert.equal(cancelled.length, 1, 'destroy clears the scheduled fallback');
  handoff.destroy(); // idempotent
});

test('the shared offer dismissal key is stable for every renderer', () => {
  assert.equal(CHROME_OFFER_STORAGE_KEY, 'youge-assistant:chrome-offer-dismissed');
  assert.equal(CHROME_PACKAGE, 'com.android.chrome');
});
