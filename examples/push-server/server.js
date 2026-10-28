/**
 * Minimal Web Push sender for the PWA kit.
 *
 * This is an example, not production auth. In a real app, key subscriptions by
 * your logged-in user instead of by endpoint, and protect these routes with your
 * existing session middleware.
 *
 *   npm install
 *   node ../../scripts/generate-vapid-keys.mjs --write
 *   VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com node server.js
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const dataFile = process.env.DATA_FILE || join(here, 'subscriptions.json');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (!publicKey || !privateKey) {
  console.error('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. See scripts/generate-vapid-keys.mjs.');
  process.exit(1);
}

webpush.setVapidDetails(subject, publicKey, privateKey);

/** @type {Map<string, { endpoint: string, expirationTime: number|null, keys: { p256dh: string, auth: string } }>} */
const subscriptions = new Map();

if (existsSync(dataFile)) {
  try {
    const saved = JSON.parse(readFileSync(dataFile, 'utf8'));
    Object.entries(saved).forEach(([endpoint, subscription]) => subscriptions.set(endpoint, subscription));
    console.log('Loaded ' + subscriptions.size + ' subscription(s) from ' + dataFile);
  } catch (error) {
    console.warn('Could not read ' + dataFile + ': ' + error.message);
  }
}

function persist() {
  const object = {};
  subscriptions.forEach((subscription, endpoint) => {
    object[endpoint] = subscription;
  });
  writeFileSync(dataFile, JSON.stringify(object, null, 2) + '\n');
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function normalizeSubscription(body) {
  const subscription = body.subscription || body;
  if (!subscription || !subscription.endpoint || !subscription.keys) return null;
  if (!subscription.keys.p256dh || !subscription.keys.auth) return null;
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime || null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
}

async function sendTo(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60 * 60 * 24,
    urgency: payload.requireInteraction ? 'high' : 'normal',
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost'));

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { ok: true, subscriptions: subscriptions.size });
    }

    if (request.method === 'GET' && url.pathname === '/api/push/public-key') {
      return sendJson(response, 200, { publicKey });
    }

    if (request.method === 'POST' && url.pathname === '/api/push/subscribe') {
      const subscription = normalizeSubscription(await readBody(request));
      if (!subscription) return sendJson(response, 400, { ok: false, error: 'Invalid subscription' });
      subscriptions.set(subscription.endpoint, subscription);
      persist();
      console.log('Subscribed ' + subscription.endpoint.slice(0, 48) + '…');
      return sendJson(response, 201, { ok: true, count: subscriptions.size });
    }

    if (request.method === 'DELETE' && url.pathname === '/api/push/subscribe') {
      const body = await readBody(request);
      const endpoint = body.endpoint || (body.subscription && body.subscription.endpoint);
      if (!endpoint) return sendJson(response, 400, { ok: false, error: 'Missing endpoint' });
      subscriptions.delete(endpoint);
      persist();
      return sendJson(response, 200, { ok: true, count: subscriptions.size });
    }

    if (request.method === 'POST' && (url.pathname === '/api/push/send' || url.pathname === '/api/push/test')) {
      const body = await readBody(request);
      const payload = {
        title: body.title || 'staff.you.ge',
        body: body.body || 'Test notification',
        icon: body.icon || '/icons/icon-192.png',
        url: body.url || '/',
        tag: body.tag,
        unread: body.unread,
        actions: body.actions,
      };

      let sent = 0;
      let removed = 0;
      const errors = [];

      for (const [endpoint, subscription] of subscriptions) {
        try {
          await sendTo(subscription, payload);
          sent += 1;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            subscriptions.delete(endpoint);
            removed += 1;
          } else {
            errors.push({ endpoint: endpoint.slice(0, 48), status: error.statusCode, message: error.message });
          }
        }
      }

      if (removed) persist();
      return sendJson(response, 200, { ok: errors.length === 0, sent, removed, errors });
    }

    return sendJson(response, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log('Push server on http://localhost:' + port);
  console.log('Subscribe endpoint: POST /api/push/subscribe');
  console.log('Send endpoint:      POST /api/push/send');
});
