/**
 * PERFORMANCE OPTIMIZATION — TYPE DEFINITIONS
 *
 * Types and interfaces for the GeoAlert Performance Optimization
 * & CDN Management System.
 * Extracted from PerformanceOptimization (ADR-065).
 *
 * @module performance/performance-optimization-types
 * @see PerformanceOptimization.ts
 */

// ============================================================================
// PERFORMANCE CONFIGURATION
// ============================================================================

export interface PerformanceConfiguration {
  caching: {
    enableBrowserCache: boolean;
    enableServiceWorker: boolean;
    cacheMaxAge: number;
    staticAssetsCacheDuration: number;
    apiCacheDuration: number;
    enableRedisCache: boolean;
    redisTtl: number;
  };
  compression: {
    enableGzip: boolean;
    enableBrotli: boolean;
    compressionLevel: number;
    minCompressionSize: number;
  };
  bundling: {
    enableCodeSplitting: boolean;
    enableTreeShaking: boolean;
    enableMinification: boolean;
    chunkSizeLimit: number;
    enableDynamicImports: boolean;
  };
  images: {
    enableWebP: boolean;
    enableAVIF: boolean;
    enableLazyLoading: boolean;
    imageOptimizationQuality: number;
    enableResponsiveImages: boolean;
  };
  networking: {
    enableHttp2: boolean;
    enableHttp3: boolean;
    connectionPooling: boolean;
    maxConcurrentConnections: number;
    requestTimeout: number;
  };
  preloading: {
    enableResourceHints: boolean;
    preloadCriticalAssets: boolean;
    prefetchNextPages: boolean;
    enableServiceWorkerPrefetch: boolean;
  };
}

// ============================================================================
// CDN CONFIGURATION
// ============================================================================

export interface CDNConfiguration {
  provider: 'cloudflare' | 'aws-cloudfront' | 'azure-cdn' | 'google-cloud-cdn' | 'fastly';
  enabled: boolean;
  endpoints: CDNEndpoint[];
  cacheSettings: CDNCacheSettings;
  securitySettings: CDNSecuritySettings;
  optimizationSettings: CDNOptimizationSettings;
  geoDistribution: CDNGeoDistribution;
}

export interface CDNEndpoint {
  id: string;
  name: string;
  domain: string;
  origin: string;
  region: string;
  protocol: 'https' | 'http';
  status: 'active' | 'inactive' | 'maintenance';
  healthCheck: boolean;
}

export interface CDNCacheSettings {
  defaultTtl: number;
  maxTtl: number;
  browserTtl: number;
  cacheByDeviceType: boolean;
  cacheByGeoLocation: boolean;
  bypassCacheOnCookie: boolean;
  purgeCapability: boolean;
}

export interface CDNSecuritySettings {
  enableWAF: boolean;
  enableDDoSProtection: boolean;
  enableBotManagement: boolean;
  enableRateLimiting: boolean;
  rateLimitRpm: number;
  allowedCountries: string[];
  blockedCountries: string[];
  enableIPWhitelist: boolean;
  ipWhitelist: string[];
}

export interface CDNOptimizationSettings {
  enableImageOptimization: boolean;
  enableJSMinification: boolean;
  enableCSSMinification: boolean;
  enableHTMLMinification: boolean;
  enableAutoWebP: boolean;
  enableLosslessOptimization: boolean;
  enableSmartCompression: boolean;
}

export interface CDNGeoDistribution {
  regions: CDNRegion[];
  enableGeoRouting: boolean;
  primaryRegion: string;
  fallbackRegion: string;
}

export interface CDNRegion {
  id: string;
  name: string;
  code: string;
  endpoints: number;
  latency: number;
  availability: number;
}

// ============================================================================
// METRICS
// ============================================================================

export interface PerformanceMetrics {
  timestamp: Date;
  webVitals: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
    timeToInteractive: number;
    totalBlockingTime: number;
  };
  networkMetrics: {
    totalRequests: number;
    totalSize: number;
    averageResponseTime: number;
    cacheHitRatio: number;
    cdnHitRatio: number;
    bandwidthUsage: number;
  };
  resourceMetrics: {
    jsSize: number;
    cssSize: number;
    imageSize: number;
    fontSize: number;
    compressedRatio: number;
  };
  userExperience: {
    pageLoadTime: number;
    timeToFirstByte: number;
    interactivityTime: number;
    visualStability: number;
    bounceRate: number;
  };
}

export interface CDNMetrics {
  timestamp: Date;
  performance: {
    globalLatency: number;
    cacheHitRatio: number;
    originRequests: number;
    cachedRequests: number;
    totalTraffic: number;
  };
  regional: {
    region: string;
    latency: number;
    hitRatio: number;
    traffic: number;
    availability: number;
  }[];
  security: {
    blockedRequests: number;
    ddosAttacks: number;
    wafBlocks: number;
    rateLimitHits: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  category: 'caching' | 'compression' | 'bundling' | 'images' | 'networking' | 'cdn';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  potentialSavings: {
    loadTime: number;
    bandwidth: number;
    requests: number;
  };
  implementation: string[];
}
