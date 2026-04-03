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
  CanvasPlugin,
} from '../../../core/canvas/interfaces/ICanvasProvider';
import type { Point2D } from '../../../core/canvas/primitives/coordinates';
import type { CanvasInstance } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';
import type { CanvasRenderSettings } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasSettings';
import { createModuleLogger } from '@/lib/telemetry';
import {
  applyMiddlewareHooks,
  cleanupPlugins,
  emitCanvasEvent,
  initializePlugins,
  registerEventListener,
  unregisterEventListener,
} from './geo-canvas-runtime';
import {
  createGeoCanvasInstance,
  createGeoSettings,
  createInitialGeoTransform,
  setupGeoCanvasContext,
} from './geo-canvas-config';
import { canvasToGeoPoint, geoToCanvasPoint } from './geo-canvas-projection';
import type {
  GeographicPoint,
  GeographicTransform,
  GeoCanvasConfig,
  GeoCanvasProviderConfig,
  MapBounds,
} from './geo-canvas-types';

const logger = createModuleLogger('GeoCanvasAdapter');

export type {
  GeographicPoint,
  GeographicTransform,
  GeoCanvasConfig,
  GeoCanvasProviderConfig,
  MapBounds,
} from './geo-canvas-types';

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

  async initialize(config: CanvasProviderConfig): Promise<void> {
    if (this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' already initialized`);
    }

    try {
      this.settings = createGeoSettings(config);
      this.middlewares = config.middlewares ? [...config.middlewares] : [];
      this.plugins = config.plugins ? [...config.plugins] : [];

      initializePlugins(this.plugins, this);

      if (config.customEventHandlers) {
        Object.entries(config.customEventHandlers).forEach(([event, handler]) => {
          this.on(event, handler);
        });
      }

      this._isInitialized = true;
      logger.info(`[GeoCanvasAdapter] Initialized provider: ${this.id}`);
    } catch (error) {
      logger.error('[GeoCanvasAdapter] Initialization failed', { error });
      throw new Error(`Failed to initialize Geo Canvas Provider '${this.id}': ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      cleanupPlugins(this.plugins, logger);
      this.canvasInstances.clear();
      this.geoTransforms.clear();
      this.eventListeners.clear();
      this.middlewares = [];
      this.plugins = [];
      this.settings = {};
      this._isInitialized = false;

      logger.info(`[GeoCanvasAdapter] Cleaned up provider: ${this.id}`);
    } catch (error) {
      logger.error('[GeoCanvasAdapter] Cleanup error', { error });
      throw error;
    }
  }

  createCanvas(_id: string, config: CanvasCreationConfig): CanvasInstance {
    this.ensureInitialized();

    if (this.canvasInstances.has(config.canvasId)) {
      throw new Error(`Geo canvas '${config.canvasId}' already exists`);
    }

    try {
      applyMiddlewareHooks(this.middlewares, 'onCanvasCreate', logger, null, config);

      const geoConfig = config as GeoCanvasConfig;
      const context = setupGeoCanvasContext(config.element, this.settings);
      const canvasInstance = createGeoCanvasInstance(config, context);

      this.canvasInstances.set(config.canvasId, canvasInstance);
      this.geoTransforms.set(config.canvasId, createInitialGeoTransform(geoConfig));

      this.emit('canvas:created', {
        canvasId: config.canvasId,
        canvasType: config.canvasType,
        providerId: this.id,
      });

      logger.info(`[GeoCanvasAdapter] Created geo canvas: ${config.canvasId}`);
      return canvasInstance;
    } catch (error) {
      logger.error('[GeoCanvasAdapter] Geo canvas creation failed', { error });
      throw error;
    }
  }

  destroyCanvas(id: string): void {
    this.ensureInitialized();

    const canvas = this.canvasInstances.get(id);
    if (!canvas) {
      logger.warn(`[GeoCanvasAdapter] Geo canvas '${id}' not found for destruction`);
      return;
    }

    try {
      applyMiddlewareHooks(this.middlewares, 'onCanvasDestroy', logger, canvas);
      this.canvasInstances.delete(id);
      this.geoTransforms.delete(id);

      this.emit('canvas:destroyed', {
        canvasId: id,
        providerId: this.id,
      });

      logger.info(`[GeoCanvasAdapter] Destroyed geo canvas: ${id}`);
    } catch (error) {
      logger.error('[GeoCanvasAdapter] Geo canvas destruction failed', { error });
      throw error;
    }
  }

  getCanvas(id: string): CanvasInstance | undefined {
    if (!this._isInitialized) {
      return undefined;
    }

    return this.canvasInstances.get(id);
  }

  listCanvases(): CanvasInstance[] {
    if (!this._isInitialized) {
      return [];
    }

    return Array.from(this.canvasInstances.values());
  }

  getGeoTransform(canvasId: string): GeographicTransform | undefined {
    return this.geoTransforms.get(canvasId);
  }

  updateGeoTransform(canvasId: string, transform: Partial<GeographicTransform>): void {
    const existing = this.geoTransforms.get(canvasId);
    if (!existing) {
      logger.warn(`[GeoCanvasAdapter] No geo transform found for canvas '${canvasId}'`);
      return;
    }

    const updated = { ...existing, ...transform };
    this.geoTransforms.set(canvasId, updated);

    this.emit('geo:transform:changed', {
      canvasId,
      transform: updated,
      providerId: this.id,
    });
  }

  geoToCanvas(canvasId: string, geoPoint: GeographicPoint): Point2D | undefined {
    const transform = this.geoTransforms.get(canvasId);
    const canvas = this.canvasInstances.get(canvasId);

    if (!transform || !canvas) {
      return undefined;
    }

    return geoToCanvasPoint(geoPoint, canvas.element, transform);
  }

  canvasToGeo(canvasId: string, canvasPoint: Point2D): GeographicPoint | undefined {
    const transform = this.geoTransforms.get(canvasId);
    const canvas = this.canvasInstances.get(canvasId);

    if (!transform || !canvas) {
      return undefined;
    }

    return canvasToGeoPoint(canvasPoint, canvas.element, transform);
  }

  getMapBounds(canvasId: string): MapBounds | undefined {
    return this.geoTransforms.get(canvasId)?.bounds;
  }

  updateSettings(settings: Partial<CanvasRenderSettings>): void {
    this.ensureInitialized();
    this.settings = { ...this.settings, ...settings };

    this.emit('settings:changed', {
      providerId: this.id,
      settings: this.settings,
    });
  }

  getSettings(): CanvasRenderSettings {
    this.ensureInitialized();
    return this.settings as CanvasRenderSettings;
  }

  on(event: string, callback: Function): void {
    registerEventListener(this.eventListeners, event, callback);
  }

  off(event: string, callback: Function): void {
    unregisterEventListener(this.eventListeners, event, callback);
  }

  emit(event: string, data?: unknown): void {
    emitCanvasEvent(this.eventListeners, event, data, logger);
    applyMiddlewareHooks(this.middlewares, 'onEvent', logger, null, { event, data });
  }

  private ensureInitialized(): void {
    if (!this._isInitialized) {
      throw new Error(`Geo Canvas Provider '${this.id}' not initialized`);
    }
  }
}

export const createGeoCanvasProvider = (
  providerId: string,
  config?: Partial<GeoCanvasProviderConfig>,
): GeoCanvasAdapter => {
  const adapter = new GeoCanvasAdapter(providerId);

  const defaultConfig: CanvasProviderConfig = {
    providerId,
    providerType: 'geo',
    enableGlobalEventBus: true,
    enableCrossProviderCommunication: true,
    enablePerformanceMonitoring: process.env.NODE_ENV === 'development',
    ...config,
  };

  if (process.env.NODE_ENV === 'development' && config?.autoInitialize !== false) {
    adapter.initialize(defaultConfig).catch((error) => {
      logger.error('[GeoCanvasAdapter] Auto-initialization failed', { error });
    });
  }

  return adapter;
};
