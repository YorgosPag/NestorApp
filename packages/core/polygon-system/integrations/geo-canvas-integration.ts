/**
 * 🌍 GEO-CANVAS INTEGRATION
 *
 * Integration layer μεταξύ Universal Polygon System και geo-canvas
 *
 * @module core/polygon-system/integrations/geo-canvas-integration
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonType,
  PolygonStyle
} from '../types';
import { SimplePolygonDrawer } from '../drawing/SimplePolygonDrawer';
import { ControlPointDrawer } from '../drawing/ControlPointDrawer';
import { polygonToGeoJSON, polygonsToGeoJSONCollection } from '../converters/polygon-converters';

/**
 * Geo-canvas integration options
 */
export interface GeoCanvasIntegrationOptions {
  /** Canvas element για simple drawing */
  canvas?: HTMLCanvasElement;

  /** Map instance για geo features */
  map?: any; // MapLibre GL JS map instance

  /** Default drawing mode */
  defaultMode?: PolygonType;

  /** Enable auto-save */
  autoSave?: boolean;

  /** Storage key για persistence */
  storageKey?: string;

  /** Event callbacks */
  callbacks?: {
    onPolygonCreated?: (polygon: UniversalPolygon) => void;
    onPolygonModified?: (polygon: UniversalPolygon) => void;
    onPolygonDeleted?: (polygonId: string) => void;
    onModeChanged?: (mode: PolygonType) => void;
  };
}

/**
 * Geo-canvas polygon manager
 */
export class GeoCanvasPolygonManager {
  private simpleDrawer: SimplePolygonDrawer;
  private controlPointDrawer: ControlPointDrawer;
  private polygons: Map<string, UniversalPolygon> = new Map();
  private currentMode: PolygonType = 'simple';
  private options: GeoCanvasIntegrationOptions;

  constructor(options: GeoCanvasIntegrationOptions = {}) {
    this.options = options;
    this.currentMode = options.defaultMode || 'simple';

    // Initialize drawers
    this.simpleDrawer = new SimplePolygonDrawer(options.canvas);
    this.controlPointDrawer = new ControlPointDrawer(options.canvas);

    // Setup event handlers
    this.setupEventHandlers();

    // Load persisted data
    if (options.autoSave && options.storageKey) {
      this.loadFromStorage();
    }

    console.log('🌍 GeoCanvas Polygon Manager initialized');
  }

  /**
   * Start drawing polygon
   */
  startDrawing(type?: PolygonType, style?: Partial<PolygonStyle>): void {
    const drawingType = type || this.currentMode;
    this.currentMode = drawingType;

    // Use appropriate drawer
    const drawer = this.getDrawer(drawingType);
    drawer.startDrawing(drawingType, style);

    // Notify mode change
    this.options.callbacks?.onModeChanged?.(drawingType);

    console.log(`🎨 Started drawing ${drawingType} polygon`);
  }

  /**
   * Add point to current polygon
   */
  addPoint(x: number, y: number, geoCoords?: { lng: number; lat: number }): PolygonPoint | null {
    const drawer = this.getDrawer(this.currentMode);

    if (this.currentMode === 'georeferencing' && drawer instanceof ControlPointDrawer) {
      return drawer.addControlPoint(x, y, geoCoords);
    } else {
      return drawer.addPoint(x, y);
    }
  }

  /**
   * Finish current polygon
   */
  finishDrawing(): UniversalPolygon | null {
    const drawer = this.getDrawer(this.currentMode);
    const polygon = drawer.finishDrawing();

    if (polygon) {
      // Store polygon
      this.polygons.set(polygon.id, polygon);

      // Auto-save if enabled
      if (this.options.autoSave) {
        this.saveToStorage();
      }

      // Notify creation
      this.options.callbacks?.onPolygonCreated?.(polygon);

      console.log(`✅ Polygon created: ${polygon.id}`);
    }

    return polygon;
  }

  /**
   * Cancel current drawing
   */
  cancelDrawing(): void {
    const drawer = this.getDrawer(this.currentMode);
    drawer.cancelDrawing();

    console.log('❌ Drawing cancelled');
  }

  /**
   * Switch drawing mode
   */
  setMode(mode: PolygonType): void {
    // Finish current drawing if any
    const currentDrawer = this.getDrawer(this.currentMode);
    if (currentDrawer.getState().isDrawing) {
      console.warn('⚠️ Finishing current drawing before mode switch');
      this.finishDrawing();
    }

    this.currentMode = mode;
    this.options.callbacks?.onModeChanged?.(mode);

    console.log(`🔄 Switched to ${mode} mode`);
  }

  /**
   * Get current mode
   */
  getMode(): PolygonType {
    return this.currentMode;
  }

  /**
   * Get all polygons
   */
  getPolygons(): UniversalPolygon[] {
    return Array.from(this.polygons.values());
  }

  /**
   * Get polygons by type
   */
  getPolygonsByType(type: PolygonType): UniversalPolygon[] {
    return this.getPolygons().filter(p => p.type === type);
  }

  /**
   * Get polygon by ID
   */
  getPolygon(id: string): UniversalPolygon | null {
    return this.polygons.get(id) || null;
  }

  /**
   * Delete polygon
   */
  deletePolygon(id: string): boolean {
    const deleted = this.polygons.delete(id);

    if (deleted) {
      // Auto-save if enabled
      if (this.options.autoSave) {
        this.saveToStorage();
      }

      // Notify deletion
      this.options.callbacks?.onPolygonDeleted?.(id);

      console.log(`🗑️ Deleted polygon: ${id}`);
    }

    return deleted;
  }

  /**
   * Clear all polygons
   */
  clearAll(): void {
    const count = this.polygons.size;
    this.polygons.clear();

    // Auto-save if enabled
    if (this.options.autoSave) {
      this.saveToStorage();
    }

    console.log(`🗑️ Cleared ${count} polygons`);
  }

  /**
   * Export all polygons as GeoJSON
   */
  exportAsGeoJSON(): GeoJSON.FeatureCollection {
    return polygonsToGeoJSONCollection(this.getPolygons());
  }

  /**
   * Export specific polygon types
   */
  exportByType(type: PolygonType): GeoJSON.FeatureCollection {
    const polygons = this.getPolygonsByType(type);
    return polygonsToGeoJSONCollection(polygons);
  }

  /**
   * Import polygons from GeoJSON
   */
  importFromGeoJSON(geojson: GeoJSON.FeatureCollection): {
    imported: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let imported = 0;

    for (const feature of geojson.features) {
      try {
        // This would need the actual geoJSONToPolygon function
        // For now, create a basic polygon structure
        const polygon: UniversalPolygon = {
          id: feature.properties?.id || `imported_${Date.now()}_${imported}`,
          type: feature.properties?.type || 'simple',
          points: [], // Would be populated by converter
          isClosed: feature.geometry.type === 'Polygon',
          style: feature.properties?.style || {
            strokeColor: '#3b82f6',
            fillColor: '#3b82f6',
            strokeWidth: 2,
            fillOpacity: 0.2,
            strokeOpacity: 1
          },
          metadata: {
            createdAt: new Date(),
            modifiedAt: new Date(),
            ...feature.properties?.metadata
          }
        };

        this.polygons.set(polygon.id, polygon);
        imported++;

      } catch (error) {
        errors.push(`Failed to import feature: ${error}`);
      }
    }

    // Auto-save if enabled
    if (this.options.autoSave && imported > 0) {
      this.saveToStorage();
    }

    console.log(`📥 Imported ${imported} polygons with ${errors.length} errors`);
    return { imported, errors };
  }

  /**
   * Add polygon to map (for geo-referenced polygons)
   */
  addPolygonToMap(polygon: UniversalPolygon): void {
    if (!this.options.map) {
      console.warn('⚠️ No map instance available');
      return;
    }

    try {
      const geojson = polygonToGeoJSON(polygon);

      // Add source and layer για το polygon
      const sourceId = `polygon-${polygon.id}`;
      const layerId = `polygon-layer-${polygon.id}`;

      this.options.map.addSource(sourceId, {
        type: 'geojson',
        data: geojson
      });

      // Add fill layer
      this.options.map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': polygon.style.fillColor,
          'fill-opacity': polygon.style.fillOpacity
        }
      });

      // Add stroke layer
      this.options.map.addLayer({
        id: `${layerId}-stroke`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': polygon.style.strokeColor,
          'line-opacity': polygon.style.strokeOpacity,
          'line-width': polygon.style.strokeWidth
        }
      });

      console.log(`🗺️ Added polygon ${polygon.id} to map`);

    } catch (error) {
      console.error(`❌ Failed to add polygon to map: ${error}`);
    }
  }

  /**
   * Remove polygon from map
   */
  removePolygonFromMap(polygonId: string): void {
    if (!this.options.map) {
      return;
    }

    try {
      const sourceId = `polygon-${polygonId}`;
      const layerId = `polygon-layer-${polygonId}`;

      // Remove layers
      if (this.options.map.getLayer(`${layerId}-fill`)) {
        this.options.map.removeLayer(`${layerId}-fill`);
      }
      if (this.options.map.getLayer(`${layerId}-stroke`)) {
        this.options.map.removeLayer(`${layerId}-stroke`);
      }

      // Remove source
      if (this.options.map.getSource(sourceId)) {
        this.options.map.removeSource(sourceId);
      }

      console.log(`🗺️ Removed polygon ${polygonId} from map`);

    } catch (error) {
      console.error(`❌ Failed to remove polygon from map: ${error}`);
    }
  }

  /**
   * Get appropriate drawer για mode
   */
  private getDrawer(mode: PolygonType): SimplePolygonDrawer | ControlPointDrawer {
    switch (mode) {
      case 'georeferencing':
        return this.controlPointDrawer;
      default:
        return this.simpleDrawer;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Add global keyboard shortcuts
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            this.saveToStorage();
            break;
          case 'z':
            event.preventDefault();
            // Undo last point
            this.getDrawer(this.currentMode).removeLastPoint();
            break;
        }
      }

      switch (event.key) {
        case '1':
          this.setMode('simple');
          break;
        case '2':
          this.setMode('georeferencing');
          break;
        case '3':
          this.setMode('alert-zone');
          break;
        case '4':
          this.setMode('measurement');
          break;
        case '5':
          this.setMode('annotation');
          break;
      }
    });
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    if (!this.options.storageKey) {
      return;
    }

    try {
      const data = {
        polygons: Array.from(this.polygons.entries()),
        currentMode: this.currentMode,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(this.options.storageKey, JSON.stringify(data));
      console.log(`💾 Saved ${this.polygons.size} polygons to storage`);

    } catch (error) {
      console.error('❌ Failed to save to storage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    if (!this.options.storageKey) {
      return;
    }

    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored);

      // Restore polygons
      this.polygons.clear();
      for (const [id, polygon] of data.polygons) {
        this.polygons.set(id, polygon);
      }

      // Restore mode
      if (data.currentMode) {
        this.currentMode = data.currentMode;
      }

      console.log(`📂 Loaded ${this.polygons.size} polygons from storage`);

    } catch (error) {
      console.error('❌ Failed to load from storage:', error);
    }
  }

  /**
   * Get drawing statistics
   */
  getStats(): {
    totalPolygons: number;
    byType: Record<PolygonType, number>;
    currentMode: PolygonType;
    isDrawing: boolean;
  } {
    const byType: Record<PolygonType, number> = {
      'simple': 0,
      'georeferencing': 0,
      'alert-zone': 0,
      'measurement': 0,
      'annotation': 0
    };

    for (const polygon of Array.from(this.polygons.values())) {
      byType[polygon.type]++;
    }

    return {
      totalPolygons: this.polygons.size,
      byType,
      currentMode: this.currentMode,
      isDrawing: this.getDrawer(this.currentMode).getState().isDrawing
    };
  }
}