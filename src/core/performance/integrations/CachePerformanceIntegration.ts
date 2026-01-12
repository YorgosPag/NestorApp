/**
 * 🔗 CACHE PERFORMANCE INTEGRATION - ENTERPRISE MONITORING
 *
 * Συνδέει το Enterprise API Cache System με το Performance Monitoring System
 * για comprehensive performance tracking.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

import { EnterprisePerformanceManager } from '../core/EnterprisePerformanceManager';
import { EnterpriseAPICache } from '../../../lib/cache/enterprise-api-cache';
import {
  PerformanceCategory,
  PerformanceSource,
  PerformanceUnit,
  PerformanceSeverity
} from '../types/performance.types';

export class CachePerformanceIntegration {
  private static instance: CachePerformanceIntegration | null = null;
  private performanceManager: EnterprisePerformanceManager;
  private isIntegrated = false;

  private constructor() {
    this.performanceManager = EnterprisePerformanceManager.getInstance();
  }

  public static getInstance(): CachePerformanceIntegration {
    if (!CachePerformanceIntegration.instance) {
      CachePerformanceIntegration.instance = new CachePerformanceIntegration();
    }
    return CachePerformanceIntegration.instance;
  }

  /**
   * 🔗 Initialize integration between cache and performance systems
   */
  public integrate(): void {
    if (this.isIntegrated) {
      console.warn('🔗 Cache Performance Integration already active');
      return;
    }

    // Patch the enterprise API cache to report performance metrics
    this.patchCacheGet();
    this.patchCacheSet();
    this.patchCacheDelete();
    this.patchCacheCleanup();

    this.isIntegrated = true;
    console.log('🔗 Cache Performance Integration activated');
  }

  /**
   * ⚡ Disconnect integration
   */
  public disconnect(): void {
    this.isIntegrated = false;
    console.log('🔗 Cache Performance Integration deactivated');
  }

  /**
   * 📊 Record cache hit metric
   */
  public recordCacheHit(key: string, duration: number, dataSize?: number): void {
    this.performanceManager.recordMetric({
      name: 'cache_hit',
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CACHE_SYSTEM,
      category: PerformanceCategory.CACHE_HIT,
      severity: duration > 50 ? PerformanceSeverity.MEDIUM : PerformanceSeverity.LOW,
      metadata: {
        cacheKey: key,
        dataSize,
        operation: 'get'
      }
    });
  }

  /**
   * 💔 Record cache miss metric
   */
  public recordCacheMiss(key: string, duration: number): void {
    this.performanceManager.recordMetric({
      name: 'cache_miss',
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CACHE_SYSTEM,
      category: PerformanceCategory.CACHE_MISS,
      severity: PerformanceSeverity.MEDIUM,
      metadata: {
        cacheKey: key,
        operation: 'get'
      }
    });
  }

  /**
   * 💾 Record cache set operation
   */
  public recordCacheSet(key: string, duration: number, dataSize?: number, ttl?: number): void {
    this.performanceManager.recordMetric({
      name: 'cache_set',
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CACHE_SYSTEM,
      category: PerformanceCategory.CACHE_INVALIDATION,
      severity: duration > 100 ? PerformanceSeverity.HIGH : PerformanceSeverity.LOW,
      metadata: {
        cacheKey: key,
        dataSize,
        ttl,
        operation: 'set'
      }
    });
  }

  /**
   * 🗑️ Record cache delete operation
   */
  public recordCacheDelete(key: string, duration: number): void {
    this.performanceManager.recordMetric({
      name: 'cache_delete',
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CACHE_SYSTEM,
      category: PerformanceCategory.CACHE_INVALIDATION,
      severity: PerformanceSeverity.LOW,
      metadata: {
        cacheKey: key,
        operation: 'delete'
      }
    });
  }

  /**
   * 🧹 Record cache cleanup operation
   */
  public recordCacheCleanup(duration: number, itemsRemoved: number): void {
    this.performanceManager.recordMetric({
      name: 'cache_cleanup',
      value: duration,
      unit: PerformanceUnit.MILLISECONDS,
      source: PerformanceSource.CACHE_SYSTEM,
      category: PerformanceCategory.CACHE_INVALIDATION,
      severity: PerformanceSeverity.LOW,
      metadata: {
        itemsRemoved,
        operation: 'cleanup'
      }
    });
  }

  // 🔧 PRIVATE METHODS - MONKEY PATCHING

  private patchCacheGet(): void {
    const originalGet = EnterpriseAPICache.prototype.get;
    const integration = this;

    EnterpriseAPICache.prototype.get = function<T>(key: string): T | null {
      const startTime = performance.now();
      const result = originalGet.call(this, key);
      const duration = performance.now() - startTime;

      // Record performance metric
      if (result !== null) {
        integration.recordCacheHit(key, duration, integration.estimateDataSize(result));
      } else {
        integration.recordCacheMiss(key, duration);
      }

      return result;
    };
  }

  private patchCacheSet(): void {
    const originalSet = EnterpriseAPICache.prototype.set;
    const integration = this;

    EnterpriseAPICache.prototype.set = function<T>(
      key: string,
      data: T,
      customTTL?: number
    ): void {
      const startTime = performance.now();
      originalSet.call(this, key, data, customTTL);
      const duration = performance.now() - startTime;

      // Record performance metric
      integration.recordCacheSet(
        key,
        duration,
        integration.estimateDataSize(data),
        customTTL
      );
    };
  }

  private patchCacheDelete(): void {
    const originalDelete = EnterpriseAPICache.prototype.delete;
    const integration = this;

    EnterpriseAPICache.prototype.delete = function(key: string): boolean {
      const startTime = performance.now();
      const result = originalDelete.call(this, key);
      const duration = performance.now() - startTime;

      // Record performance metric
      integration.recordCacheDelete(key, duration);

      return result;
    };
  }

  private patchCacheCleanup(): void {
    const originalCleanup = EnterpriseAPICache.prototype.cleanup;
    const integration = this;

    EnterpriseAPICache.prototype.cleanup = function(): number {
      const startTime = performance.now();
      const itemsRemoved = originalCleanup.call(this);
      const duration = performance.now() - startTime;

      // Record performance metric
      integration.recordCacheCleanup(duration, itemsRemoved);

      return itemsRemoved;
    };
  }

  /**
   * 📏 Estimate data size in bytes
   * 🏢 ENTERPRISE: Type-safe with unknown instead of any
   */
  private estimateDataSize(data: unknown): number {
    try {
      const serialized = JSON.stringify(data);
      return new Blob([serialized]).size;
    } catch {
      // Fallback estimation
      return String(data).length * 2; // Rough UTF-16 estimation
    }
  }

  /**
   * 📊 Get cache performance statistics
   */
  public getCacheStatistics(): {
    hitRatio: number;
    averageHitTime: number;
    averageMissTime: number;
    totalOperations: number;
    cacheEfficiency: number;
  } {
    const hitMetrics = this.performanceManager.getMetrics(PerformanceCategory.CACHE_HIT, 100);
    const missMetrics = this.performanceManager.getMetrics(PerformanceCategory.CACHE_MISS, 100);

    const totalHits = hitMetrics.length;
    const totalMisses = missMetrics.length;
    const totalOperations = totalHits + totalMisses;

    const hitRatio = totalOperations > 0 ? (totalHits / totalOperations) * 100 : 0;

    const averageHitTime = totalHits > 0
      ? hitMetrics.reduce((sum, metric) => sum + metric.value, 0) / totalHits
      : 0;

    const averageMissTime = totalMisses > 0
      ? missMetrics.reduce((sum, metric) => sum + metric.value, 0) / totalMisses
      : 0;

    // Cache efficiency: higher hit ratio and lower hit times = better efficiency
    const cacheEfficiency = totalOperations > 0
      ? (hitRatio / 100) * (1 - Math.min(averageHitTime / 100, 1))
      : 0;

    return {
      hitRatio,
      averageHitTime,
      averageMissTime,
      totalOperations,
      cacheEfficiency: cacheEfficiency * 100 // Convert to percentage
    };
  }
}

// 🚀 AUTO-INITIALIZE INTEGRATION
export const cachePerformanceIntegration = CachePerformanceIntegration.getInstance();

// Auto-integrate if in browser environment
if (typeof window !== 'undefined') {
  // Defer integration to avoid circular dependencies
  setTimeout(() => {
    cachePerformanceIntegration.integrate();
  }, 100);
}