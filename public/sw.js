/**
 * Service Worker - Permanent Passthrough (Google-style)
 *
 * Zero caching. Intercepts nothing. Survives forever.
 *
 * WHY a permanent passthrough instead of unregister:
 *  - Unregistering leaves users with NO SW → no future control
 *  - A passthrough stays registered, so if a rogue lib installs a caching SW,
 *    this one is already in place and can be updated to block it
 *  - On activate, purges ALL legacy caches (dxf-viewer-cache-v1, etc.)
 *    to fix the "SyntaxError: illegal character U+0040" from stale CSS
 *
 * Pattern: Google Web Fundamentals — "Install a no-op SW to clear bad caches"
 * https://web.dev/service-worker-lifecycle/#updates
 *
 * SW_VERSION: bump this string whenever a breaking change requires forced update.
 */
const SW_VERSION = 'v3-passthrough-2026-04-16';

self.addEventListener('install', () => {
  // Activate immediately — do not wait for old SW to lose all clients
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

// Fetch: pure passthrough — zero caching, zero interception
self.addEventListener('fetch', () => {});
