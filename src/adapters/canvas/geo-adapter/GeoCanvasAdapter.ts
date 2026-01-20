/**
 * 🏢 GEO CANVAS ADAPTER
 *
 * Enterprise adapter για Geographic/Mapping canvas functionality
 * Επεκτείνει το DXF Canvas infrastructure για geo-specific operations
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

import type {
  ICanvasProvider,
  CanvasProviderConfig,
  CanvasCreationConfig,
  CanvasMiddleware,
  CanvasPlugin
} from '../../../core/canvas/interfaces/ICanvasProvider';

import type { CanvasInstance } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';
import type { CanvasRenderSettings } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasSettings';
// 🏢 ENTERPRISE: Import DXF-specific CanvasConfig for type casting
import type { CanvasConfig as DxfCanvasConfig } from '../../../subapps/dxf-viewer/rendering/types/Types';

// Import coordinate utilities
import type { Point2D, CoordinateBounds } from '../../../core/canvas/primitives/coordinates';
import { CoordinateUtils } from '../../../core/canvas/primitives/coordinates';

/**
 * 🗺️ GEO-SPECIFIC TYPES
 * Geographic canvas-specific types και interfaces
 */
export interface GeographicPoint {
  lat: number;
  lng: number;
  alt?: number; // altitude in meters
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeographicTransform {
  center: GeographicPoint;
  zoom: number;
  bounds: MapBounds;
  projection: string; // 'mercator', 'equirectangular', etc.
}

export interface GeoCanvasConfig extends CanvasCreationConfig {
  // Geographic-specific config
  initialCenter?: GeographicPoint;
  initialZoom?: number;
  initialBounds?: MapBounds;
  projection?: string;

  // Map interaction settings
  enablePanning?: boolean;
  enableZooming?: boolean;
  enableRotation?: boolean;
  maxZoom?: number;
  minZoom?: number;
}

/**
 * 🔺 GEO CANVAS ADAPTER
 * Specialized adapter για geographic/mapping canvas operations
 * Built on top του enterprise DXF Canvas infrastructure
 */
export class GeoCanvasAdapter implements ICanvasProvider {
  readonly id: string;
  readonly type = 'geo' as const;

  private _isInitialized = false;
  private canvasInstances = new Map<string, CanvasInstance>();
  private geoTransforms = new Map<string, GeographicTransform>();
  private eventListeners = new Map<string, Function[]>();
  private middlewares: CanvasMiddleware[] = [];
  private plugins: CanvasPlugin[] = [];
  private settings: Partial<CanvasRenderSettings> = {};

  constructor(providerId: string) {
    this.id = providerId;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Initialize Geo Canvas Provider
   */
  async initialize(config: CanvasProviderConfig): Promise<void> {
    if (this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' already initialized`);
    }

    try {
      // Initialize default geo-specific settings
      this.settings = {
        enableHiDPI: true,
        devicePixelRatio: window.devicePixelRatio || 1,
        imageSmoothingEnabled: true,
        backgroundColor: 'transparent',
        enableBatching: true,
        enableCaching: true,
        enableMetrics: config.enablePerformanceMonitoring !== false,
        useUnifiedRendering: true,
        enableCoordination: config.enableGlobalEventBus !== false,
        debugMode: process.env.NODE_ENV === 'development',
        ...config.defaultSettings
      };

      // Initialize middlewares
      if (config.middlewares) {
        this.middlewares = [...config.middlewares];
      }

      // Initialize plugins
      if (config.plugins) {
        this.plugins = [...config.plugins];
        this.plugins.forEach(plugin => {
          plugin.initialize(this);
        });
      }

      // Setup custom event handlers
      if (config.customEventHandlers) {
        Object.entries(config.customEventHandlers).forEach(([event, handler]) => {
          this.on(event, handler);
        });
      }

      this._isInitialized = true;
      console.log(`[GeoCanvasAdapter] Initialized provider: ${this.id}`);

    } catch (error) {
      console.error(`[GeoCanvasAdapter] Initialization failed:`, error);
      throw new Error(`Failed to initialize Geo Canvas Provider '${this.id}': ${error}`);
    }
  }

  /**
   * Cleanup Geo Canvas Provider
   */
  async cleanup(): Promise<void> {
    try {
      // Cleanup plugins
      for (const plugin of this.plugins) {
        try {
          plugin.cleanup();
        } catch (error) {
          console.error(`[GeoCanvasAdapter] Plugin cleanup error: ${plugin.name}`, error);
        }
      }

      // Clear all data structures
      this.canvasInstances.clear();
      this.geoTransforms.clear();
      this.eventListeners.clear();
      this.middlewares = [];
      this.plugins = [];

      console.log(`[GeoCanvasAdapter] Cleaned up provider: ${this.id}`);
      this._isInitialized = false;

    } catch (error) {
      console.error(`[GeoCanvasAdapter] Cleanup error:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CANVAS MANAGEMENT
  // ============================================================================

  /**
   * Create νέο geo canvas instance
   */
  createCanvas(id: string, config: CanvasCreationConfig): CanvasInstance {
    if (!this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' not initialized`);
    }

    if (this.canvasInstances.has(config.canvasId)) {
      throw new Error(`Geo canvas '${config.canvasId}' already exists`);
    }

    try {
      // Apply middleware hooks
      this.applyMiddlewareHooks('onCanvasCreate', null, config);

      // Create geo-specific canvas instance
      const geoConfig = config as GeoCanvasConfig;

      // Setup canvas context (using DXF infrastructure principles)
      const context = this.setupGeoCanvasContext(config.element);

      // 🏢 ENTERPRISE: Cast CanvasConfig to DXF-specific type
      const dxfConfig: DxfCanvasConfig = {
        devicePixelRatio: (config.config as Record<string, unknown>).devicePixelRatio as number ?? window.devicePixelRatio,
        enableHiDPI: (config.config as Record<string, unknown>).enableHiDPI as boolean ?? true,
        backgroundColor: (config.config as Record<string, unknown>).backgroundColor as string ?? '#1a1a1a',
        antialias: (config.config as Record<string, unknown>).antialias as boolean | undefined,
        imageSmoothingEnabled: (config.config as Record<string, unknown>).imageSmoothingEnabled as boolean | undefined
      };
      const canvasInstance: CanvasInstance = {
        id: config.canvasId,
        type: config.canvasType,
        element: config.element,
        context,
        config: dxfConfig,
        zIndex: config.zIndex || 1,
        isActive: config.isActive !== false,
        lastRenderTime: 0
      };

      // Setup geographic transform
      this.initializeGeoTransform(config.canvasId, geoConfig);

      // Store canvas instance
      this.canvasInstances.set(config.canvasId, canvasInstance);

      // Store metadata αν υπάρχουν
      if (config.metadata) {
        (canvasInstance as unknown as { metadata: Record<string, unknown> }).metadata = config.metadata;
      }

      // Emit creation event
      this.emit('canvas:created', {
        canvasId: config.canvasId,
        canvasType: config.canvasType,
        providerId: this.id
      });

      console.log(`[GeoCanvasAdapter] Created geo canvas: ${config.canvasId}`);
      return canvasInstance;

    } catch (error) {
      console.error(`[GeoCanvasAdapter] Geo canvas creation failed:`, error);
      throw error;
    }
  }

  /**
   * Destroy geo canvas instance
   */
  destroyCanvas(id: string): void {
    if (!this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' not initialized`);
    }

    const canvas = this.canvasInstances.get(id);
    if (!canvas) {
      console.warn(`[GeoCanvasAdapter] Geo canvas '${id}' not found for destruction`);
      return;
    }

    try {
      // Apply middleware hooks
      this.applyMiddlewareHooks('onCanvasDestroy', canvas);

      // Remove canvas and related data
      this.canvasInstances.delete(id);
      this.geoTransforms.delete(id);

      // Emit destruction event
      this.emit('canvas:destroyed', {
        canvasId: id,
        providerId: this.id
      });

      console.log(`[GeoCanvasAdapter] Destroyed geo canvas: ${id}`);

    } catch (error) {
      console.error(`[GeoCanvasAdapter] Geo canvas destruction failed:`, error);
      throw error;
    }
  }

  /**
   * Get geo canvas instance
   */
  getCanvas(id: string): CanvasInstance | undefined {
    if (!this._isInitialized) return undefined;
    return this.canvasInstances.get(id);
  }

  /**
   * List all geo canvas instances
   */
  listCanvases(): CanvasInstance[] {
    if (!this._isInitialized) return [];
    return Array.from(this.canvasInstances.values());
  }

  // ============================================================================
  // GEO-SPECIFIC METHODS
  // ============================================================================

  /**
   * Get geographic transform για specific canvas
   */
  getGeoTransform(canvasId: string): GeographicTransform | undefined {
    return this.geoTransforms.get(canvasId);
  }

  /**
   * Update geographic transform
   */
  updateGeoTransform(canvasId: string, transform: Partial<GeographicTransform>): void {
    const existing = this.geoTransforms.get(canvasId);
    if (!existing) {
      console.warn(`[GeoCanvasAdapter] No geo transform found for canvas '${canvasId}'`);
      return;
    }

    const updated = { ...existing, ...transform };
    this.geoTransforms.set(canvasId, updated);

    this.emit('geo:transform:changed', {
      canvasId,
      transform: updated,
      providerId: this.id
    });
  }

  /**
   * Convert geographic point to canvas coordinates
   */
  geoToCanvas(canvasId: string, geoPoint: GeographicPoint): Point2D | undefined {
    const transform = this.geoTransforms.get(canvasId);
    const canvas = this.canvasInstances.get(canvasId);

    if (!transform || !canvas) {
      return undefined;
    }

    // Simple mercator projection (can be extended για other projections)
    return this.mercatorProjection(geoPoint, transform, canvas.element);
  }

  /**
   * Convert canvas coordinates to geographic point
   */
  canvasToGeo(canvasId: string, canvasPoint: Point2D): GeographicPoint | undefined {
    const transform = this.geoTransforms.get(canvasId);
    const canvas = this.canvasInstances.get(canvasId);

    if (!transform || !canvas) {
      return undefined;
    }

    // Inverse mercator projection
    return this.inverseMercatorProjection(canvasPoint, transform, canvas.element);
  }

  /**
   * Get current map bounds για canvas
   */
  getMapBounds(canvasId: string): MapBounds | undefined {
    const transform = this.geoTransforms.get(canvasId);
    return transform?.bounds;
  }

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================

  /**
   * Update settings
   */
  updateSettings(settings: Partial<CanvasRenderSettings>): void {
    if (!this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' not initialized`);
    }

    this.settings = { ...this.settings, ...settings };

    // Emit settings change event
    this.emit('settings:changed', {
      providerId: this.id,
      settings: this.settings
    });
  }

  /**
   * Get current settings
   */
  getSettings(): CanvasRenderSettings {
    if (!this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' not initialized`);
    }

    return this.settings as CanvasRenderSettings;
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to events
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe από events
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event) || this.eventListeners.get('*') || [];
    listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error(`[GeoCanvasAdapter] Event listener error for '${event}':`, error);
      }
    });

    // Apply middleware event hooks
    this.applyMiddlewareHooks('onEvent', null, { event, data });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Setup geo canvas context με HiDPI support
   */
  private setupGeoCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas 2D context for geo canvas');
    }

    // Apply HiDPI settings using DXF infrastructure principles
    const dpr = this.settings.devicePixelRatio || window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = this.settings.imageSmoothingEnabled !== false;

    return ctx;
  }

  /**
   * Initialize geographic transform για canvas
   */
  private initializeGeoTransform(canvasId: string, config: GeoCanvasConfig): void {
    const canvas = this.canvasInstances.get(canvasId) || this.canvasInstances.values().next().value;
    if (!canvas) return;

    const rect = canvas.element.getBoundingClientRect();

    const transform: GeographicTransform = {
      center: config.initialCenter || { lat: 0, lng: 0 },
      zoom: config.initialZoom || 1,
      bounds: config.initialBounds || {
        north: 85,
        south: -85,
        east: 180,
        west: -180
      },
      projection: config.projection || 'mercator'
    };

    this.geoTransforms.set(canvasId, transform);
  }

  /**
   * Simple Mercator projection
   */
  private mercatorProjection(
    geoPoint: GeographicPoint,
    transform: GeographicTransform,
    canvas: HTMLCanvasElement
  ): Point2D {
    const rect = canvas.getBoundingClientRect();

    // Simple mercator math (can be enhanced για proper projections)
    const x = (geoPoint.lng + 180) / 360 * rect.width;
    const latRad = geoPoint.lat * Math.PI / 180;
    const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
    const y = (rect.height / 2) - (rect.width * mercN / (2 * Math.PI));

    return CoordinateUtils.point2D(x, y);
  }

  /**
   * Inverse Mercator projection
   */
  private inverseMercatorProjection(
    canvasPoint: Point2D,
    transform: GeographicTransform,
    canvas: HTMLCanvasElement
  ): GeographicPoint {
    const rect = canvas.getBoundingClientRect();

    // Inverse mercator math
    const lng = (canvasPoint.x / rect.width) * 360 - 180;
    const n = Math.PI - 2 * Math.PI * canvasPoint.y / rect.height;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

    return { lat, lng };
  }

  /**
   * Apply middleware hooks
   * 🏢 ENTERPRISE: Type-safe middleware hook application
   */
  private applyMiddlewareHooks(
    hookName: keyof CanvasMiddleware,
    canvas?: CanvasInstance | null,
    data?: { event?: string; data?: unknown } | CanvasCreationConfig
  ): void {
    const sortedMiddlewares = this.middlewares
      .slice()
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const middleware of sortedMiddlewares) {
      try {
        const hook = middleware[hookName] as ((arg1: unknown, arg2?: unknown) => void) | undefined;
        if (hook) {
          if (canvas) {
            hook.call(middleware, canvas, data);
          } else {
            // 🏢 ENTERPRISE: Type-safe event extraction
            const eventName = data && 'event' in data ? data.event : hookName;
            hook.call(middleware, eventName, data);
          }
        }
      } catch (error) {
        console.error(`[GeoCanvasAdapter] Middleware '${middleware.name}' hook '${hookName}' error:`, error);
      }
    }
  }
}

/**
 * ✅ CONVENIENCE FACTORY FUNCTION
 */
export const createGeoCanvasProvider = (
  providerId: string,
  config?: Partial<CanvasProviderConfig>
): GeoCanvasAdapter => {
  return new GeoCanvasAdapter(providerId);
};