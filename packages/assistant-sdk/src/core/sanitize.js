/*!
 * @you-ge/assistant-sdk — pure sanitization and security validation helpers
 */

function isUnsafeKey(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

const SECRET_KEY_PATTERN = /^(?:secret|secrets|api[_-]?key|private[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|bearer|authorization|credentials|vapid[_-]?private[_-]?key|signing[_-]?key|encryption[_-]?key|cookie|token)$/i;

const EXECUTABLE_STRING_PATTERN = /(?:^\s*(?:javascript|vbscript|data\s*:\s*text\/javascript)\s*:|<\s*script\b|\beval\s*\(|\bnew\s+Function\s*\()/i;

export function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach(function (key) {
      if (isUnsafeKey(key)) return;
      copy[key] = clone(value[key]);
    });
    return copy;
  }
  return value;
}

export function merge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
  Object.keys(source).forEach(function (key) {
    if (isUnsafeKey(key)) return;
    const value = source[key];
    if (value === undefined) return;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      merge(target[key], value);
    } else {
      target[key] = clone(value);
    }
  });
  return target;
}

export function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeText(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max || 120);
}

export function safeRelativeUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) {
    return false;
  }
  let path = value.split(/[?#]/)[0];
  try {
    path = decodeURIComponent(path);
  } catch (error) {
    return false;
  }
  return !path.split('/').some(function (part) { return part === '..'; });
}

export function safeSameOriginIcon(value, fallback, baseHref, UrlCtor) {
  if (!value) return fallback;
  const URLImpl = UrlCtor || URL;
  try {
    const base = new URLImpl(baseHref || 'https://localhost/');
    const url = new URLImpl(String(value), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    if (url.origin !== base.origin) return fallback;
    return url.pathname + url.search;
  } catch (error) {
    return fallback;
  }
}

export function isSecretKey(key) {
  return SECRET_KEY_PATTERN.test(String(key || '').trim());
}

export function isExecutableString(value) {
  return typeof value === 'string' && EXECUTABLE_STRING_PATTERN.test(value);
}

export function inspectConfigSafety(value, options) {
  const opts = options || {};
  const allowServiceFunctions = Boolean(opts.allowServiceFunctions);
  const report = {
    hasFunction: false,
    hasExecutableString: false,
    secretKeys: [],
  };

  function visit(node, path, depth) {
    if (depth > 12 || node == null) return;
    if (typeof node === 'function') {
      if (allowServiceFunctions && path === 'services.diagnostics') return;
      report.hasFunction = true;
      return;
    }
    if (typeof node === 'string') {
      if (isExecutableString(node)) report.hasExecutableString = true;
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], path + '[' + i + ']', depth + 1);
      }
      return;
    }
    if (typeof node === 'object') {
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (isUnsafeKey(key)) continue;
        if (isSecretKey(key)) {
          report.secretKeys.push(path ? path + '.' + key : key);
        }
        visit(node[key], path ? path + '.' + key : key, depth + 1);
      }
    }
  }

  visit(value, '', 0);
  return report;
}

export function sanitizePlainData(value, depth) {
  const level = depth || 0;
  if (level > 12 || value == null) return null;
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value === 'string') {
    return isExecutableString(value) ? '' : value;
  }
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map(function (item) { return sanitizePlainData(item, level + 1); })
      .filter(function (item) { return item !== undefined; });
  }
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) {
      if (isUnsafeKey(key) || isSecretKey(key)) return;
      const cleaned = sanitizePlainData(value[key], level + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out;
  }
  return undefined;
}
