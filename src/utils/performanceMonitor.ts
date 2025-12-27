'use client';

import React from 'react';

// Performance monitoring utilities for bundle optimization tracking

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url?: string;
  component?: string;
}

interface BundleMetric {
  route: string;
  loadTime: number;
  chunkSizes: Record<string, number>;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private bundleMetrics: BundleMetric[] = [];
  private observer?: PerformanceObserver;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObserver();
      this.trackInitialLoad();
    }
  }

  private initializeObserver() {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordMetric({
            name: entry.name,
            value: entry.duration || (entry as PerformanceNavigationTiming).loadEventEnd || 0,
            timestamp: entry.startTime,
            url: entry.name.includes('http') ? entry.name : undefined
          });
        });
      });

      try {
        this.observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
      } catch (error) {
        // Performance observer not fully supported
      }
    }
  }

  private trackInitialLoad() {
    if ('performance' in window && performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
      
      this.recordMetric({
        name: 'initial-load',
        value: loadTime,
        timestamp: timing.navigationStart
      });
      
      this.recordMetric({
        name: 'dom-ready',
        value: domReady,
        timestamp: timing.navigationStart
      });
    }
  }

  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'> & { timestamp?: number }) {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || Date.now()
    });
    
    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  recordBundleMetric(bundleMetric: Omit<BundleMetric, 'timestamp'>) {
    this.bundleMetrics.push({
      ...bundleMetric,
      timestamp: Date.now()
    });
    
    // Keep only last 50 bundle metrics
    if (this.bundleMetrics.length > 50) {
      this.bundleMetrics = this.bundleMetrics.slice(-50);
    }
  }

  // Track component load times
  trackComponentLoad(componentName: string, startTime: number = performance.now()) {
    return () => {
      const endTime = performance.now();
      this.recordMetric({
        name: 'component-load',
        value: endTime - startTime,
        component: componentName
      });
    };
  }

  // Track route changes
  trackRouteChange(route: string) {
    const startTime = performance.now();
    
    return {
      finish: (chunkSizes: Record<string, number> = {}) => {
        const endTime = performance.now();
        this.recordBundleMetric({
          route,
          loadTime: endTime - startTime,
          chunkSizes
        });
      }
    };
  }

  // Get performance summary
  getSummary() {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 300000); // Last 5 minutes
    
    const avgLoadTime = recentMetrics
      .filter(m => m.name === 'component-load')
      .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);
    
    const slowestComponents = recentMetrics
      .filter(m => m.name === 'component-load' && m.component)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(m => ({ component: m.component!, loadTime: m.value }));

    const recentRoutes = this.bundleMetrics
      .filter(m => now - m.timestamp < 300000)
      .sort((a, b) => b.loadTime - a.loadTime);

    return {
      avgComponentLoadTime: avgLoadTime,
      slowestComponents,
      recentRoutes: recentRoutes.slice(0, 10),
      totalMetrics: this.metrics.length,
      totalBundleMetrics: this.bundleMetrics.length
    };
  }

  // Export metrics for analysis
  exportMetrics() {
    return {
      performance: this.metrics,
      bundles: this.bundleMetrics,
      summary: this.getSummary(),
      timestamp: Date.now()
    };
  }

  // Clear all metrics
  clear() {
    this.metrics = [];
    this.bundleMetrics = [];
  }

  // Destroy observer
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance tracking
export function usePerformanceTracker() {
  return {
    trackComponent: (name: string) => performanceMonitor.trackComponentLoad(name),
    trackRoute: (route: string) => performanceMonitor.trackRouteChange(route),
    getSummary: () => performanceMonitor.getSummary(),
    exportMetrics: () => performanceMonitor.exportMetrics(),
  };
}

// HOC for automatic component performance tracking
export function withPerformanceTracking<T extends {}>(
  Component: React.ComponentType<T>,
  componentName?: string
) {
  const WrappedComponent = (props: T) => {
    React.useEffect(() => {
      const endTracking = performanceMonitor.trackComponentLoad(
        componentName || Component.displayName || Component.name || 'Unknown'
      );
      return endTracking;
    }, []);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceTracking(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Performance monitoring for development
export function enablePerformanceLogging() {
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const summary = performanceMonitor.getSummary();
      if (summary.totalMetrics > 0) {
        // Performance summary data available but console logging removed
      }
    }, 30000); // Check every 30 seconds
  }
}