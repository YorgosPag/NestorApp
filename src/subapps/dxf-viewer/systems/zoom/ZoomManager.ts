/**
 * 🔍 ZOOM SYSTEM - ZOOM MANAGER
 * Κεντρική κλάση για όλες τις zoom λειτουργίες
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ CUSTOM ZOOM LOGIC:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md
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
// 🏢 ADR-043: Direct import from centralized config (eliminated zoom-constants middleman)
import { DEFAULT_ZOOM_CONFIG, ZOOM_FACTORS, ZOOM_LIMITS, VIEWPORT_DEFAULTS } from '../../config/transform-config';
// AutoCAD-parity exponential wheel zoom (magnitude-aware) — ΕΝΑΣ SSoT helper.
import { computeWheelZoomFactor } from './utils/calculations';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση centralized CoordinateTransforms για zoom calculations
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  calculateFitTransform,
  getViewportCenter,
  clampScale,
  getVisibleBounds
} from './utils';
// 🏢 ADR-418: real view-scale (1:N) ↔ pixel-scale SSoT
import { ratioToScale } from '../../utils/view-scale';
import type { SceneUnits } from '../../utils/scene-units';

export class ZoomManager implements IZoomManager {
  private config: ZoomConfig;
  private currentTransform: ViewTransform;
  private history: ZoomHistoryEntry[];
  private historyIndex: number;
  // 🏢 ENTERPRISE: Dependency Injection - Viewport reference
  private viewport: { width: number; height: number };

  constructor(initialTransform: ViewTransform, config?: Partial<ZoomConfig>, viewport?: { width: number; height: number }) {
    this.config = { ...DEFAULT_ZOOM_CONFIG, ...config };
    this.currentTransform = { ...initialTransform };
    this.history = [];
    this.historyIndex = -1;
    // 🏢 ENTERPRISE: Store viewport reference (default fallback για backward compatibility)
    // Uses centralized VIEWPORT_DEFAULTS for single source of truth
    this.viewport = viewport || {
      width: VIEWPORT_DEFAULTS.WIDTH,
      height: VIEWPORT_DEFAULTS.HEIGHT
    };

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
   *
   * 🏢 ENTERPRISE FIX (2026-01-26): Now preserves current transform if calculation fails
   * This prevents canvas from "jumping" during measurement tool usage
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

    // 🏢 ENTERPRISE FIX (2026-01-26): If calculation failed, return current state without change
    // This prevents the canvas from "jumping" when zoomToFit is called with invalid bounds
    // 🏢 ENTERPRISE (2026-01-26): Silent return - missing bounds is normal state (no DXF loaded)
    if (transform === null) {
      return this.createZoomResult('fit'); // Return current state, no change
    }

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
   * 🏢 ADR-418: Zoom to a real drawing scale 1:N.
   * Converts the ratio to a CSS-px scale via the view-scale SSoT (DPI + scene
   * units aware), then routes through the canonical `zoomToScale` path.
   * @param ratioN - drawing-scale denominator (e.g. 100 → 1:100)
   * @param sceneUnits - active scene units (drives the mm⇄px conversion)
   * @param center - optional center point (defaults to viewport center)
   */
  zoomToRatio(ratioN: number, sceneUnits: SceneUnits, center?: Point2D): ZoomResult {
    const scaleCss = ratioToScale({ ratioN, sceneUnits });
    return this.zoomToScale(scaleCss, center);
  }

  /**
   * 🏢 ADR-418: Zoom to 1:1 actual size — the drawing renders at true physical
   * size on screen (replaces the meaningless legacy `zoomTo100` = 1px·dpr/unit).
   * @param sceneUnits - active scene units
   * @param center - optional center point (defaults to viewport center)
   */
  zoomToActualSize(sceneUnits: SceneUnits, center?: Point2D): ZoomResult {
    return this.zoomToRatio(1, sceneUnits, center);
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
   * @param wheelDelta - Wheel delta (positive = zoom out, negative = zoom in)
   * @param center - Zoom center point (cursor position)
   * @param constraints - Optional zoom constraints
   * @param modifiers - Optional modifier keys (Ctrl for faster zoom)
   */
  wheelZoom(
    wheelDelta: number,
    center: Point2D,
    constraints?: ZoomConstraints,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ): ZoomResult {
    // AutoCAD-parity: magnitude-aware exponential factor (όχι σταθερό 10%). Ctrl = 2× sensitivity.
    // Το πρόσημο του wheelDelta ορίζει κατεύθυνση μέσα στο exp· το μέγεθος ορίζει ταχύτητα.
    const useCtrlZoom = modifiers?.ctrlKey === true;
    const factor = computeWheelZoomFactor(wheelDelta, useCtrlZoom);

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
      // 🏢 ENTERPRISE: Use injected viewport (fallback to constraints για backward compatibility)
      const viewport = constraints?.viewport || this.viewport;
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
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms.calculateZoomTransform (single source of truth)
    // Calculate zoom factor from current scale to new scale
    const zoomFactor = newScale / this.currentTransform.scale;
    return CoordinateTransforms.calculateZoomTransform(
      this.currentTransform,
      zoomFactor,
      center,
      viewport
    );
  }

  private getViewportCenterInternal(viewport?: { width: number; height: number }): Point2D {
    // 🏢 ENTERPRISE: Use injected viewport
    return getViewportCenter(viewport || this.viewport);
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
    // 🏢 ENTERPRISE: Use injected viewport
    return getVisibleBounds(this.currentTransform, this.viewport);
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

  // 🏢 ENTERPRISE: Viewport management
  /**
   * Update viewport dimensions (e.g., on canvas resize)
   * @param viewport - New viewport dimensions
   */
  setViewport(viewport: { width: number; height: number }): void {
    this.viewport = { ...viewport };
  }

  /**
   * Get current viewport dimensions
   */
  getViewport(): { width: number; height: number } {
    return { ...this.viewport };
  }

  /**
   * Update current transform (για external changes)
   */
  setTransform(transform: ViewTransform, mode: ZoomMode = 'programmatic'): void {
    this.currentTransform = { ...transform };
    this.addToHistory(mode);
  }
}