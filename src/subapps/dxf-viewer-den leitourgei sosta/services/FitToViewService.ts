/**
 * FIT TO VIEW SERVICE
 * Κεντρικοποιημένη υπηρεσία για όλες τις fitToView operations
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Αντικαθιστά 80+ διάσπαρτες implementations
 */

import type { ViewTransform, Viewport, Point2D } from '../rendering/types/Types';
import type { ColorLayer } from '../canvas-v2/layer-canvas/layer-types';
import type { DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
import { calculateUnifiedBounds, type Bounds } from '../utils/bounds-utils';
import { ColorLayerUtils } from '../utils/ColorLayerUtils';

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
    const {
      padding = 0.1,
      maxScale = 20,
      minScale = 0.1,
      alignToOrigin = false
    } = options;

    // Υπολογισμός unified bounds
    const sceneBounds = scene?.bounds || null;
    const overlayEntities = ColorLayerUtils.toOverlayEntities(colorLayers);
    const unifiedBounds = calculateUnifiedBounds(sceneBounds, overlayEntities);

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
    const safePadding = Math.min(Math.max(padding, 0), 0.9);

    const paddedViewportWidth = viewport.width * (1 - safePadding);
    const paddedViewportHeight = viewport.height * (1 - safePadding);

    // 🛡️ GUARD: Check for zero/negative padded viewport (would cause Infinity/NaN)
    if (paddedViewportWidth <= 0 || paddedViewportHeight <= 0) {
      console.error('🚨 [1] Invalid padded viewport:', { viewport, padding: safePadding, paddedViewportWidth, paddedViewportHeight });
      return {
        transform: null,
        success: false,
        reason: 'Invalid padded viewport dimensions (padding too large)'
      };
    }

    const scaleX = paddedViewportWidth / boundsWidth;
    const scaleY = paddedViewportHeight / boundsHeight;
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), minScale), maxScale);

    // 🛡️ FINAL GUARD: Check for NaN/Infinity in scale
    if (!isFinite(scale) || scale <= 0) {
      console.error('🚨 [1] Invalid scale calculated:', { scale, scaleX, scaleY, boundsWidth, boundsHeight });
      return {
        transform: null,
        success: false,
        reason: 'Invalid scale calculated (NaN or Infinity)'
      };
    }

    // Υπολογισμός offset (center ή align to origin)
    let offsetX: number, offsetY: number;

    console.log('🎯 FitToViewService: alignToOrigin =', alignToOrigin, 'bounds =', unifiedBounds, 'scale =', scale);

    if (alignToOrigin) {
      // 🎯 ENTERPRISE FIT-TO-VIEW: Position world (0,0) at bottom-left corner (ruler intersection)
      //
      // ✅ ARCHITECTURAL FIX: offsetX/offsetY are SCREEN OFFSETS (pixels), not world!
      //
      // NEW Formula for worldToScreen:
      //   screenX = left + worldX * scale + offsetX
      //   screenY = (height - top) - worldY * scale + offsetY
      //
      // Goal: Place world (0,0) at screen (left, height - bottom)
      // (This is the ruler intersection point)
      //
      // For worldX=0, worldY=0, we want:
      //   screenX = left  (80px - vertical ruler edge)
      //   screenY = height - bottom  (height - 30px)
      //
      // Solving:
      //   left = left + 0 + offsetX  →  offsetX = 0 ✅
      //   height - bottom = (height - top) - 0 + offsetY
      //   height - 30 = height - 30 + offsetY  →  offsetY = 0 ✅
      //
      // So with screen offsets, alignToOrigin is STILL offsetX=0, offsetY=0!
      // The margins are already baked into the worldToScreen formula!

      offsetX = 0;
      offsetY = 0;
      console.log('🎯 FitToViewService: ALIGN TO ORIGIN - offsetX=0, offsetY=0');
    } else {
      // Κεντράρισμα (παλιά συμπεριφορά)
      const centerX = (unifiedBounds.min.x + unifiedBounds.max.x) / 2;
      const centerY = (unifiedBounds.min.y + unifiedBounds.max.y) / 2;
      offsetX = viewport.width / 2 - centerX * scale;
      offsetY = viewport.height / 2 - centerY * scale;
      console.log('🎯 FitToViewService: CENTER MODE - centerX=', centerX, 'centerY=', centerY, 'offsetX=', offsetX, 'offsetY=', offsetY);
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

    console.warn('🎯 FitToViewService.performFitToView failed:', result.reason);
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
    const {
      padding = 0.1,
      maxScale = 20,
      minScale = 0.1,
      alignToOrigin = false
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
    const safePadding = Math.min(Math.max(padding, 0), 0.9);

    const paddedViewportWidth = viewport.width * (1 - safePadding);
    const paddedViewportHeight = viewport.height * (1 - safePadding);

    // 🛡️ GUARD: Check for zero/negative padded viewport (would cause Infinity/NaN)
    if (paddedViewportWidth <= 0 || paddedViewportHeight <= 0) {
      console.error('🚨 [2] Invalid padded viewport:', { viewport, padding: safePadding, paddedViewportWidth, paddedViewportHeight });
      return {
        transform: null,
        success: false,
        reason: 'Invalid padded viewport dimensions (padding too large)'
      };
    }

    const scaleX = paddedViewportWidth / boundsWidth;
    const scaleY = paddedViewportHeight / boundsHeight;
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), minScale), maxScale);

    // 🛡️ FINAL GUARD: Check for NaN/Infinity in scale
    if (!isFinite(scale) || scale <= 0) {
      console.error('🚨 [2] Invalid scale calculated:', { scale, scaleX, scaleY, boundsWidth, boundsHeight });
      return {
        transform: null,
        success: false,
        reason: 'Invalid scale calculated (NaN or Infinity)'
      };
    }

    // Υπολογισμός offset (center ή align to origin)
    let offsetX: number, offsetY: number;

    if (alignToOrigin) {
      // 🎯 ENTERPRISE FIT-TO-VIEW: Position world (0,0) at bottom-left corner
      // ✅ ARCHITECTURAL FIX: offsetX/offsetY are SCREEN OFFSETS (pixels), not world!
      // See calculateFitToViewTransform above for detailed explanation
      offsetX = 0;
      offsetY = 0;
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