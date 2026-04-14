/**
 * 🎛️ GEO CANVAS CONFIGURATION - ENTERPRISE DOMAIN MODULE
 *
 * Centralized configuration management για geo-canvas system.
 * Domain-driven design με Fortune 500 enterprise standards.
 *
 * @module GeoCanvasConfig
 * @domain configuration
 * @version 2.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @extracted από GeoCanvasContent.tsx (configuration logic)
 * @created 2025-12-28 - Domain decomposition
 */

import {
  GeoCanvasConfiguration,
  MapConfiguration,
  ToolConfiguration,
  PanelConfiguration,
  LayerConfiguration,
  MeasurementConfiguration
} from '../enterprise-types/GeoCanvasTypes';
import { GEO_CANVAS_ZINDEX } from '../../config';

// ============================================================================
// 🎯 ENTERPRISE DEFAULT CONFIGURATIONS - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * Default Map Configuration - Enterprise Standards
 */
export const DEFAULT_MAP_CONFIG: MapConfiguration = {
  provider: 'mapbox',
  styleUrl: 'mapbox://styles/mapbox/streets-v12',
  enabledFeatures: {
    zoom: true,
    pan: true,
    rotate: false,
    tilt: false,
    geolocation: true,
    fullscreen: true
  },
  constraints: {
    minZoom: 1,
    maxZoom: 22,
    bounds: {
      northeast: { latitude: 42.0, longitude: 29.0 }, // Greece bounds
      southwest: { latitude: 34.0, longitude: 19.0 }
    }
  }
};

/**
 * Default Tool Configurations - Enterprise Toolkit
 */
export const DEFAULT_TOOL_CONFIGS: ToolConfiguration[] = [
  {
    id: 'select',
    type: 'select',
    name: 'Select',
    description: 'Select and interact με map features',
    icon: 'cursor-arrow',
    keyboard: 'S',
    isEnabled: true,
    settings: {
      multiSelect: false,
      tolerance: 5
    }
  },
  {
    id: 'pan',
    type: 'pan',
    name: 'Pan',
    description: 'Pan around the map',
    icon: 'hand-move',
    keyboard: 'P',
    isEnabled: true,
    settings: {
      inertia: true,
      kinetic: true
    }
  },
  {
    id: 'zoom',
    type: 'zoom',
    name: 'Zoom',
    description: 'Zoom in/out on the map',
    icon: 'magnifying-glass',
    keyboard: 'Z',
    isEnabled: true,
    settings: {
      wheel: true,
      doubleClick: true,
      touch: true
    }
  },
  {
    id: 'measure-distance',
    type: 'measure-distance',
    name: 'Measure Distance',
    description: 'Measure distances on the map',
    icon: 'ruler',
    keyboard: 'M',
    isEnabled: true,
    settings: {
      unit: 'meters',
      precision: 2,
      showIntermediate: true
    }
  },
  {
    id: 'measure-area',
    type: 'measure-area',
    name: 'Measure Area',
    description: 'Measure areas on the map',
    icon: 'ruler-square',
    keyboard: 'A',
    isEnabled: true,
    settings: {
      unit: 'square-meters',
      precision: 2,
      fillOpacity: 0.2
    }
  }
];

/**
 * Default Panel Configurations - Enterprise UI Layout
 */
export const DEFAULT_PANEL_CONFIGS: PanelConfiguration[] = [
  {
    id: 'coordinates',
    type: 'coordinates',
    title: 'Coordinates',
    position: { x: 16, y: 16 },
    size: { width: 350, height: 120 },
    isVisible: true,
    isMinimized: false,
    isDraggable: true,
    isResizable: true,
    isDismissible: true,
    zIndex: GEO_CANVAS_ZINDEX.PANEL_COORDINATES
  },
  {
    id: 'properties',
    type: 'properties',
    title: 'Properties',
    position: { x: 16, y: 156 },
    size: { width: 350, height: 200 },
    isVisible: true,
    isMinimized: false,
    isDraggable: true,
    isResizable: true,
    isDismissible: true,
    zIndex: GEO_CANVAS_ZINDEX.PANEL_PROPERTIES
  },
  {
    id: 'layers',
    type: 'layers',
    title: 'Layers',
    position: { x: 16, y: 376 },
    size: { width: 350, height: 180 },
    isVisible: true,
    isMinimized: false,
    isDraggable: true,
    isResizable: true,
    isDismissible: true,
    zIndex: GEO_CANVAS_ZINDEX.PANEL_LAYERS
  },
  {
    id: 'tools',
    type: 'tools',
    title: 'Tools',
    position: { x: 16, y: 576 },
    size: { width: 350, height: 160 },
    isVisible: true,
    isMinimized: false,
    isDraggable: true,
    isResizable: true,
    isDismissible: true,
    zIndex: GEO_CANVAS_ZINDEX.PANEL_TOOLS
  }
];

/**
 * Default Layer Configurations - Enterprise GIS Standards
 */
export const DEFAULT_LAYER_CONFIGS: LayerConfiguration[] = [
  {
    id: 'base-map',
    type: 'base-map',
    name: 'Base Map',
    description: 'Primary base map layer',
    isVisible: true,
    opacity: 1,
    zIndex: GEO_CANVAS_ZINDEX.BASE_LAYER,
    source: {
      url: 'mapbox://styles/mapbox/streets-v12',
      format: 'vector'
    },
    metadata: {
      category: 'base',
      provider: 'Mapbox'
    }
  },
  {
    id: 'satellite',
    type: 'raster',
    name: 'Satellite Imagery',
    description: 'High-resolution satellite imagery',
    isVisible: false,
    opacity: 1,
    zIndex: GEO_CANVAS_ZINDEX.SATELLITE_LAYER,
    source: {
      url: 'mapbox://styles/mapbox/satellite-v9',
      format: 'raster'
    },
    metadata: {
      category: 'imagery',
      provider: 'Mapbox'
    }
  }
];

/**
 * Default Measurement Configuration - Enterprise Precision
 */
export const DEFAULT_MEASUREMENT_CONFIG: MeasurementConfiguration = {
  units: {
    distance: 'meters',
    area: 'square-meters',
    angle: 'degrees'
  },
  precision: {
    distance: 2,
    area: 2,
    angle: 1
  },
  display: {
    showIntermediate: true,
    showTotal: true,
    showLabels: true
  }
};

/**
 * Complete Enterprise Default Configuration
 */
export const DEFAULT_GEO_CANVAS_CONFIG: GeoCanvasConfiguration = {
  map: DEFAULT_MAP_CONFIG,
  tools: DEFAULT_TOOL_CONFIGS,
  panels: DEFAULT_PANEL_CONFIGS,
  layers: DEFAULT_LAYER_CONFIGS,
  measurements: DEFAULT_MEASUREMENT_CONFIG,
  ui: {
    theme: 'light',
    language: 'el-GR', // Greek as default
    accessibility: {
      enableScreenReader: false,
      enableHighContrast: false,
      enableKeyboardNavigation: true
    }
  },
  performance: {
    enableVirtualization: true,
    maxLayers: 50,
    maxPanels: 10,
    renderThrottling: 16 // 60 FPS
  }
};

// ============================================================================
// 🎛️ CONFIGURATION MANAGER - ENTERPRISE CLASS
// ============================================================================

export class GeoCanvasConfigManager {
  private config: GeoCanvasConfiguration;
  private listeners: Set<(config: GeoCanvasConfiguration) => void> = new Set();

  constructor(initialConfig?: Partial<GeoCanvasConfiguration>) {
    this.config = this.mergeConfigurations(DEFAULT_GEO_CANVAS_CONFIG, initialConfig || {});
  }

  // ========================================================================
  // 🔧 CONFIGURATION METHODS - ENTERPRISE API
  // ========================================================================

  /**
   * Get current configuration
   */
  getConfig(): GeoCanvasConfiguration {
    return { ...this.config }; // Return copy for immutability
  }

  /**
   * Update configuration με deep merge
   */
  updateConfig(updates: Partial<GeoCanvasConfiguration>): void {
    const newConfig = this.mergeConfigurations(this.config, updates);
    this.config = newConfig;
    this.notifyListeners();
  }

  /**
   * Reset to default configuration
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_GEO_CANVAS_CONFIG };
    this.notifyListeners();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: GeoCanvasConfiguration) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Validate configuration against enterprise standards
   */
  validateConfig(config: Partial<GeoCanvasConfiguration>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Map validation
    if (config.map) {
      if (config.map.constraints) {
        if (config.map.constraints.minZoom < 1 || config.map.constraints.minZoom > 22) {
          errors.push('Map minZoom must be between 1 and 22');
        }
        if (config.map.constraints.maxZoom < 1 || config.map.constraints.maxZoom > 22) {
          errors.push('Map maxZoom must be between 1 and 22');
        }
        if (config.map.constraints.minZoom >= config.map.constraints.maxZoom) {
          errors.push('Map minZoom must be less than maxZoom');
        }
      }
    }

    // Performance validation
    if (config.performance) {
      if (config.performance.maxLayers && config.performance.maxLayers < 1) {
        errors.push('Performance maxLayers must be at least 1');
      }
      if (config.performance.maxPanels && config.performance.maxPanels < 1) {
        errors.push('Performance maxPanels must be at least 1');
      }
      if (config.performance.renderThrottling && config.performance.renderThrottling < 8) {
        errors.push('Performance renderThrottling must be at least 8ms (120 FPS max)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ========================================================================
  // 🏢 PRIVATE HELPERS - ENTERPRISE UTILITIES
  // ========================================================================

  private mergeConfigurations(
    base: GeoCanvasConfiguration,
    updates: Partial<GeoCanvasConfiguration>
  ): GeoCanvasConfiguration {
    return {
      ...base,
      ...updates,
      map: { ...base.map, ...updates.map },
      tools: updates.tools || base.tools,
      panels: updates.panels || base.panels,
      layers: updates.layers || base.layers,
      measurements: { ...base.measurements, ...updates.measurements },
      ui: { ...base.ui, ...updates.ui },
      performance: { ...base.performance, ...updates.performance }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getConfig());
      } catch (error) {
        console.error('Configuration listener error:', error);
      }
    });
  }
}

// ============================================================================
// 🔗 DOMAIN EXPORTS - CONFIGURATION
// ============================================================================

// ✅ ENTERPRISE FIX: Exports already declared above, no need to redeclare

export default GeoCanvasConfigManager;

/**
 * 🏢 ENTERPRISE METADATA - CONFIGURATION DOMAIN
 *
 * ✅ Domain: configuration
 * ✅ Pattern: Configuration management με observer pattern
 * ✅ Validation: Enterprise-grade config validation
 * ✅ Immutability: All configs returned as copies
 * ✅ Flexibility: Deep merge support για partial updates
 * ✅ Performance: Optimized listener management
 * ✅ Standards: Industry-standard default values
 */