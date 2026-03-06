/**
 * Service Worker - Unregister & Clean
 *
 * This SW auto-unregisters itself and clears all caches.
 * The previous SW was caching CSS/JS with stale hashes after deployments,
 * causing "Uncaught SyntaxError: Invalid or unexpected token" errors.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    })
  );
});
