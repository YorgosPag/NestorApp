/**
 * DXF PERFORMANCE — OPTIMIZATION ACTIONS
 *
 * Defines and executes performance optimization actions
 * (GC triggers, canvas optimization, viewport culling, preloading, caching).
 * Extracted from DxfPerformanceOptimizer (ADR-065).
 *
 * @module performance/dxf-perf-actions
 * @see DxfPerformanceOptimizer.ts
 */

import { PERFORMANCE_THRESHOLDS } from '../../../core/performance/components/utils/performance-utils';
import type { DxfPerformanceConfig, OptimizationAction, PerformanceMetrics, WindowWithGC } from './dxf-perf-types';

// ============================================================================
// OPTIMIZATION ACTION GENERATORS
// ============================================================================

/**
 * Generate the list of available optimization actions.
 */
export function generateOptimizationActions(config: DxfPerformanceConfig): OptimizationAction[] {
  return [
    {
      id: 'gc_trigger',
      type: 'memory',
      priority: 'high',
      description: 'Force garbage collection to free memory',
      estimatedImprovement: 'Memory: -20MB to -100MB',
      autoApply: true,
      action: async () => triggerGarbageCollection()
    },
    {
      id: 'canvas_buffer',
      type: 'rendering',
      priority: 'medium',
      description: 'Enable canvas buffering for smoother rendering',
      estimatedImprovement: 'FPS: +5 to +15',
      autoApply: true,
      action: async () => optimizeCanvasRendering(config)
    },
    {
      id: 'viewport_culling',
      type: 'rendering',
      priority: 'high',
      description: 'Enable viewport culling to reduce render load',
      estimatedImprovement: 'Render time: -30% to -60%',
      autoApply: true,
      action: async () => enableViewportCulling(config)
    },
    {
      id: 'preload_critical',
      type: 'bundle',
      priority: 'medium',
      description: 'Preload critical chunks for faster navigation',
      estimatedImprovement: 'Load time: -500ms to -1500ms',
      autoApply: false,
      action: async () => preloadCriticalChunks()
    },
    {
      id: 'cache_optimization',
      type: 'network',
      priority: 'low',
      description: 'Optimize caching strategy for better performance',
      estimatedImprovement: 'Cache hit ratio: +10% to +25%',
      autoApply: false,
      action: async () => optimizeCaching()
    }
  ];
}

// ============================================================================
// OPTIMIZATION DECISION
// ============================================================================

/**
 * Check if a specific optimization should be applied.
 */
export function shouldApplyOptimization(
  action: OptimizationAction,
  metrics: PerformanceMetrics,
  config: DxfPerformanceConfig
): boolean {
  switch (action.id) {
    case 'gc_trigger':
      return metrics.memoryUsage > config.memory.maxMemoryUsage * PERFORMANCE_THRESHOLDS.memory.gcTriggerPercent;

    case 'canvas_buffer':
      return metrics.fps < PERFORMANCE_THRESHOLDS.fps.minTarget || metrics.renderTime > 20;

    case 'viewport_culling':
      return metrics.canvasElements > 1000 && metrics.renderTime > PERFORMANCE_THRESHOLDS.renderTime.good;

    default:
      return false;
  }
}

// ============================================================================
// OPTIMIZATION IMPLEMENTATIONS
// ============================================================================

/**
 * Trigger garbage collection (Chrome DevTools only).
 */
export function triggerGarbageCollection(): void {
  if (typeof window !== 'undefined') {
    const windowWithGC = window as WindowWithGC;
    if (typeof windowWithGC.gc === 'function') {
      windowWithGC.gc();
    }
  }
}

/**
 * Optimize canvas rendering settings.
 */
export function optimizeCanvasRendering(config: DxfPerformanceConfig): void {
  config.rendering.enableCanvasBuffering = true;
  config.rendering.enableRequestAnimationFrame = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dxf-optimize-canvas', {
      detail: { enableBuffering: true, enableRAF: true }
    }));
  }
}

/**
 * Enable viewport culling.
 */
export function enableViewportCulling(config: DxfPerformanceConfig): void {
  config.rendering.enableViewportCulling = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dxf-enable-culling', {
      detail: { enableCulling: true }
    }));
  }
}

/**
 * Preload critical chunks for faster navigation.
 */
export async function preloadCriticalChunks(): Promise<void> {
  const criticalChunks = [
    '/dxf/viewer',
    '/api/dxf-files',
    '/_next/static/chunks/pages/_app.js'
  ];

  for (const chunk of criticalChunks) {
    try {
      await fetch(chunk, { mode: 'no-cors' });
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Optimize caching via service worker.
 */
export function optimizeCaching(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .catch(() => { /* Silent failure */ });
  }
}
