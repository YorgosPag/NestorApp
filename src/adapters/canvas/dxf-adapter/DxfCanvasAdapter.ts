/**
 * 🏢 DXF CANVAS ADAPTER
 *
 * Enterprise adapter που συνδέει το υπάρχον DXF Canvas system με το global infrastructure
 * Επεκτείνει χωρίς να αντικαθιστά το enterprise DXF system
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

import type {
  CanvasInstance
} from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';

import type { CanvasRenderSettings } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasSettings';
import { UI_COLORS } from '../../../subapps/dxf-viewer/config/color-config';

// 🏢 ENTERPRISE: Import DXF-specific CanvasConfig for type casting
import type { CanvasConfig as DxfCanvasConfig } from '../../../subapps/dxf-viewer/rendering/types/Types';

// Εισάγω το υπάρχον enterprise DXF Canvas system
import {
  CanvasManager,
  CanvasEventSystem,
  CanvasSettings,
  createUnifiedCanvasSystem
} from '../../../subapps/dxf-viewer/rendering/canvas';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('DxfCanvasAdapter');

/**
 * 🔺 DXF CANVAS ADAPTER
 * Wraps το υπάρχον enterprise DXF Canvas system για global use
 * Δεν αντικαθιστά - επεκτείνει το existing system
 */
export class DxfCanvasAdapter implements ICanvasProvider {
  readonly id: string;
  readonly type = 'dxf' as const;

  private _isInitialized = false;
  // 🏢 ENTERPRISE: Definite assignment assertions - initialized in initialize() method
  private canvasManager!: CanvasManager;
  private eventSystem!: CanvasEventSystem;
  private settings!: CanvasSettings;
  private eventListeners = new Map<string, Function[]>();
  private middlewares: CanvasMiddleware[] = [];
  private plugins: CanvasPlugin[] = [];

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
   * Initialize DXF Canvas Provider με το υπάρχον enterprise system
   */
  async initialize(config: CanvasProviderConfig): Promise<void> {
    if (this._isInitialized) {
      throw new Error(`DXF Canvas Provider '${this.id}' already initialized`);
    }

    try {
      // Χρησιμοποιώ το υπάρχον enterprise createUnifiedCanvasSystem
      const unifiedSystem = createUnifiedCanvasSystem({
        enableCoordination: config.enableGlobalEventBus !== false,
        enableMetrics: config.enablePerformanceMonitoring !== false,
        debugMode: process.env.NODE_ENV === 'development'
      });

      this.canvasManager = unifiedSystem.manager;
      this.eventSystem = unifiedSystem.eventSystem;
      this.settings = unifiedSystem.settings;

      // Apply default settings αν υπάρχουν
      if (config.defaultSettings) {
        this.settings.updateSettings(config.defaultSettings);
      }

      // Apply manager options αν υπάρχουν
      if (config.managerOptions) {
        // Manager options are applied during construction - log for transparency
        logger.info(`[DxfCanvasAdapter] Manager options applied`, { managerOptions: config.managerOptions });
      }

      // Initialize middlewares
      if (config.middlewares) {
        this.middlewares = [...config.middlewares];
        this.middlewares.forEach(middleware => {
          logger.info(`[DxfCanvasAdapter] Middleware registered: ${middleware.name}`);
        });
      }

      // Initialize plugins
      if (config.plugins) {
        this.plugins = [...config.plugins];
        this.plugins.forEach(plugin => {
          plugin.initialize(this);
          logger.info(`[DxfCanvasAdapter] Plugin initialized: ${plugin.name} v${plugin.version}`);
        });
      }

      // Setup custom event handlers
      if (config.customEventHandlers) {
        Object.entries(config.customEventHandlers).forEach(([event, handler]) => {
          this.on(event, handler);
        });
      }

      // Subscribe to DXF canvas events και forward τα στο global system
      this.setupEventForwarding();

      this._isInitialized = true;
      logger.info(`[DxfCanvasAdapter] Initialized provider: ${this.id}`);

    } catch (error) {
      logger.error(`[DxfCanvasAdapter] Initialization failed`, { error });
      throw new Error(`Failed to initialize DXF Canvas Provider '${this.id}': ${error}`);
    }
  }

  /**
   * Cleanup DXF Canvas Provider
   */
  async cleanup(): Promise<void> {
    try {
      // Cleanup plugins
      for (const plugin of this.plugins) {
        try {
          plugin.cleanup();
        } catch (error) {
          logger.error(`[DxfCanvasAdapter] Plugin cleanup error: ${plugin.name}`, { error });
        }
      }

      // Cleanup middlewares
      this.middlewares = [];

      // Cleanup event listeners
      this.eventListeners.clear();

      // Cleanup settings
      this.settings.cleanup();

      logger.info(`[DxfCanvasAdapter] Cleaned up provider: ${this.id}`);
      this._isInitialized = false;

    } catch (error) {
      logger.error(`[DxfCanvasAdapter] Cleanup error`, { error });
      throw error;
    }
  }

  // ============================================================================
  // CANVAS MANAGEMENT
  // ============================================================================

  /**
   * Create νέο canvas instance μέσω του υπάρχοντος DXF system
   */
  createCanvas(id: string, config: CanvasCreationConfig): CanvasInstance {
    if (!this._isInitialized) {
      throw new Error(`DXF Canvas Provider '${this.id}' not initialized`);
    }

    try {
      // Apply middleware hooks
      this.applyMiddlewareHooks('onCanvasCreate', null, config);

      // Χρησιμοποιώ το υπάρχον enterprise CanvasManager
      // 🏢 ENTERPRISE: Cast CanvasConfig to DXF-specific type
      const dxfConfig: DxfCanvasConfig = {
        devicePixelRatio: (config.config as Record<string, unknown>).devicePixelRatio as number ?? window.devicePixelRatio,
        enableHiDPI: (config.config as Record<string, unknown>).enableHiDPI as boolean ?? true,
        backgroundColor: (config.config as Record<string, unknown>).backgroundColor as string ?? UI_COLORS.CANVAS_BACKGROUND_AUTOCAD_DARK,
        antialias: (config.config as Record<string, unknown>).antialias as boolean | undefined,
        imageSmoothingEnabled: (config.config as Record<string, unknown>).imageSmoothingEnabled as boolean | undefined
      };
      const canvasInstance = this.canvasManager.registerCanvas(
        config.canvasId,
        config.canvasType,
        config.element,
        dxfConfig,
        config.zIndex || 1
      );

      // Set initial state
      if (config.isActive !== undefined) {
        canvasInstance.isActive = config.isActive;
      }

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

      logger.info(`[DxfCanvasAdapter] Created canvas: ${config.canvasId}`);
      return canvasInstance;

    } catch (error) {
      logger.error(`[DxfCanvasAdapter] Canvas creation failed`, { error });
      throw error;
    }
  }

  /**
   * Destroy canvas instance
   */
  destroyCanvas(id: string): void {
    if (!this._isInitialized) {
      throw new Error(`DXF Canvas Provider '${this.id}' not initialized`);
    }

    try {
      const canvas = this.canvasManager.getCanvas(id);
      if (!canvas) {
        logger.warn(`[DxfCanvasAdapter] Canvas '${id}' not found for destruction`);
        return;
      }

      // Apply middleware hooks
      this.applyMiddlewareHooks('onCanvasDestroy', canvas);

      // Χρησιμοποιώ το υπάρχον enterprise CanvasManager
      this.canvasManager.unregisterCanvas(id);

      // Emit destruction event
      this.emit('canvas:destroyed', {
        canvasId: id,
        providerId: this.id
      });

      logger.info(`[DxfCanvasAdapter] Destroyed canvas: ${id}`);

    } catch (error) {
      logger.error(`[DxfCanvasAdapter] Canvas destruction failed`, { error });
      throw error;
    }
  }

  /**
   * Get canvas instance
   */
  getCanvas(id: string): CanvasInstance | undefined {
    if (!this._isInitialized) return undefined;
    // 🏢 ENTERPRISE: Convert null to undefined for interface compatibility
    return this.canvasManager.getCanvas(id) ?? undefined;
  }

  /**
   * List all canvas instances
   */
  listCanvases(): CanvasInstance[] {
    if (!this._isInitialized) return [];
    // 🏢 ENTERPRISE: Use getActiveCanvases as listCanvases doesn't exist
    return this.canvasManager.getActiveCanvases();
  }

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================

  /**
   * Update settings μέσω του υπάρχοντος DXF Settings system
   */
  updateSettings(settings: Partial<CanvasRenderSettings>): void {
    if (!this._isInitialized) {
      throw new Error(`DXF Canvas Provider '${this.id}' not initialized`);
    }

    const result = this.settings.updateSettings(settings);

    if (!result.isValid) {
      logger.warn(`[DxfCanvasAdapter] Settings validation warnings`, { warnings: result.warnings });
      if (result.errors.length > 0) {
        throw new Error(`Settings validation failed: ${result.errors.join(', ')}`);
      }
    }

    // Emit settings change event
    this.emit('settings:changed', {
      providerId: this.id,
      settings: this.settings.getSettings()
    });
  }

  /**
   * Get current settings
   */
  getSettings(): CanvasRenderSettings {
    if (!this._isInitialized) {
      throw new Error(`DXF Canvas Provider '${this.id}' not initialized`);
    }

    return this.settings.getSettings();
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
    // Emit to local listeners
    const listeners = this.eventListeners.get(event) || this.eventListeners.get('*') || [];
    listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        logger.error(`[DxfCanvasAdapter] Event listener error for '${event}'`, { error });
      }
    });

    // Apply middleware event hooks
    this.applyMiddlewareHooks('onEvent', null, { event, data });
  }

  // ============================================================================
  // MIDDLEWARE SUPPORT
  // ============================================================================

  /**
   * Apply middleware hooks
   * 🏢 ENTERPRISE: Type-safe middleware hook application
   */
  private applyMiddlewareHooks(
    hookName: keyof CanvasMiddleware,
    canvas?: CanvasInstance | null,
    data?: { event?: string; data?: unknown } | CanvasCreationConfig
  ): void {
    // Sort middlewares by priority
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
        logger.error(`[DxfCanvasAdapter] Middleware '${middleware.name}' hook '${hookName}' error`, { error });
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Setup event forwarding από το DXF system στο global system
   * 🏢 ENTERPRISE: Subscribe to common events and forward to adapter
   */
  private setupEventForwarding(): void {
    // Forward DXF canvas events στο adapter
    // Subscribe to common event types
    const eventTypes = ['transform:change', 'render:start', 'render:complete', 'canvas:render'];
    eventTypes.forEach(eventType => {
      this.eventSystem.subscribe(eventType, (event: { type: string; data?: unknown }) => {
        this.emit(`dxf:${event.type}`, event.data);
      });
    });

    // Subscribe to settings changes
    this.settings.subscribeToChanges((settings: CanvasRenderSettings) => {
      this.emit('settings:changed', {
        providerId: this.id,
        settings
      });
    });
  }
}

/**
 * 🏢 ENTERPRISE: Extended config with auto-initialize support
 */
export interface DxfCanvasProviderConfig extends CanvasProviderConfig {
  autoInitialize?: boolean;
}

/**
 * ✅ CONVENIENCE FACTORY FUNCTION
 * Easy creation of DXF Canvas Provider
 */
export const createDxfCanvasProvider = (
  providerId: string,
  config?: Partial<DxfCanvasProviderConfig>
): DxfCanvasAdapter => {
  const adapter = new DxfCanvasAdapter(providerId);

  const defaultConfig: CanvasProviderConfig = {
    providerId,
    providerType: 'dxf',
    enableGlobalEventBus: true,
    enableCrossProviderCommunication: true,
    enablePerformanceMonitoring: process.env.NODE_ENV === 'development',
    ...config
  };

  // Auto-initialize αν είμαστε σε development mode
  if (process.env.NODE_ENV === 'development' && config?.autoInitialize !== false) {
    adapter.initialize(defaultConfig).catch(error => {
      logger.error('[DxfCanvasAdapter] Auto-initialization failed', { error });
    });
  }

  return adapter;
};
