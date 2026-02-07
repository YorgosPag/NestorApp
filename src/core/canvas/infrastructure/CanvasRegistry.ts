/**
 * 🏢 ENTERPRISE CANVAS REGISTRY
 *
 * Central registry για unified canvas management across all applications
 * Επεκτείνει το υπάρχον DXF Canvas system για global orchestration
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

import type {
  ICanvasRegistry,
  ICanvasProvider,
  CanvasPerformanceMetrics,
  CanvasProviderType,
  CanvasEventData
} from '../interfaces/ICanvasProvider';
import type { CanvasInstance } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';

/**
 * 🔺 GLOBAL CANVAS REGISTRY
 * Central coordinator για όλους τους canvas providers
 * Builds upon DXF Canvas enterprise architecture
 */
export class CanvasRegistry implements ICanvasRegistry {
  private providers = new Map<string, ICanvasProvider>();
  private globalEventListeners = new Set<(event: string, data: CanvasEventData) => void>();
  private performanceMetrics: CanvasPerformanceMetrics;
  private isPerformanceMonitoringEnabled = false;
  private metricsUpdateInterval?: NodeJS.Timeout;

  constructor() {
    this.performanceMetrics = this.initializeMetrics();
    this.setupPerformanceMonitoring();
  }

  // ============================================================================
  // PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * Register νέο canvas provider
   */
  registerProvider(provider: ICanvasProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Canvas provider '${provider.id}' already registered`);
    }

    this.providers.set(provider.id, provider);

    // Subscribe to provider events
    provider.on('*', (event: string, data: CanvasEventData) => {
      this.handleProviderEvent(provider.id, event, data);
    });

    this.logProviderAction('register', provider.id, provider.type);
  }

  /**
   * Unregister canvas provider
   */
  unregisterProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      console.warn(`Canvas provider '${providerId}' not found for unregistration`);
      return;
    }

    // Cleanup provider
    provider.cleanup().catch(error => {
      console.error(`Error cleaning up provider '${providerId}':`, error);
    });

    this.providers.delete(providerId);
    this.logProviderAction('unregister', providerId, provider.type);
  }

  /**
   * Get specific provider
   */
  getProvider(providerId: string): ICanvasProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * List all registered providers
   */
  listProviders(): ICanvasProvider[] {
    return Array.from(this.providers.values());
  }

  // ============================================================================
  // GLOBAL CANVAS ACCESS
  // ============================================================================

  /**
   * Get canvas by ID από οποιονδήποτε provider
   */
  getGlobalCanvas(canvasId: string): CanvasInstance | undefined {
    for (const provider of this.providers.values()) {
      const canvas = provider.getCanvas(canvasId);
      if (canvas) {
        return canvas;
      }
    }
    return undefined;
  }

  /**
   * List όλα τα canvas instances από όλους τους providers
   */
  listGlobalCanvases(): CanvasInstance[] {
    const allCanvases: CanvasInstance[] = [];

    for (const provider of this.providers.values()) {
      allCanvases.push(...provider.listCanvases());
    }

    return allCanvases;
  }

  // ============================================================================
  // CROSS-PROVIDER COMMUNICATION
  // ============================================================================

  /**
   * Broadcast event σε όλους τους providers
   */
  broadcastEvent(event: string, data?: CanvasEventData): void {
    // Emit to global listeners
    this.globalEventListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error(`Global event listener error for '${event}':`, error);
      }
    });

    // Emit to all providers
    for (const provider of this.providers.values()) {
      try {
        provider.emit(event, data);
      } catch (error) {
        console.error(`Provider event broadcast error for '${event}':`, error);
      }
    }

    this.updateMetrics('eventCount');
  }

  /**
   * Subscribe to global events
   */
  subscribeToGlobalEvents(callback: (event: string, data: CanvasEventData) => void): () => void {
    this.globalEventListeners.add(callback);

    return () => {
      this.globalEventListeners.delete(callback);
    };
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): CanvasPerformanceMetrics {
    this.updatePerformanceMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Enable/disable performance monitoring
   */
  enablePerformanceMonitoring(enabled: boolean): void {
    this.isPerformanceMonitoringEnabled = enabled;

    if (enabled && !this.metricsUpdateInterval) {
      this.metricsUpdateInterval = setInterval(() => {
        this.updatePerformanceMetrics();
      }, 1000); // Update every second
    } else if (!enabled && this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = undefined;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Find provider by canvas ID
   */
  findProviderByCanvasId(canvasId: string): ICanvasProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.getCanvas(canvasId)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Get providers by type
   */
  getProvidersByType(type: CanvasProviderType): ICanvasProvider[] {
    return Array.from(this.providers.values()).filter(
      provider => provider.type === type
    );
  }

  /**
   * Get canvas statistics
   */
  getCanvasStatistics(): {
    totalCanvases: number;
    canvasesByProvider: Record<string, number>;
    canvasesByType: Record<string, number>;
  } {
    const canvasesByProvider: Record<string, number> = {};
    const canvasesByType: Record<string, number> = {};
    let totalCanvases = 0;

    for (const provider of this.providers.values()) {
      const canvases = provider.listCanvases();
      canvasesByProvider[provider.id] = canvases.length;
      totalCanvases += canvases.length;

      for (const canvas of canvases) {
        canvasesByType[canvas.type] = (canvasesByType[canvas.type] || 0) + 1;
      }
    }

    return {
      totalCanvases,
      canvasesByProvider,
      canvasesByType
    };
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    // Stop performance monitoring
    this.enablePerformanceMonitoring(false);

    // Cleanup all providers
    const cleanupPromises = Array.from(this.providers.values()).map(
      provider => provider.cleanup().catch(error => {
        console.error(`Error cleaning up provider '${provider.id}':`, error);
      })
    );

    await Promise.all(cleanupPromises);

    // Clear all collections
    this.providers.clear();
    this.globalEventListeners.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Handle events από providers
   */
  private handleProviderEvent(providerId: string, event: string, data: CanvasEventData): void {
    // Update performance metrics
    this.updateMetrics('eventCount');

    // Handle specific events
    switch (event) {
      case 'canvas:created':
        this.updateMetrics('canvasCount');
        break;
      case 'canvas:destroyed':
        this.updateMetrics('canvasCount');
        break;
      case 'render:completed':
        if (this.hasRenderTime(data)) {
          this.updateRenderMetrics(data.renderTime);
        }
        break;
      case 'error':
        this.updateMetrics('errorCount');
        console.error(`Provider '${providerId}' error:`, data);
        break;
    }

    // Broadcast to global listeners
    this.globalEventListeners.forEach(listener => {
      try {
        listener(`${providerId}:${event}`, data);
      } catch (error) {
        console.error(`Global listener error for '${providerId}:${event}':`, error);
      }
    });
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): CanvasPerformanceMetrics {
    return {
      canvasCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      eventCount: 0,
      errorCount: 0,
      lastUpdate: new Date()
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (!this.isPerformanceMonitoringEnabled) return;

    const stats = this.getCanvasStatistics();

    this.performanceMetrics.canvasCount = stats.totalCanvases;
    this.performanceMetrics.memoryUsage = this.estimateMemoryUsage();
    this.performanceMetrics.lastUpdate = new Date();
  }

  /**
   * Update specific metric
   */
  private updateMetrics(metric: keyof CanvasPerformanceMetrics): void {
    switch (metric) {
      case 'eventCount':
        this.performanceMetrics.eventCount++;
        break;
      case 'errorCount':
        this.performanceMetrics.errorCount++;
        break;
      case 'canvasCount':
        // Updated in updatePerformanceMetrics
        break;
    }
  }

  /**
   * Update render metrics
   */
  private updateRenderMetrics(renderTime: number): void {
    this.performanceMetrics.totalRenderTime += renderTime;

    // Simple moving average calculation
    const totalRenders = this.performanceMetrics.eventCount || 1;
    this.performanceMetrics.averageRenderTime =
      this.performanceMetrics.totalRenderTime / totalRenders;
  }

  /**
   * Estimate memory usage (simplified)
   */
  private estimateMemoryUsage(): number {
    if (typeof performance !== 'undefined') {
      const memory = (performance as Performance & {
        memory?: { usedJSHeapSize: number };
      }).memory;
      if (memory) {
        return memory.usedJSHeapSize;
      }
    }
    return 0;
  }

  private hasRenderTime(value: CanvasEventData): value is { renderTime: number } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.renderTime === 'number';
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Enable by default in development
    if (process.env.NODE_ENV === 'development') {
      this.enablePerformanceMonitoring(true);
    }
  }

  /**
   * Log provider actions
   */
  private logProviderAction(action: string, providerId: string, type: CanvasProviderType): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CanvasRegistry] ${action} provider:`, {
        providerId,
        type,
        totalProviders: this.providers.size
      });
    }
  }
}

/**
 * 🌍 GLOBAL REGISTRY SINGLETON
 * Single instance για global access
 */
export const globalCanvasRegistry = new CanvasRegistry();

/**
 * ✅ CONVENIENCE EXPORTS
 * Easy access functions
 */
export const registerCanvasProvider = (provider: ICanvasProvider): void => {
  globalCanvasRegistry.registerProvider(provider);
};

export const getCanvasProvider = (providerId: string): ICanvasProvider | undefined => {
  return globalCanvasRegistry.getProvider(providerId);
};

export const getGlobalCanvas = (canvasId: string): CanvasInstance | undefined => {
  return globalCanvasRegistry.getGlobalCanvas(canvasId);
};

export const broadcastCanvasEvent = (event: string, data?: CanvasEventData): void => {
  globalCanvasRegistry.broadcastEvent(event, data);
};
