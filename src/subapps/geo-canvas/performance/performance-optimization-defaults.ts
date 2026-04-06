/**
 * PERFORMANCE OPTIMIZATION — DEFAULT CONFIGURATIONS
 *
 * Default performance and CDN configuration objects,
 * plus mock data generation for metrics.
 * Extracted from PerformanceOptimization (ADR-065).
 *
 * @module performance/performance-optimization-defaults
 * @see PerformanceOptimization.ts
 */

import type {
  PerformanceConfiguration,
  CDNConfiguration,
  PerformanceMetrics,
  CDNMetrics,
  OptimizationRecommendation
} from './performance-optimization-types';

// ============================================================================
// DEFAULT PERFORMANCE CONFIG
// ============================================================================

export function getDefaultPerformanceConfiguration(): PerformanceConfiguration {
  return {
    caching: {
      enableBrowserCache: true,
      enableServiceWorker: true,
      cacheMaxAge: 31536000,
      staticAssetsCacheDuration: 31536000,
      apiCacheDuration: 300,
      enableRedisCache: true,
      redisTtl: 3600
    },
    compression: {
      enableGzip: true,
      enableBrotli: true,
      compressionLevel: 6,
      minCompressionSize: 1024
    },
    bundling: {
      enableCodeSplitting: true,
      enableTreeShaking: true,
      enableMinification: true,
      chunkSizeLimit: 250,
      enableDynamicImports: true
    },
    images: {
      enableWebP: true,
      enableAVIF: true,
      enableLazyLoading: true,
      imageOptimizationQuality: 80,
      enableResponsiveImages: true
    },
    networking: {
      enableHttp2: true,
      enableHttp3: true,
      connectionPooling: true,
      maxConcurrentConnections: 6,
      requestTimeout: 10000
    },
    preloading: {
      enableResourceHints: true,
      preloadCriticalAssets: true,
      prefetchNextPages: true,
      enableServiceWorkerPrefetch: true
    }
  };
}

// ============================================================================
// DEFAULT CDN CONFIG
// ============================================================================

export function getDefaultCDNConfiguration(): CDNConfiguration {
  return {
    provider: 'cloudflare',
    enabled: true,
    endpoints: [
      {
        id: 'cf-eu-central',
        name: 'Cloudflare EU Central',
        domain: 'eu-central.geoalert.cdn.example.com',
        origin: 'geoalert.example.com',
        region: 'EU-CENTRAL',
        protocol: 'https',
        status: 'active',
        healthCheck: true
      },
      {
        id: 'cf-us-east',
        name: 'Cloudflare US East',
        domain: 'us-east.geoalert.cdn.example.com',
        origin: 'geoalert.example.com',
        region: 'US-EAST',
        protocol: 'https',
        status: 'active',
        healthCheck: true
      },
      {
        id: 'cf-asia-pacific',
        name: 'Cloudflare Asia Pacific',
        domain: 'asia.geoalert.cdn.example.com',
        origin: 'geoalert.example.com',
        region: 'ASIA-PACIFIC',
        protocol: 'https',
        status: 'active',
        healthCheck: true
      }
    ],
    cacheSettings: {
      defaultTtl: 14400,
      maxTtl: 31536000,
      browserTtl: 1800,
      cacheByDeviceType: true,
      cacheByGeoLocation: true,
      bypassCacheOnCookie: false,
      purgeCapability: true
    },
    securitySettings: {
      enableWAF: true,
      enableDDoSProtection: true,
      enableBotManagement: true,
      enableRateLimiting: true,
      rateLimitRpm: 1000,
      allowedCountries: ['GR', 'DE', 'FR', 'US', 'GB'],
      blockedCountries: [],
      enableIPWhitelist: false,
      ipWhitelist: []
    },
    optimizationSettings: {
      enableImageOptimization: true,
      enableJSMinification: true,
      enableCSSMinification: true,
      enableHTMLMinification: true,
      enableAutoWebP: true,
      enableLosslessOptimization: true,
      enableSmartCompression: true
    },
    geoDistribution: {
      regions: [
        { id: 'eu-central', name: 'Europe Central', code: 'EU-CENTRAL', endpoints: 25, latency: 18, availability: 99.99 },
        { id: 'us-east', name: 'US East', code: 'US-EAST', endpoints: 35, latency: 22, availability: 99.98 },
        { id: 'asia-pacific', name: 'Asia Pacific', code: 'ASIA-PACIFIC', endpoints: 20, latency: 28, availability: 99.97 }
      ],
      enableGeoRouting: true,
      primaryRegion: 'EU-CENTRAL',
      fallbackRegion: 'US-EAST'
    }
  };
}

// ============================================================================
// MOCK METRICS GENERATORS
// ============================================================================

export function generateMockPerformanceMetrics(): PerformanceMetrics {
  return {
    timestamp: new Date(),
    webVitals: {
      firstContentfulPaint: Math.random() * 500 + 800,
      largestContentfulPaint: Math.random() * 800 + 1200,
      firstInputDelay: Math.random() * 50 + 20,
      cumulativeLayoutShift: Math.random() * 0.05 + 0.02,
      timeToInteractive: Math.random() * 1000 + 2000,
      totalBlockingTime: Math.random() * 200 + 100
    },
    networkMetrics: {
      totalRequests: Math.floor(Math.random() * 50) + 20,
      totalSize: Math.floor(Math.random() * 2000) + 1000,
      averageResponseTime: Math.random() * 200 + 50,
      cacheHitRatio: Math.random() * 20 + 75,
      cdnHitRatio: Math.random() * 15 + 80,
      bandwidthUsage: Math.random() * 50 + 20
    },
    resourceMetrics: {
      jsSize: Math.floor(Math.random() * 300) + 200,
      cssSize: Math.floor(Math.random() * 50) + 30,
      imageSize: Math.floor(Math.random() * 800) + 400,
      fontSize: Math.floor(Math.random() * 100) + 50,
      compressedRatio: Math.random() * 20 + 70
    },
    userExperience: {
      pageLoadTime: Math.random() * 1000 + 1500,
      timeToFirstByte: Math.random() * 300 + 100,
      interactivityTime: Math.random() * 800 + 1200,
      visualStability: Math.random() * 0.1 + 0.9,
      bounceRate: Math.random() * 20 + 10
    }
  };
}

export function generateMockCDNMetrics(cdnConfig: CDNConfiguration): CDNMetrics {
  return {
    timestamp: new Date(),
    performance: {
      globalLatency: Math.random() * 30 + 15,
      cacheHitRatio: Math.random() * 10 + 85,
      originRequests: Math.floor(Math.random() * 1000) + 500,
      cachedRequests: Math.floor(Math.random() * 8000) + 4000,
      totalTraffic: Math.random() * 50 + 20
    },
    regional: cdnConfig.geoDistribution.regions.map(region => ({
      region: region.code,
      latency: region.latency + Math.random() * 10 - 5,
      hitRatio: Math.random() * 15 + 80,
      traffic: Math.random() * 20 + 5,
      availability: region.availability - Math.random() * 0.05
    })),
    security: {
      blockedRequests: Math.floor(Math.random() * 100) + 20,
      ddosAttacks: Math.floor(Math.random() * 5),
      wafBlocks: Math.floor(Math.random() * 50) + 10,
      rateLimitHits: Math.floor(Math.random() * 200) + 50
    }
  };
}

// ============================================================================
// DEFAULT RECOMMENDATIONS
// ============================================================================

export function getDefaultRecommendations(): OptimizationRecommendation[] {
  return [
    {
      id: 'rec_001', category: 'images', priority: 'high',
      title: 'Implement WebP Image Format',
      description: 'Convert images to WebP format for better compression',
      impact: 'high', effort: 'low',
      potentialSavings: { loadTime: 400, bandwidth: 30, requests: 0 },
      implementation: ['Configure image optimization pipeline', 'Add WebP support to CDN', 'Implement fallback for older browsers']
    },
    {
      id: 'rec_002', category: 'bundling', priority: 'medium',
      title: 'Optimize JavaScript Bundle Size',
      description: 'Implement code splitting and remove unused dependencies',
      impact: 'medium', effort: 'medium',
      potentialSavings: { loadTime: 600, bandwidth: 25, requests: 3 },
      implementation: ['Analyze bundle with webpack-bundle-analyzer', 'Implement lazy loading for non-critical components', 'Remove unused npm packages']
    },
    {
      id: 'rec_003', category: 'caching', priority: 'high',
      title: 'Implement Service Worker Caching',
      description: 'Cache critical resources with service worker',
      impact: 'high', effort: 'medium',
      potentialSavings: { loadTime: 800, bandwidth: 40, requests: 15 },
      implementation: ['Configure Workbox for service worker', 'Define caching strategies per resource type', 'Implement cache invalidation logic']
    },
    {
      id: 'rec_004', category: 'cdn', priority: 'critical',
      title: 'Enable CDN Edge Caching',
      description: 'Configure aggressive caching for static assets',
      impact: 'high', effort: 'low',
      potentialSavings: { loadTime: 500, bandwidth: 35, requests: 8 },
      implementation: ['Configure cache headers for static assets', 'Enable CDN edge caching rules', 'Implement cache purging workflow']
    }
  ];
}
