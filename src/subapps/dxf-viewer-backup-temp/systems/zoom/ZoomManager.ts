/**
 * 🔍 ZOOM SYSTEM - ZOOM MANAGER
 * Κεντρική κλάση για όλες τις zoom λειτουργίες
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ CUSTOM ZOOM LOGIC:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/centralized_systems.md
 * 🔍 Section: "Zoom & Pan" - Χρησιμοποίησε το κεντρικό ZoomManager
 *
 * 🏢 ENTERPRISE PATTERN: Centralized viewport management με state consistency
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Χρήση ZoomManager
 * zoomManager.zoomToFit(entities);
 *
 * // ❌ ΛΑΘΟΣ - Direct transform manipulation
 * setTransform({scale: newScale, ...}); // Bypass zoom manager
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type {
  IZoomManager,
  ZoomConfig,
  ZoomOperation,
  ZoomResult,
  ZoomHistoryEntry,
  ZoomConstraints,
  ZoomMode
} from './zoom-types';
import { DEFAULT_ZOOM_CONFIG, ZOOM_FACTORS, ZOOM_LIMITS } from './zoom-constants';
import {
  calculateZoomTransform,
  calculateFitTransform,
  getViewportCenter,
  clampScale,
  getVisibleBounds
} from './utils';

export class ZoomManager implements IZoomManager {
  private config: ZoomConfig;
  private currentTransform: ViewTransform;
  private history: ZoomHistoryEntry[];
  private historyIndex: number;

  constructor(initialTransform: ViewTransform, config?: Partial<ZoomConfig>) {
    this.config = { ...DEFAULT_ZOOM_CONFIG, ...config };
    this.currentTransform = { ...initialTransform };
    this.history = [];
    this.historyIndex = -1;

    // Add initial state to history
    this.addToHistory('fit');
  }

  // === CORE ZOOM OPERATIONS ===

  /**
   * Zoom In - Μεγέθυνση
   */
  zoomIn(center?: Point2D, constraints?: ZoomConstraints): ZoomResult {
    const zoomCenter = center || this.getViewportCenterInternal(constraints?.viewport);
    const newScale = clampScale(
      this.currentTransform.scale * this.config.keyboardFactor,
      constraints?.minScale || this.config.minScale,
      constraints?.maxScale || this.config.maxScale
    );

    return this.applyZoom({
      mode: 'keyboard',
      direction: 'in',
      center: zoomCenter,
      targetScale: newScale
    }, constraints);
  }

  /**
   * Zoom Out - Σμίκρυνση
   */
  zoomOut(center?: Point2D, constraints?: ZoomConstraints): ZoomResult {
    const zoomCenter = center || this.getViewportCenterInternal(constraints?.viewport);
    const newScale = clampScale(
      this.currentTransform.scale / this.config.keyboardFactor,
      constraints?.minScale || this.config.minScale,
      constraints?.maxScale || this.config.maxScale
    );

    return this.applyZoom({
      mode: 'keyboard',
      direction: 'out',
      center: zoomCenter,
      targetScale: newScale
    }, constraints);
  }

  /**
   * Zoom to Fit - Fit όλα τα contents στην οθόνη
   * @param alignToOrigin - If true, positions (0,0) at bottom-left corner (axis intersection)
   */
  zoomToFit(
    bounds: { min: Point2D; max: Point2D },
    viewport: { width: number; height: number },
    alignToOrigin: boolean = false
  ): ZoomResult {
    const transform = calculateFitTransform(
      bounds,
      viewport,
      ZOOM_FACTORS.FIT_PADDING,
      this.config.maxScale,
      this.config.minScale,
      alignToOrigin
    );

    return this.applyZoom({
      mode: 'fit',
      bounds
    }, {
      viewport,
      contentBounds: bounds
    }, transform);
  }

  /**
   * Zoom to Scale - Συγκεκριμένη κλίμακα
   */
  zoomToScale(scale: number, center?: Point2D): ZoomResult {
    const clampedScale = Math.max(
      this.config.minScale,
      Math.min(scale, this.config.maxScale)
    );
    const zoomCenter = center || this.getViewportCenterInternal();

    return this.applyZoom({
      mode: 'scale',
      center: zoomCenter,
      targetScale: clampedScale
    });
  }

  /**
   * 🎯 ENTERPRISE: Zoom to 100% (1:1) - DPI-aware real-world scale
   * @param center - Optional center point (defaults to viewport center)
   */
  zoomTo100(center?: Point2D): ZoomResult {
    // 🎯 DPI-aware 1:1 scale
    // For CAD applications, 1.0 scale typically means 1 pixel = 1 drawing unit
    // Device pixel ratio should be considered for true 1:1 on high-DPI displays
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const scale100 = 1.0 * dpr;

    return this.zoomToScale(scale100, center);
  }

  /**
   * Zoom to Window - Zoom σε επιλεγμένη περιοχή
   */
  zoomToWindow(
    startPoint: Point2D,
    endPoint: Point2D,
    viewport: { width: number; height: number }
  ): ZoomResult {
    const minX = Math.min(startPoint.x, endPoint.x);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxY = Math.max(startPoint.y, endPoint.y);

    const windowWidth = maxX - minX;
    const windowHeight = maxY - minY;

    // Check minimum window size
    if (windowWidth < ZOOM_FACTORS.WINDOW_MIN_SIZE || windowHeight < ZOOM_FACTORS.WINDOW_MIN_SIZE) {
      return this.createZoomResult('window');
    }

    return this.zoomToFit(
      { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } },
      viewport
    );
  }

  // === WHEEL ZOOM ===

  /**
   * Mouse Wheel Zoom - Zoom με mouse wheel
   */
  wheelZoom(
    wheelDelta: number,
    center: Point2D,
    constraints?: ZoomConstraints
  ): ZoomResult {
    const factor = wheelDelta > 0 ? ZOOM_FACTORS.WHEEL_OUT : ZOOM_FACTORS.WHEEL_IN;
    const newScale = Math.max(
      constraints?.minScale || this.config.minScale,
      Math.min(
        this.currentTransform.scale * factor,
        constraints?.maxScale || this.config.maxScale
      )
    );

    return this.applyZoom({
      mode: 'wheel',
      direction: wheelDelta > 0 ? 'out' : 'in',
      center,
      targetScale: newScale
    }, constraints);
  }

  // === HISTORY MANAGEMENT ===

  /**
   * Zoom Previous - Προηγούμενη εμφάνιση
   */
  zoomPrevious(): ZoomResult | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const entry = this.history[this.historyIndex];
      this.currentTransform = { ...entry.transform };
      return this.createZoomResult('previous');
    }
    return null;
  }

  /**
   * Zoom Next - Επόμενη εμφάνιση
   */
  zoomNext(): ZoomResult | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const entry = this.history[this.historyIndex];
      this.currentTransform = { ...entry.transform };
      return this.createZoomResult('previous');
    }
    return null;
  }

  // === PRIVATE HELPER METHODS ===

  private applyZoom(
    operation: ZoomOperation,
    constraints?: ZoomConstraints,
    customTransform?: ViewTransform
  ): ZoomResult {
    if (customTransform) {
      this.currentTransform = { ...customTransform };
    } else if (operation.targetScale && operation.center) {
      // Standard zoom with center point
      // ✅ CRITICAL: Pass viewport for accurate coordinate conversion
      const viewport = constraints?.viewport || { width: 800, height: 600 };
      const newTransform = this.calculateZoomTransformInternal(
        operation.targetScale,
        operation.center,
        viewport
      );
      this.currentTransform = newTransform;
    }

    this.addToHistory(operation.mode);
    return this.createZoomResult(operation.mode);
  }

  private calculateZoomTransformInternal(
    newScale: number,
    center: Point2D,
    viewport: { width: number; height: number }
  ): ViewTransform {
    return calculateZoomTransform(this.currentTransform, newScale, center, viewport);
  }

  private getViewportCenterInternal(viewport?: { width: number; height: number }): Point2D {
    return getViewportCenter(viewport || { width: 800, height: 600 });
  }

  private addToHistory(mode: ZoomMode): void {
    // Remove any future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new entry
    this.history.push({
      transform: { ...this.currentTransform },
      timestamp: Date.now(),
      mode
    });

    // Limit history size
    if (this.history.length > ZOOM_LIMITS.HISTORY_SIZE) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  private createZoomResult(mode: ZoomMode): ZoomResult {
    return {
      transform: { ...this.currentTransform },
      scale: this.currentTransform.scale,
      center: this.getViewportCenterInternal(),
      bounds: this.getViewBounds(),
      mode,
      timestamp: Date.now()
    };
  }

  private getViewBounds(): { min: Point2D; max: Point2D } {
    return getVisibleBounds(this.currentTransform, { width: 800, height: 600 });
  }

  // === PUBLIC GETTERS/SETTERS ===

  getCurrentTransform(): ViewTransform {
    return { ...this.currentTransform };
  }

  getHistory(): ZoomHistoryEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
    this.addToHistory('fit');
  }

  setConfig(config: Partial<ZoomConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ZoomConfig {
    return { ...this.config };
  }

  /**
   * Update current transform (για external changes)
   */
  setTransform(transform: ViewTransform, mode: ZoomMode = 'programmatic'): void {
    this.currentTransform = { ...transform };
    this.addToHistory(mode);
  }
}