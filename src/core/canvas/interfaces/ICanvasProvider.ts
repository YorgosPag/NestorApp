/**
 * 🏢 ENTERPRISE CANVAS INTERFACES
 *
 * Global canvas provider contracts για unified canvas management
 * Επεκτείνει το υπάρχον DXF Canvas system για global use
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

import type { CanvasInstance, CanvasManagerOptions } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';
import type { CanvasRenderSettings } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasSettings';

/**
 * 🎯 ENTERPRISE CANVAS PROVIDER CONTRACT
 * Unified interface για όλους τους canvas providers
 */
export interface ICanvasProvider {
  readonly id: string;
  readonly type: CanvasProviderType;
  readonly isInitialized: boolean;

  // Lifecycle management
  initialize(config: CanvasProviderConfig): Promise<void>;
  cleanup(): Promise<void>;

  // Canvas management
  createCanvas(id: string, config: CanvasCreationConfig): CanvasInstance;
  destroyCanvas(id: string): void;
  getCanvas(id: string): CanvasInstance | undefined;
  listCanvases(): CanvasInstance[];

  // Settings management
  updateSettings(settings: Partial<CanvasRenderSettings>): void;
  getSettings(): CanvasRenderSettings;

  // Event handling
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, data?: any): void;
}

/**
 * 📐 CANVAS PROVIDER TYPES
 * Domain-specific canvas provider types
 */
export type CanvasProviderType =
  | 'dxf'           // DXF/CAD drawing canvas
  | 'geo'           // Geographic/mapping canvas
  | 'chart'         // Chart/data visualization canvas
  | 'generic';      // Generic purpose canvas

/**
 * ⚙️ CANVAS PROVIDER CONFIGURATION
 * Global configuration για canvas providers
 */
export interface CanvasProviderConfig {
  // Provider identification
  providerId: string;
  providerType: CanvasProviderType;

  // Canvas management options
  managerOptions?: Partial<CanvasManagerOptions>;

  // Global settings
  defaultSettings?: Partial<CanvasRenderSettings>;

  // Feature flags
  enableGlobalEventBus?: boolean;
  enableCrossProviderCommunication?: boolean;
  enablePerformanceMonitoring?: boolean;

  // Advanced options
  customEventHandlers?: Record<string, Function>;
  middlewares?: CanvasMiddleware[];
  plugins?: CanvasPlugin[];
}

/**
 * 🎨 CANVAS CREATION CONFIGURATION
 * Configuration για individual canvas instances
 */
export interface CanvasCreationConfig {
  // Canvas identification
  canvasId: string;
  canvasType: 'dxf' | 'layer' | 'overlay';

  // DOM element
  element: HTMLCanvasElement;

  // Canvas-specific configuration
  config: any; // Extends από DXF CanvasConfig

  // Z-index management
  zIndex?: number;

  // Initial state
  isActive?: boolean;

  // Custom properties
  metadata?: Record<string, any>;
}

/**
 * 🔧 CANVAS MIDDLEWARE INTERFACE
 * Middleware system για canvas operations
 */
export interface CanvasMiddleware {
  readonly name: string;
  readonly priority: number;

  // Lifecycle hooks
  onCanvasCreate?(canvas: CanvasInstance, config: CanvasCreationConfig): void;
  onCanvasDestroy?(canvas: CanvasInstance): void;
  onCanvasRender?(canvas: CanvasInstance, context: any): void;

  // Event hooks
  onEvent?(event: string, data: any, canvas: CanvasInstance): boolean | void;
}

/**
 * 🔌 CANVAS PLUGIN INTERFACE
 * Plugin system για extended functionality
 */
export interface CanvasPlugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];

  // Plugin lifecycle
  initialize(provider: ICanvasProvider): void;
  cleanup(): void;

  // Feature registration
  registerFeatures?(provider: ICanvasProvider): void;
}

/**
 * 📊 CANVAS PERFORMANCE METRICS
 * Performance monitoring interface
 */
export interface CanvasPerformanceMetrics {
  canvasCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  memoryUsage: number;
  eventCount: number;
  errorCount: number;
  lastUpdate: Date;
}

/**
 * 🎯 CANVAS REGISTRY INTERFACE
 * Central canvas registry contract
 */
export interface ICanvasRegistry {
  // Provider management
  registerProvider(provider: ICanvasProvider): void;
  unregisterProvider(providerId: string): void;
  getProvider(providerId: string): ICanvasProvider | undefined;
  listProviders(): ICanvasProvider[];

  // Global canvas access
  getGlobalCanvas(canvasId: string): CanvasInstance | undefined;
  listGlobalCanvases(): CanvasInstance[];

  // Cross-provider communication
  broadcastEvent(event: string, data?: any): void;
  subscribeToGlobalEvents(callback: (event: string, data: any) => void): () => void;

  // Performance monitoring
  getPerformanceMetrics(): CanvasPerformanceMetrics;
  enablePerformanceMonitoring(enabled: boolean): void;
}

/**
 * ✅ TYPE EXPORTS
 * All interfaces exported για external use
 */
export type {
  CanvasProviderType,
  CanvasProviderConfig,
  CanvasCreationConfig,
  CanvasMiddleware,
  CanvasPlugin,
  CanvasPerformanceMetrics
};