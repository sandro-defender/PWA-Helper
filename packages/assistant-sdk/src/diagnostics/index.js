/*!
 * @you-ge/assistant-sdk/diagnostics — diagnostics integration adapter
 * -------------------------------------------------------------------
 * Integrates with the existing DNS diagnostics module (YouGeDns / PWA) or an
 * explicit local runner without duplicating the DoH engine, issuing hidden
 * network requests, or introducing automatic polling.
 */

import { safeText } from '../core/sanitize.js';

const DNS_FAILURE_CLASSIFICATIONS = [
  'nxdomain',
  'dns_resolution_failure',
  'dns_records_missing',
  'possible_dns_interference',
  'dns_failure',
  'dns-error',
  'dns_failed',
  'missing_address_records',
  'servfail',
  'refused',
];

const CONNECTIVITY_FAILURE_CLASSIFICATIONS = [
  'general_internet_failure',
  'application_host_unavailable',
  'backend_unavailable',
  'error',
  'timeout',
];

export function dnsFailure(dns) {
  const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
  return DNS_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1;
}

export function connectivityFailure(dns) {
  const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
  return CONNECTIVITY_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1 || Boolean(dns && dns.failed);
}

export function normalizeDnsResult(result, DateCtor) {
  const raw = result && typeof result === 'object' ? result : {};
  const DateImpl = DateCtor || Date;
  return {
    status: String(raw.status || 'complete'),
    classification: safeText(raw.classification || 'unknown', 60),
    message: safeText(raw.message || '', 240),
    checkedAt: raw.checkedAt ? safeText(raw.checkedAt, 60) : new DateImpl().toISOString(),
    failed: Boolean(raw.failed),
  };
}

export function resolveDiagnosticsRunner(options) {
  const opts = options || {};
  if (opts.services && typeof opts.services.diagnostics === 'function') {
    return opts.services.diagnostics;
  }
  const pwa = typeof opts.getPwa === 'function' ? opts.getPwa() : opts.pwa;
  if (pwa && typeof pwa.runNetworkDiagnostics === 'function') {
    return function (runOptions) {
      return pwa.runNetworkDiagnostics(runOptions);
    };
  }
  const dns = typeof opts.getDns === 'function' ? opts.getDns() : opts.dns;
  if (dns && typeof dns.check === 'function') {
    return function (runOptions) {
      const ctx = typeof opts.getContext === 'function' ? opts.getContext() : (opts.context || {});
      return dns.check({
        hostname: ctx.hostname,
        origin: ctx.origin,
        basePath: ctx.basePath || '/',
        online: ctx.online !== false,
      }, runOptions);
    };
  }
  return null;
}

export function createDiagnosticsIntegration(options) {
  const opts = options || {};
  let inFlight = null;

  function run(runOptions) {
    if (inFlight) return inFlight;
    const runner = resolveDiagnosticsRunner(opts);
    if (!runner) {
      const unavailable = {
        classification: 'unknown',
        message: 'Network diagnostics are not available on this page.',
        status: 'unavailable',
      };
      if (typeof opts.onResult === 'function') opts.onResult(unavailable);
      return Promise.resolve(unavailable);
    }

    if (typeof opts.onStart === 'function') opts.onStart();
    inFlight = Promise.resolve()
      .then(function () { return runner(runOptions); })
      .then(function (result) {
        const safeResult = result && typeof result === 'object' ? result : {};
        if (typeof opts.onResult === 'function') opts.onResult(safeResult);
        return safeResult;
      })
      .catch(function (error) {
        const failed = {
          classification: 'error',
          message: safeText(error && error.message, 200) || 'Diagnostics failed.',
          status: 'error',
          failed: true,
        };
        if (typeof opts.onResult === 'function') opts.onResult(failed);
        return failed;
      })
      .then(function (finalResult) {
        inFlight = null;
        return finalResult;
      });
    return inFlight;
  }

  function clear() {
    inFlight = null;
  }

  return {
    run: run,
    clear: clear,
    isRunning: function () { return Boolean(inFlight); },
  };
}
