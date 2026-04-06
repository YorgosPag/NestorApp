/**
 * ENTERPRISE PERFORMANCE MANAGER - Utilities & Defaults
 *
 * System info, application context, default configs, entry type mapping
 *
 * @module core/performance/core/enterprise-perf-utils
 * Extracted from EnterprisePerformanceManager.ts (ADR-065 Phase 3, #18)
 */

import { generateSessionId as _generateSessionId } from '@/services/enterprise-id.service';
import {
  PerformanceCategory,
  PerformanceSource,
  MonitoringConfig,
  OptimizationSettings,
  SystemInfo,
  ApplicationContext,
} from '../types/performance.types';
import type { PerformanceWithMemory, WindowWithGC } from './enterprise-perf-types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EnterprisePerformanceUtils');

// --- ENTRY TYPE MAPPING ---

export function mapEntryTypeToCategory(entryType: string): PerformanceCategory {
  switch (entryType) {
    case 'navigation':
    case 'resource':
      return PerformanceCategory.NETWORK;
    case 'measure':
    case 'mark':
      return PerformanceCategory.APPLICATION;
    case 'paint':
      return PerformanceCategory.PAINT;
    case 'layout-shift':
      return PerformanceCategory.LAYOUT;
    default:
      return PerformanceCategory.APPLICATION;
  }
}

// --- MEMORY ESTIMATION ---

export function estimateMemoryUsage(metricsSize: number, subscriptionsSize: number): number {
  let estimated = metricsSize * 0.001; // ~1KB per metric
  estimated += subscriptionsSize * 0.0005; // ~0.5KB per subscription
  return Math.round(estimated * 100) / 100;
}

// --- SYSTEM INFO ---

export function getSystemInfo(): SystemInfo {
  if (typeof window === 'undefined') {
    return { userAgent: 'server', platform: 'server', screen: { width: 0, height: 0, pixelRatio: 1 } };
  }

  const perfWithMemory = performance as PerformanceWithMemory;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    memory: perfWithMemory.memory ? {
      total: perfWithMemory.memory.totalJSHeapSize,
      used: perfWithMemory.memory.usedJSHeapSize,
      available: perfWithMemory.memory.jsHeapSizeLimit
    } : undefined,
    screen: { width: screen.width, height: screen.height, pixelRatio: devicePixelRatio || 1 }
  };
}

// --- APPLICATION CONTEXT ---

export function getApplicationContext(): ApplicationContext {
  const env = (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test' | 'staging';
  const environment: ApplicationContext['environment'] =
    env === 'production' ? 'production' :
    env === 'staging' ? 'staging' :
    env === 'test' ? 'test' : 'development';

  return {
    route: typeof window !== 'undefined' ? window.location.pathname : '/',
    subapp: detectSubapp(),
    version: '1.0.0',
    environment,
    sessionId: getSessionId()
  };
}

function detectSubapp(): ApplicationContext['subapp'] {
  if (typeof window === 'undefined') return 'main-app';
  const path = window.location.pathname;
  if (path.includes('/dxf')) return 'dxf-viewer';
  if (path.includes('/geo')) return 'geo-canvas';
  if (path.includes('/admin')) return 'admin';
  return 'main-app';
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';
  let sessionId = sessionStorage.getItem('performance-session-id');
  if (!sessionId) {
    sessionId = _generateSessionId();
    sessionStorage.setItem('performance-session-id', sessionId);
  }
  return sessionId;
}

// --- GARBAGE COLLECTION ---

export function scheduleGarbageCollection(): void {
  if (typeof window !== 'undefined') {
    const windowWithGC = window as unknown as WindowWithGC;
    if (windowWithGC.gc) {
      setTimeout(() => {
        try {
          windowWithGC.gc?.();
          logger.info('Garbage collection executed');
        } catch (error) {
          logger.warn('Garbage collection failed', { error });
        }
      }, 1000);
    }
  }
}

// --- DEFAULT CONFIGS ---

export function getDefaultMonitoringConfig(): MonitoringConfig {
  return {
    enabled: true,
    interval: 5000,
    retentionPeriod: 24 * 60 * 60 * 1000,
    maxSamples: 1000,
    categories: Object.values(PerformanceCategory),
    sources: Object.values(PerformanceSource),
    autoOptimization: true,
    realTimeUpdates: true
  };
}

export function getDefaultOptimizationSettings(): OptimizationSettings {
  return {
    caching: {
      enabled: true,
      strategy: 'balanced',
      ttl: { api: 5 * 60 * 1000, static: 60 * 60 * 1000, dynamic: 30 * 1000 }
    },
    rendering: { enableRequestIdleCallback: true, enableVirtualization: true, maxFPS: 60 },
    memory: { enableGarbageCollection: true, gcThreshold: 50, enableMemoryMonitoring: true },
    network: { enableRequestBatching: true, maxConcurrentRequests: 6, enableCompression: true }
  };
}
