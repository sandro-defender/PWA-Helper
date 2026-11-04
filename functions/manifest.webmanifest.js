// Cloudflare Pages Functions adapter. Deploy this alongside the static files
// to return a fresh, validated manifest for the requested origin.
import '../domain-registry.js';
import '../domain-config.js';
import '../manifest-handler.js';

export async function onRequest({ request }) {
  return globalThis.YouGeManifestHandler.handle(request);
}
