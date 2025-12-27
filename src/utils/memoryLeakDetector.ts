'use client';

import React from 'react';

// Memory leak detection and prevention utilities

interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  componentCount: number;
  listenerCount: number;
}

interface LeakWarning {
  type: 'memory' | 'listeners' | 'components';
  severity: 'low' | 'medium' | 'high';
  message: string;
  threshold: number;
  actual: number;
  timestamp: number;
}

class MemoryLeakDetector {
  private snapshots: MemorySnapshot[] = [];
  private warnings: LeakWarning[] = [];
  private isRunning = false;
  private intervalId?: number;
  private componentRegistry = new Set<string>();
  private listenerRegistry = new Map<string, number>();

  // Thresholds for warnings
  private readonly thresholds = {
    memoryGrowthRate: 10, // MB per minute
    maxMemory: 100, // MB
    maxComponents: 1000,
    maxListeners: 500,
  };

  start(intervalMs = 30000) { // Check every 30 seconds
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = window.setInterval(() => {
      this.takeSnapshot();
      this.analyzeMemoryTrends();
      this.checkThresholds();
    }, intervalMs);

    // Memory leak detector started
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    // Memory leak detector stopped
  }

  private takeSnapshot(): MemorySnapshot | null {
    if (!('performance' in window) || !(window.performance as any).memory) {
      return null;
    }

    const memory = (window.performance as any).memory;
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      componentCount: this.componentRegistry.size,
      listenerCount: Array.from(this.listenerRegistry.values()).reduce((sum, count) => sum + count, 0)
    };

    this.snapshots.push(snapshot);
    
    // Keep only last 20 snapshots
    if (this.snapshots.length > 20) {
      this.snapshots = this.snapshots.slice(-20);
    }

    return snapshot;
  }

  private analyzeMemoryTrends() {
    if (this.snapshots.length < 3) return;

    const recent = this.snapshots.slice(-3);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / (1000 * 60);
    const memoryDiffMB = (newest.usedJSHeapSize - oldest.usedJSHeapSize) / (1024 * 1024);
    const growthRate = memoryDiffMB / timeDiffMinutes;

    // Check for concerning memory growth
    if (growthRate > this.thresholds.memoryGrowthRate) {
      this.addWarning({
        type: 'memory',
        severity: growthRate > this.thresholds.memoryGrowthRate * 2 ? 'high' : 'medium',
        message: `High memory growth rate: ${growthRate.toFixed(2)} MB/min`,
        threshold: this.thresholds.memoryGrowthRate,
        actual: growthRate,
        timestamp: Date.now()
      });
    }
  }

  private checkThresholds() {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return;

    // Memory usage check
    const memoryUsageMB = latest.usedJSHeapSize / (1024 * 1024);
    if (memoryUsageMB > this.thresholds.maxMemory) {
      this.addWarning({
        type: 'memory',
        severity: memoryUsageMB > this.thresholds.maxMemory * 1.5 ? 'high' : 'medium',
        message: `High memory usage: ${memoryUsageMB.toFixed(2)} MB`,
        threshold: this.thresholds.maxMemory,
        actual: memoryUsageMB,
        timestamp: Date.now()
      });
    }

    // Component count check
    if (latest.componentCount > this.thresholds.maxComponents) {
      this.addWarning({
        type: 'components',
        severity: latest.componentCount > this.thresholds.maxComponents * 1.5 ? 'high' : 'medium',
        message: `High component count: ${latest.componentCount}`,
        threshold: this.thresholds.maxComponents,
        actual: latest.componentCount,
        timestamp: Date.now()
      });
    }

    // Listener count check
    if (latest.listenerCount > this.thresholds.maxListeners) {
      this.addWarning({
        type: 'listeners',
        severity: latest.listenerCount > this.thresholds.maxListeners * 1.5 ? 'high' : 'medium',
        message: `High event listener count: ${latest.listenerCount}`,
        threshold: this.thresholds.maxListeners,
        actual: latest.listenerCount,
        timestamp: Date.now()
      });
    }
  }

  private addWarning(warning: LeakWarning) {
    // Avoid duplicate warnings
    const isDuplicate = this.warnings.some(w => 
      w.type === warning.type && 
      w.message === warning.message &&
      Date.now() - w.timestamp < 60000 // Within last minute
    );

    if (!isDuplicate) {
      this.warnings.push(warning);
      
      // Keep only last 50 warnings
      if (this.warnings.length > 50) {
        this.warnings = this.warnings.slice(-50);
      }

      // Memory leak warning detected (console logging removed)

      // Trigger garbage collection in development
      if (process.env.NODE_ENV === 'development' && (window as any).gc) {
        (window as any).gc();
      }
    }
  }

  // Component tracking
  registerComponent(name: string) {
    this.componentRegistry.add(name);
  }

  unregisterComponent(name: string) {
    this.componentRegistry.delete(name);
  }

  // Event listener tracking
  registerListener(type: string) {
    const current = this.listenerRegistry.get(type) || 0;
    this.listenerRegistry.set(type, current + 1);
  }

  unregisterListener(type: string) {
    const current = this.listenerRegistry.get(type) || 0;
    if (current > 0) {
      this.listenerRegistry.set(type, current - 1);
    }
  }

  // Get current status
  getStatus() {
    const latest = this.snapshots[this.snapshots.length - 1];
    
    return {
      isRunning: this.isRunning,
      currentMemoryMB: latest ? latest.usedJSHeapSize / (1024 * 1024) : 0,
      componentCount: this.componentRegistry.size,
      listenerCount: Array.from(this.listenerRegistry.values()).reduce((sum, count) => sum + count, 0),
      warningsCount: this.warnings.length,
      recentWarnings: this.warnings.slice(-5),
      memoryTrend: this.calculateMemoryTrend()
    };
  }

  private calculateMemoryTrend() {
    if (this.snapshots.length < 2) return 'stable';
    
    const recent = this.snapshots.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const growthMB = (last.usedJSHeapSize - first.usedJSHeapSize) / (1024 * 1024);
    
    if (growthMB > 5) return 'increasing';
    if (growthMB < -2) return 'decreasing';
    return 'stable';
  }

  // Export data for analysis
  exportData() {
    return {
      snapshots: this.snapshots,
      warnings: this.warnings,
      components: Array.from(this.componentRegistry),
      listeners: Object.fromEntries(this.listenerRegistry),
      thresholds: this.thresholds,
      status: this.getStatus()
    };
  }

  // Clear all data
  reset() {
    this.snapshots = [];
    this.warnings = [];
    this.componentRegistry.clear();
    this.listenerRegistry.clear();
  }
}

// Global instance
export const memoryLeakDetector = new MemoryLeakDetector();

// React hook for memory tracking
export function useMemoryTracker(componentName?: string) {
  const detector = memoryLeakDetector;

  React.useEffect(() => {
    if (componentName) {
      detector.registerComponent(componentName);
      return () => detector.unregisterComponent(componentName);
    }
  }, [componentName]); // 🔧 FIX: Removed detector to prevent infinite loop

  return {
    getStatus: () => detector.getStatus(),
    registerListener: (type: string) => detector.registerListener(type),
    unregisterListener: (type: string) => detector.unregisterListener(type),
  };
}

// HOC for automatic memory tracking
export function withMemoryTracking<T extends {}>(
  Component: React.ComponentType<T>,
  componentName?: string
) {
  const WrappedComponent = (props: T) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    useMemoryTracker(name);
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withMemoryTracking(${name})`;
  return WrappedComponent;
}

// Hook for event listener cleanup
export function useEventListenerCleanup() {
  const detector = memoryLeakDetector;
  const listenersRef = React.useRef<Array<{ element: EventTarget; event: string; handler: EventListener }>>([]);

  const addListener = React.useCallback((element: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions) => {
    element.addEventListener(event, handler, options);
    listenersRef.current.push({ element, event, handler });
    detector.registerListener(event);
  }, []); // 🔧 FIX: Removed detector to prevent infinite loop

  React.useEffect(() => {
    return () => {
      // Cleanup all listeners
      listenersRef.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
        detector.unregisterListener(event);
      });
      listenersRef.current = [];
    };
  }, []); // 🔧 FIX: Removed detector to prevent infinite loop

  return { addListener };
}

// Development helper to start monitoring
export function enableMemoryMonitoring() {
  if (process.env.NODE_ENV === 'development') {
    memoryLeakDetector.start();
    
    // Add to window for debugging
    (window as any).__memoryDetector = memoryLeakDetector;
    
    // Memory monitoring enabled and available via window.__memoryDetector
  }
}