#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push.
 *
 *   node scripts/generate-vapid-keys.mjs
 *   node scripts/generate-vapid-keys.mjs --write
 *
 * --write saves .vapid-keys.json in the current directory. Add that file to
 * .gitignore and never expose the private key to the browser.
 */

import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const shouldWrite = process.argv.includes('--write');

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

const x = Buffer.from(publicJwk.x, 'base64url');
const y = Buffer.from(publicJwk.y, 'base64url');
const d = Buffer.from(privateJwk.d, 'base64url');

// web-push expects the uncompressed EC point (0x04 || X || Y), base64url.
const publicKeyBytes = Buffer.concat([Buffer.from([0x04]), x, y]);
const publicKeyValue = publicKeyBytes.toString('base64url');
const privateKeyValue = d.toString('base64url');

const keys = {
  publicKey: publicKeyValue,
  privateKey: privateKeyValue,
};

console.log('VAPID public key (safe to use in the browser):\n');
console.log(publicKeyValue);
console.log('\nVAPID private key (server only — never commit or ship this):\n');
console.log(privateKeyValue);
console.log('\nEnvironment variables:\n');
console.log('VAPID_PUBLIC_KEY=' + publicKeyValue);
console.log('VAPID_PRIVATE_KEY=' + privateKeyValue);
console.log('VAPID_SUBJECT=mailto:admin@staff.you.ge');

if (shouldWrite) {
  const target = '.vapid-keys.json';
  writeFileSync(target, JSON.stringify(keys, null, 2) + '\n', { mode: 0o600 });
  console.log('\nWrote ' + target + ' (mode 600). Add it to .gitignore.');
}

if (!shouldWrite) {
  console.log('\nTip: pass --write to save them to .vapid-keys.json.');
}
