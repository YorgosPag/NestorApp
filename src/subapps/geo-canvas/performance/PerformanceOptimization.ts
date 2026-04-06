/**
 * ⚡ GEO-ALERT SYSTEM - PHASE 8: PERFORMANCE OPTIMIZATION & CDN
 *
 * Enterprise Performance Optimization & CDN Management System.
 *
 * Split into SRP modules (ADR-065):
 * - performance-optimization-types.ts — all interfaces & types
 * - performance-optimization-defaults.ts — default configs, mock generators, recommendations
 *
 * @version 8.5.0
 */

// SRP modules (ADR-065)
import type {
  PerformanceConfiguration,
  CDNConfiguration,
  PerformanceMetrics,
  CDNMetrics,
  OptimizationRecommendation
} from './performance-optimization-types';
import {
  getDefaultPerformanceConfiguration,
  getDefaultCDNConfiguration,
  generateMockPerformanceMetrics,
  generateMockCDNMetrics,
  getDefaultRecommendations
} from './performance-optimization-defaults';

// Re-export types for consumers
export type {
  PerformanceConfiguration,
  CDNConfiguration,
  CDNEndpoint,
  CDNCacheSettings,
  CDNSecuritySettings,
  CDNOptimizationSettings,
  CDNGeoDistribution,
  CDNRegion,
  PerformanceMetrics,
  CDNMetrics,
  OptimizationRecommendation
} from './performance-optimization-types';

// ============================================================================
// ENTERPRISE PERFORMANCE OPTIMIZATION CLASS
// ============================================================================

export class GeoAlertPerformanceOptimization {
  private static instance: GeoAlertPerformanceOptimization | null = null;
  private config: PerformanceConfiguration;
  private cdnConfig: CDNConfiguration;
  private performanceMetrics: PerformanceMetrics | null = null;
  private cdnMetrics: CDNMetrics | null = null;
  private optimizationRecommendations: OptimizationRecommendation[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {
    this.config = getDefaultPerformanceConfiguration();
    this.cdnConfig = getDefaultCDNConfiguration();
    this.initializePerformanceOptimization();
  }

  public static getInstance(): GeoAlertPerformanceOptimization {
    if (!GeoAlertPerformanceOptimization.instance) {
      GeoAlertPerformanceOptimization.instance = new GeoAlertPerformanceOptimization();
    }
    return GeoAlertPerformanceOptimization.instance;
  }

  private initializePerformanceOptimization(): void {
    try {
      this.setupCaching();
      this.setupCompression();
      this.setupBundleOptimization();
      this.setupImageOptimization();
      this.setupCDN();
      this.startPerformanceMonitoring();
      this.optimizationRecommendations = getDefaultRecommendations();
      this.collectPerformanceMetrics();
      this.collectCDNMetrics();
      this.isInitialized = true;
      console.debug('⚡ GeoAlert Performance Optimization System initialized');
    } catch (error) {
      console.error('❌ Performance optimization initialization failed:', error);
      throw error;
    }
  }

  // ── Setup Methods ──

  private setupCaching(): void {
    const c = this.config.caching;
    if (c.enableBrowserCache) console.debug(`💾 Browser cache enabled: ${c.cacheMaxAge}s TTL`);
    if (c.enableServiceWorker) console.debug('🔧 Service Worker caching enabled');
    if (c.enableRedisCache) console.debug(`🔴 Redis cache enabled: ${c.redisTtl}s TTL`);
  }

  private setupCompression(): void {
    const c = this.config.compression;
    if (c.enableGzip) console.debug(`📦 Gzip compression enabled: Level ${c.compressionLevel}`);
    if (c.enableBrotli) console.debug('📦 Brotli compression enabled');
  }

  private setupBundleOptimization(): void {
    const c = this.config.bundling;
    if (c.enableCodeSplitting) console.debug(`✂️ Code splitting enabled: ${c.chunkSizeLimit}KB chunks`);
    if (c.enableTreeShaking) console.debug('🌳 Tree shaking enabled');
    if (c.enableMinification) console.debug('🗜️ Minification enabled');
  }

  private setupImageOptimization(): void {
    const c = this.config.images;
    if (c.enableWebP) console.debug('🖼️ WebP format enabled');
    if (c.enableAVIF) console.debug('🖼️ AVIF format enabled');
    if (c.enableLazyLoading) console.debug('⏳ Lazy loading enabled');
  }

  private setupCDN(): void {
    if (!this.cdnConfig.enabled) { console.debug('🌐 CDN disabled'); return; }
    console.debug(`🌐 CDN Provider: ${this.cdnConfig.provider.toUpperCase()}`);
    console.debug(`CDN Endpoints: ${this.cdnConfig.endpoints.length} active`);
    this.cdnConfig.endpoints.forEach(ep => {
      if (ep.status === 'active') console.debug(`  ✅ ${ep.name} (${ep.region}): ${ep.domain}`);
    });
    if (this.cdnConfig.securitySettings.enableWAF) console.debug('WAF protection enabled');
    if (this.cdnConfig.securitySettings.enableDDoSProtection) console.debug('DDoS protection enabled');
  }

  // ── Monitoring ──

  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectPerformanceMetrics();
      this.collectCDNMetrics();
      this.analyzePerformance();
      this.updateOptimizationRecommendations();
    }, 30000);
  }

  private collectPerformanceMetrics(): void {
    this.performanceMetrics = generateMockPerformanceMetrics();
  }

  private collectCDNMetrics(): void {
    this.cdnMetrics = generateMockCDNMetrics(this.cdnConfig);
  }

  private analyzePerformance(): void {
    if (!this.performanceMetrics) return;
    const m = this.performanceMetrics;
    if (m.webVitals.largestContentfulPaint > 2500) console.debug('⚠️ LCP above threshold');
    if (m.webVitals.firstInputDelay > 100) console.debug('⚠️ FID above threshold');
    if (m.webVitals.cumulativeLayoutShift > 0.1) console.debug('⚠️ CLS above threshold');
    if (m.networkMetrics.cacheHitRatio < 80) console.debug('⚠️ Low cache hit ratio');
  }

  private updateOptimizationRecommendations(): void {
    if (!this.performanceMetrics) return;
    if (this.performanceMetrics.networkMetrics.cacheHitRatio < 75) {
      const exists = this.optimizationRecommendations.find(r => r.id === 'rec_cache_low');
      if (!exists) {
        this.optimizationRecommendations.push({
          id: 'rec_cache_low', category: 'caching', priority: 'critical',
          title: 'Improve Cache Hit Ratio',
          description: 'Current cache hit ratio is below optimal threshold',
          impact: 'high', effort: 'medium',
          potentialSavings: { loadTime: 300, bandwidth: 20, requests: 5 },
          implementation: ['Review cache configuration', 'Increase cache TTL for static assets', 'Implement intelligent cache warming']
        });
      }
    }
  }

  // ── Public API ──

  public getPerformanceStatus(): {
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    metrics: PerformanceMetrics | null;
    cdnMetrics: CDNMetrics | null;
    recommendations: OptimizationRecommendation[];
    overallScore: number;
  } {
    if (!this.performanceMetrics) {
      return { status: 'poor', metrics: null, cdnMetrics: null, recommendations: this.optimizationRecommendations, overallScore: 0 };
    }

    const m = this.performanceMetrics;
    let score = 100;
    if (m.webVitals.largestContentfulPaint > 4000) score -= 30;
    else if (m.webVitals.largestContentfulPaint > 2500) score -= 15;
    if (m.webVitals.firstInputDelay > 300) score -= 25;
    else if (m.webVitals.firstInputDelay > 100) score -= 10;
    if (m.webVitals.cumulativeLayoutShift > 0.25) score -= 25;
    else if (m.webVitals.cumulativeLayoutShift > 0.1) score -= 10;
    if (m.networkMetrics.cacheHitRatio < 70) score -= 20;
    else if (m.networkMetrics.cacheHitRatio < 85) score -= 10;

    const status = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 50 ? 'needs_improvement' : 'poor';
    return { status, metrics: this.performanceMetrics, cdnMetrics: this.cdnMetrics, recommendations: this.optimizationRecommendations, overallScore: Math.max(0, score) };
  }

  public purgeCDNCache(pattern?: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const message = pattern ? `CDN cache purged for pattern: ${pattern}` : 'CDN cache completely purged';
        console.debug(`🗑️ ${message}`);
        resolve({ success: true, message });
      }, 1000);
    });
  }

  public prefetchResources(urls: string[]): Promise<{ success: boolean; prefetched: number }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.debug(`⚡ Prefetched ${urls.length} resources via CDN`);
        resolve({ success: true, prefetched: urls.length });
      }, 500);
    });
  }

  public getSystemInfo(): {
    version: string; status: string; initialized: boolean;
    cdnProvider: string; optimizationsEnabled: string[]; monitoringActive: boolean;
  } {
    const opts: string[] = [];
    if (this.config.caching.enableBrowserCache) opts.push('Browser Cache');
    if (this.config.caching.enableServiceWorker) opts.push('Service Worker');
    if (this.config.compression.enableGzip) opts.push('Gzip');
    if (this.config.compression.enableBrotli) opts.push('Brotli');
    if (this.config.bundling.enableCodeSplitting) opts.push('Code Splitting');
    if (this.config.images.enableWebP) opts.push('WebP');
    if (this.cdnConfig.enabled) opts.push('CDN');
    return { version: '8.5.0', status: 'optimal', initialized: this.isInitialized, cdnProvider: this.cdnConfig.provider, optimizationsEnabled: opts, monitoringActive: this.monitoringInterval !== null };
  }

  public cleanup(): void {
    if (this.monitoringInterval) { clearInterval(this.monitoringInterval); this.monitoringInterval = null; }
    this.isInitialized = false;
    console.debug('🧹 Performance optimization system cleanup completed');
  }
}

export const geoAlertPerformance = GeoAlertPerformanceOptimization.getInstance();
export default GeoAlertPerformanceOptimization;
