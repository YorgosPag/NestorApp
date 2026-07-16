/**
 * FIT TO VIEW SERVICE
 * Κεντρικοποιημένη υπηρεσία για όλες τις fitToView operations
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Αντικαθιστά 80+ διάσπαρτες implementations
 *
 * @see ADR-010: Bounds Consolidation (2026-01-04)
 */

import type { ViewTransform, Viewport } from '../rendering/types/Types';
import type { ColorLayer } from '../canvas-v2/layer-canvas/layer-types';
import type { DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
// ✅ ADR-010: Use canonical createCombinedBounds (type-safe, no 'any')
import { createCombinedBounds, type Bounds } from '../utils/bounds-utils';
import { ColorLayerUtils } from '../utils/ColorLayerUtils';
// 🏢 ENTERPRISE: Use centralized constants from transform-config
import { FIT_TO_VIEW_DEFAULTS } from '../config/transform-config';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../rendering/entities/shared/geometry-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FitToViewService');

interface FitToViewOptions {
  padding?: number; // Default: 0.1 (10% padding)
  maxScale?: number; // Default: 20
  minScale?: number; // Default: 0.1
  alignToOrigin?: boolean; // Default: false. If true, positions (0,0) at bottom-left corner
}

interface FitToViewResult {
  transform: ViewTransform | null;
  success: boolean;
  reason?: string;
  bounds?: Bounds;
}

export class FitToViewService {
  /**
   * 🎯 ΚΕΝΤΡΙΚΗ ΜΕΘΟΔΟΣ: Υπολογίζει fit-to-view transform
   * Λειτουργεί με DXF scene + color layers
   *
   * Αυτή η μέθοδος κατέχει **μόνο** το «από πού βγαίνουν τα bounds» (scene + layers)·
   * όλα τα μαθηματικά (padding / degenerate axis / scale clamp / offset) ζουν **μία
   * φορά** στο `calculateFitToViewFromBounds`. Ήταν αντιγραμμένα εδώ αυτούσια, και
   * το κόστος ήταν πραγματικό: το ADR-394 degenerate-line fix μπήκε αρχικά **μόνο
   * στο ένα** δίδυμο — ένα fit-to-view path συνέχισε να απορρίπτει τη μονή γραμμή
   * ενώ το άλλο την έφτιαχνε (N.18 / ADR-584).
   */
  static calculateFitToViewTransform(
    scene: DxfScene | null,
    colorLayers: ColorLayer[] = [],
    viewport: Viewport,
    options: FitToViewOptions = {}
  ): FitToViewResult {
    // ✅ ADR-010: Use canonical createCombinedBounds (type-safe, no intermediate conversion)
    // 🏢 FIX (2026-01-04): forceRecalculate=true ensures dynamically added entities
    // (e.g., lines drawn with drawing tool) are included in bounds calculation
    const unifiedBounds = createCombinedBounds(scene, colorLayers, true);

    if (!unifiedBounds) {
      return {
        transform: null,
        success: false,
        reason: 'No bounds available from scene or layers'
      };
    }

    return this.calculateFitToViewFromBounds(unifiedBounds, viewport, options);
  }

  /**
   * 🔧 HELPER: Fit to view με εφαρμογή του transform
   */
  static performFitToView(
    scene: DxfScene | null,
    colorLayers: ColorLayer[],
    viewport: Viewport,
    onTransformChange: (transform: ViewTransform) => void,
    options?: FitToViewOptions
  ): boolean {
    const result = this.calculateFitToViewTransform(scene, colorLayers, viewport, options);

    if (result.success && result.transform) {
      onTransformChange(result.transform);
      return true;
    }

    logger.warn('performFitToView failed', { reason: result.reason });
    return false;
  }

  /**
   * 🔧 BOUNDS CHECKER: Ελέγχει αν υπάρχουν renderable content
   */
  static hasRenderableContent(scene: DxfScene | null, colorLayers: ColorLayer[]): boolean {
    const hasScene = scene?.entities && scene.entities.length > 0;
    const hasLayers = ColorLayerUtils.hasVisibleLayers(colorLayers);
    return hasScene || hasLayers;
  }

  /**
   * 🔧 SMART FIT: Fit to view μόνο αν υπάρχει content
   */
  static smartFitToView(
    scene: DxfScene | null,
    colorLayers: ColorLayer[],
    viewport: Viewport,
    onTransformChange: (transform: ViewTransform) => void,
    options?: FitToViewOptions
  ): boolean {
    if (!this.hasRenderableContent(scene, colorLayers)) {
      console.log('🎯 FitToViewService.smartFitToView: No renderable content, skipping');
      return false;
    }

    return this.performFitToView(scene, colorLayers, viewport, onTransformChange, options);
  }

  /**
   * 🔧 PURE BOUNDS FIT — **το SSoT των fit-to-view μαθηματικών** (N.18 / ADR-584).
   *
   * Κάθε fit-to-view path καταλήγει εδώ: το scene-based `calculateFitToViewTransform`
   * απλώς λύνει πρώτα τα bounds και delegate-άρει. Ο,τι αλλάξει εδώ (padding,
   * degenerate axis, clamp, offset) ισχύει **αυτόματα** και για τα δύο — που είναι
   * ακριβώς αυτό που δεν ίσχυε όσο ήταν αντιγραμμένα.
   */
  static calculateFitToViewFromBounds(
    bounds: Bounds,
    viewport: Viewport,
    options: FitToViewOptions = {}
  ): FitToViewResult {
    // 🏢 ENTERPRISE: Use centralized defaults from transform-config
    const {
      padding = FIT_TO_VIEW_DEFAULTS.PADDING_PERCENTAGE,
      maxScale = FIT_TO_VIEW_DEFAULTS.MAX_SCALE,
      minScale = FIT_TO_VIEW_DEFAULTS.MIN_SCALE,
      alignToOrigin = FIT_TO_VIEW_DEFAULTS.ALIGN_TO_ORIGIN
    } = options;

    if (viewport.width <= 0 || viewport.height <= 0) {
      return {
        transform: null,
        success: false,
        reason: 'Invalid viewport dimensions'
      };
    }

    let boundsWidth = Math.abs(bounds.max.x - bounds.min.x);
    let boundsHeight = Math.abs(bounds.max.y - bounds.min.y);

    // 🏢 ADR-394 — Degenerate bounds (one dimension is 0). THIS is the method the
    // Z fit-to-selection path reaches (zoomToFit → calculateFitTransform →
    // calculateFitToViewFromBounds). A single axis-aligned line gives a 0 width
    // (vertical) or 0 height (horizontal) → previously rejected here → no zoom
    // (worked only when a 2D entity was co-selected). Substitute the dominant span
    // for the zero axis so the line frames (square fit around its midpoint). A true
    // point (both zero) stays un-fittable and is still rejected.
    if (boundsWidth <= 0 || boundsHeight <= 0) {
      const span = Math.max(boundsWidth, boundsHeight);
      if (span <= 0) {
        return {
          transform: null,
          success: false,
          reason: 'Invalid bounds dimensions'
        };
      }
      if (boundsWidth <= 0) boundsWidth = span;
      if (boundsHeight <= 0) boundsHeight = span;
    }

    // 🛡️ GUARD: Ensure padding doesn't exceed 0.9 (90%) to prevent NaN
    // 🏢 ADR-071: Using centralized clamp
    const safePadding = clamp(padding, 0, 0.9);

    const paddedViewportWidth = viewport.width * (1 - safePadding);
    const paddedViewportHeight = viewport.height * (1 - safePadding);

    // 🛡️ GUARD: Check for zero/negative padded viewport (would cause Infinity/NaN)
    if (paddedViewportWidth <= 0 || paddedViewportHeight <= 0) {
      logger.error('Invalid padded viewport', { viewport, padding: safePadding, paddedViewportWidth, paddedViewportHeight });
      return {
        transform: null,
        success: false,
        reason: 'Invalid padded viewport dimensions (padding too large)'
      };
    }

    const scaleX = paddedViewportWidth / boundsWidth;
    const scaleY = paddedViewportHeight / boundsHeight;
    // 🏢 ADR-071: Using centralized clamp
    const scale = clamp(Math.min(scaleX, scaleY), minScale, maxScale);

    // 🛡️ FINAL GUARD: Check for NaN/Infinity in scale
    // 🏢 ADR-161: Use Number.isFinite() for strict type checking (no coercion)
    if (!Number.isFinite(scale) || scale <= 0) {
      logger.error('Invalid scale calculated', { scale, scaleX, scaleY, boundsWidth, boundsHeight });
      return {
        transform: null,
        success: false,
        reason: 'Invalid scale calculated (NaN or Infinity)'
      };
    }

    // Υπολογισμός offset (center ή align to origin)
    let offsetX: number, offsetY: number;

    if (alignToOrigin) {
      // 🏢 ENTERPRISE FIT-TO-VIEW: Position bounds.min at bottom-left corner (with padding)
      //
      // ✅ FIX (2026-01-04): Previous logic set offsets to 0, which only works if the
      // drawing starts near world (0,0). For drawings with arbitrary bounds (e.g.
      // min: {x: 1000, y: 500}) the content would be off-screen. Position the content
      // so bounds.min lands at the bottom-left corner (with padding) instead.
      //
      // Formula: screenX = worldX * scale + offsetX. We want bounds.min.x at screen
      // (paddingX, paddingY) → paddingX = bounds.min.x * scale + offsetX
      // → offsetX = paddingX - bounds.min.x * scale.

      const paddingX = viewport.width * safePadding / 2;
      const paddingY = viewport.height * safePadding / 2;

      offsetX = paddingX - bounds.min.x * scale;
      offsetY = paddingY - bounds.min.y * scale;
    } else {
      // Κεντράρισμα (παλιά συμπεριφορά)
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      const centerY = (bounds.min.y + bounds.max.y) / 2;
      offsetX = viewport.width / 2 - centerX * scale;
      offsetY = viewport.height / 2 - centerY * scale;
    }

    return {
      transform: { scale, offsetX, offsetY },
      success: true,
      bounds
    };
  }
}