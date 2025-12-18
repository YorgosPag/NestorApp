/**
 * ⚡ DXF VIEWER SERVICE WORKER
 *
 * Enterprise-grade caching και performance optimization
 * για DXF Viewer application.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

const CACHE_NAME = 'dxf-viewer-cache-v1';
const CACHE_VERSION = 1;

// Assets που θα cached aggressively
const STATIC_ASSETS = [
  '/',
  '/dxf/viewer',
  '/manifest.json',
  '/favicon.ico',
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/_next/static/media/'
];

// API endpoints που θα cached με TTL
const API_CACHE_PATTERNS = [
  /^\/api\/dxf-files/,
  /^\/api\/projects/,
  /^\/api\/settings/
];

// Assets που ΔΕΝ θα cached (always fresh)
const NO_CACHE_PATTERNS = [
  /^\/api\/auth/,
  /^\/api\/upload/,
  /^\/api\/real-time/
];

// Performance monitoring
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  lastUpdated: Date.now()
};

/**
 * 📦 Install Event - Cache critical resources
 */
self.addEventListener('install', (event) => {
  console.log('⚡ DXF Service Worker installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll([
          '/',
          '/dxf/viewer'
        ]);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
  );
});

/**
 * 🔄 Activate Event - Clean old caches
 */
self.addEventListener('activate', (event) => {
  console.log('🔄 DXF Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * 🌐 Fetch Event - Intelligent caching strategy
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except for same origin)
  if (url.origin !== location.origin) return;

  performanceMetrics.networkRequests++;

  event.respondWith(
    handleRequest(request)
      .catch(error => {
        console.error('❌ Fetch error:', error);
        return new Response('Network error', { status: 503 });
      })
  );
});

/**
 * 🎯 Handle request with intelligent caching
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Check if should not cache
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(pathname))) {
    return fetchWithMetrics(request);
  }

  // API endpoint caching
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(pathname))) {
    return handleApiCache(request);
  }

  // Static asset caching
  if (isStaticAsset(pathname)) {
    return handleStaticCache(request);
  }

  // Page caching (SPA pages)
  if (pathname.startsWith('/dxf/') || pathname === '/') {
    return handlePageCache(request);
  }

  // Default: network first
  return fetchWithMetrics(request);
}

/**
 * 📊 API Caching με TTL (5 minutes)
 */
async function handleApiCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Check if cached response is still valid (5 minutes)
  if (cachedResponse) {
    const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0);
    const isExpired = Date.now() - cachedDate.getTime() > 5 * 60 * 1000; // 5 minutes

    if (!isExpired) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
  }

  // Fetch fresh data
  try {
    const networkResponse = await fetchWithMetrics(request);

    if (networkResponse.ok) {
      // Clone response for caching
      const responseToCache = networkResponse.clone();

      // Add cache timestamp header
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', new Date().toISOString());

      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });

      await cache.put(request, cachedResponse);
    }

    return networkResponse;
  } catch (error) {
    // Return stale cache if network fails
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * 🖼️ Static Asset Caching (Cache First)
 */
async function handleStaticCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    return cachedResponse;
  }

  // Fetch and cache
  const networkResponse = await fetchWithMetrics(request);

  if (networkResponse.ok) {
    await cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

/**
 * 📄 Page Caching (Network First με fallback)
 */
async function handlePageCache(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first για fresh content
    const networkResponse = await fetchWithMetrics(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }

    throw error;
  }
}

/**
 * 🌐 Fetch με performance tracking
 */
async function fetchWithMetrics(request) {
  performanceMetrics.cacheMisses++;

  const startTime = performance.now();
  const response = await fetch(request);
  const endTime = performance.now();

  // Broadcast performance data to clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'PERFORMANCE_METRIC',
      data: {
        url: request.url,
        duration: endTime - startTime,
        cacheHit: false,
        status: response.status
      }
    });
  });

  return response;
}

/**
 * ✅ Check if asset is static
 */
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];

  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname.startsWith('/_next/static/') ||
         pathname.startsWith('/static/');
}

/**
 * 📊 Performance metrics message
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_PERFORMANCE_METRICS') {
    const metrics = {
      ...performanceMetrics,
      cacheEfficiency: performanceMetrics.networkRequests > 0
        ? (performanceMetrics.cacheHits / performanceMetrics.networkRequests * 100).toFixed(1)
        : 0,
      lastUpdated: Date.now()
    };

    event.ports[0].postMessage(metrics);
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('🗑️ Cache cleared by user request');
      event.ports[0].postMessage({ success: true });
    });
  }
});

/**
 * ⚡ Preload critical resources
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRELOAD_RESOURCES') {
    const urls = event.data.urls || [];

    Promise.all(
      urls.map(url => {
        return caches.open(CACHE_NAME)
          .then(cache => cache.add(url))
          .catch(error => console.warn('Preload failed:', url, error));
      })
    ).then(() => {
      console.log('⚡ Resources preloaded:', urls.length);
    });
  }
});

console.log('🚀 DXF Viewer Service Worker loaded');