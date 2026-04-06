/**
 * 📊 ANALYTICS BRIDGE — PERFORMANCE MONITORING
 *
 * Extracted from AnalyticsBridge.ts (ADR-065 Phase 5)
 * Web Vitals, memory, and network performance monitoring
 *
 * Uses Dependency Injection (PerformanceTrackable) to avoid circular dependency
 * with the main AnalyticsBridge class.
 */

'use client';

import { getErrorMessage } from '@/lib/error-utils';
import type { PerformanceTrackable } from './analytics-bridge-types';

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Initialize all performance monitoring subsystems.
 * Called from AnalyticsBridge constructor (deferred via setTimeout).
 */
export function startPerformanceMonitoring(
  tracker: PerformanceTrackable,
  config: { enablePerformanceMonitoring: boolean }
): void {
  if (!config.enablePerformanceMonitoring || typeof window === 'undefined') return;

  monitorWebVitals(tracker);

  setInterval(() => {
    monitorMemoryUsage(tracker);
  }, 60000); // Every minute

  monitorNetworkPerformance(tracker);
}

// ============================================================================
// WEB VITALS
// ============================================================================

function monitorWebVitals(tracker: PerformanceTrackable): void {
  // First Contentful Paint
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
        tracker.trackEvent('performance_issue', {
          component: 'WebVitals',
          action: 'First Contentful Paint',
          feature: 'performance_monitoring',
          metadata: { value: entry.startTime }
        }, { loadTime: entry.startTime });
      }
    }
  });

  observer.observe({ entryTypes: ['paint'] });

  // Page Load Time
  window.addEventListener('load', () => {
    const pageLoadTime = performance.now();
    tracker.trackEvent('feature_used', {
      component: 'PageLoad',
      action: 'Page Loaded',
      feature: 'page_navigation',
      duration: pageLoadTime,
      metadata: { loadTime: pageLoadTime }
    }, { loadTime: pageLoadTime });
  });
}

// ============================================================================
// MEMORY MONITORING
// ============================================================================

function monitorMemoryUsage(tracker: PerformanceTrackable): void {
  if ('memory' in performance) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
    const memoryUsage = memory.usedJSHeapSize;
    const threshold = 50 * 1024 * 1024; // 50MB

    if (memoryUsage > threshold) {
      tracker.trackPerformanceIssue('memoryUsage', memoryUsage, threshold);
    }
  }
}

// ============================================================================
// NETWORK MONITORING
// ============================================================================

function monitorNetworkPerformance(tracker: PerformanceTrackable): void {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const startTime = performance.now();
    try {
      const response = await originalFetch(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;

      tracker.trackEvent('feature_used', {
        component: 'NetworkRequest',
        action: 'API Call',
        feature: 'network_request',
        duration,
        success: response.ok,
        metadata: {
          url: args[0]?.toString(),
          status: response.status,
          duration
        }
      });

      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      tracker.trackEvent('error_occurred', {
        component: 'NetworkRequest',
        action: 'API Call Failed',
        feature: 'network_request',
        duration,
        success: false,
        metadata: {
          url: args[0]?.toString(),
          error: getErrorMessage(error),
          duration
        }
      });

      throw error;
    }
  };
}
