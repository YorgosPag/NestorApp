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
 *    to fix the "SyntaxError: illegal character U+0040" from stale CSS —
 *    except the verified caches in PRESERVED_CACHES (ADR-929 Φ0.6)
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

/**
 * Caches that are OURS and verified, so the legacy purge must keep them.
 * - `nestor-models-v1`: the on-device OCR models (ADR-929 Φ0.6), sha256-verified per file by
 *   `src/subapps/dxf-viewer/bim/plan-recognition/ocr/ocr-asset-loader.ts` (`OCR_MODEL_CACHE` — keep both names in sync).
 *   Purging it would re-download ~15 MB of models after every SW update.
 */
const PRESERVED_CACHES = ['nestor-models-v1'];

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.filter((name) => !PRESERVED_CACHES.includes(name)).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: pure passthrough — zero caching, zero interception
self.addEventListener('fetch', () => {});
