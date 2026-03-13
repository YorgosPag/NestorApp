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
   */
  static calculateFitToViewTransform(
    scene: DxfScene | null,
    colorLayers: ColorLayer[] = [],
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

    if (viewport.width <= 0 || viewport.height <= 0) {
      return {
        transform: null,
        success: false,
        reason: 'Invalid viewport dimensions'
      };
    }

    // Υπολογισμός scale με padding
    const boundsWidth = Math.abs(unifiedBounds.max.x - unifiedBounds.min.x);
    const boundsHeight = Math.abs(unifiedBounds.max.y - unifiedBounds.min.y);

    if (boundsWidth <= 0 || boundsHeight <= 0) {
      return {
        transform: null,
        success: false,
        reason: 'Invalid bounds dimensions'
      };
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
      // ✅ FIX (2026-01-04): Previous logic set offsets to 0, which only works if
      // the drawing starts near world (0,0). For drawings with arbitrary bounds
      // (e.g., min: {x: 1000, y: 500}), the content would be off-screen!
      //
      // NEW LOGIC: Position the content so bounds.min appears at the bottom-left
      // corner of the viewport (with padding), ensuring ALL content is visible.
      //
      // Formula: screenX = worldX * scale + offsetX
      // We want bounds.min.x to appear at screen position (paddingX, paddingY)
      // So: paddingX = bounds.min.x * scale + offsetX
      // Therefore: offsetX = paddingX - bounds.min.x * scale

      const paddingX = viewport.width * safePadding / 2;
      const paddingY = viewport.height * safePadding / 2;

      offsetX = paddingX - unifiedBounds.min.x * scale;
      offsetY = paddingY - unifiedBounds.min.y * scale;
    } else {
      // Κεντράρισμα (παλιά συμπεριφορά)
      const centerX = (unifiedBounds.min.x + unifiedBounds.max.x) / 2;
      const centerY = (unifiedBounds.min.y + unifiedBounds.max.y) / 2;
      offsetX = viewport.width / 2 - centerX * scale;
      offsetY = viewport.height / 2 - centerY * scale;
    }

    const transform: ViewTransform = { scale, offsetX, offsetY };

    return {
      transform,
      success: true,
      bounds: unifiedBounds
    };
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
   * 🔧 PURE BOUNDS FIT: Υπολογίζει fit-to-view από raw bounds χωρίς scene/layers
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

    const boundsWidth = Math.abs(bounds.max.x - bounds.min.x);
    const boundsHeight = Math.abs(bounds.max.y - bounds.min.y);

    if (boundsWidth <= 0 || boundsHeight <= 0) {
      return {
        transform: null,
        success: false,
        reason: 'Invalid bounds dimensions'
      };
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
      // ✅ FIX (2026-01-04): Position content so bounds.min appears at the bottom-left
      // corner of the viewport (with padding), ensuring ALL content is visible.
      //
      // See calculateFitToViewTransform above for detailed explanation.

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