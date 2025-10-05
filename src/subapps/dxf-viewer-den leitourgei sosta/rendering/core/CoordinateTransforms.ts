/**
 * RENDERING CORE - UNIFIED COORDINATE TRANSFORMS
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Χωρίς διπλογραφίες - Single Source of Truth
 * ✅ CHATGPT FIXES: Y-axis και viewport-based calculations
 * ✅ MARGINS SYSTEM: From old backup για consistency με rulers
 */

import type { Point2D, ViewTransform, Viewport } from '../types/Types';

// ✅ MARGINS SYSTEM από το παλιό backup για rulers consistency
export const COORDINATE_LAYOUT = {
  RULER_LEFT_WIDTH: 80,
  RULER_TOP_HEIGHT: 30,
  MARGINS: {
    left: 80,   // Space for vertical ruler
    top: 30,    // Space for horizontal ruler
    right: 0,   // No right margin
    bottom: 30  // Space for coordinates/status
  }
} as const;

// Legacy exports for compatibility
export const MARGINS = COORDINATE_LAYOUT.MARGINS;

export class CoordinateTransforms {
  /**
   * Μετατροπή από world coordinates σε screen coordinates
   * ✅ ARCHITECTURAL FIX: offsetX/offsetY are SCREEN offsets (pixels), not world!
   */
  static worldToScreen(
    worldPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport
  ): Point2D {
    // ✅ RESTORED: Margins για σωστή τοποθέτηση relative σε rulers
    const { left, top } = COORDINATE_LAYOUT.MARGINS;
    if (!worldPoint) {
      console.warn("worldToScreen received undefined point. Returning (0,0)");
      return { x: left, y: viewport.height - top };
    }
    // 🎯 CRITICAL: offsetX/offsetY are SCREEN OFFSETS (pixels)
    // Formula: screenX = left + worldX * scale + offsetX
    //          screenY = (height - top) - worldY * scale - offsetY
    // Note: offsetY is SUBTRACTED because positive offset moves drawing UP (decreases screenY)
    return {
      x: left + worldPoint.x * transform.scale + transform.offsetX,
      y: (viewport.height - top) - worldPoint.y * transform.scale - transform.offsetY
    };
  }

  /**
   * Μετατροπή από screen coordinates σε world coordinates
   * ✅ ARCHITECTURAL FIX: offsetX/offsetY are SCREEN offsets (pixels), not world!
   */
  static screenToWorld(
    screenPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport
  ): Point2D {
    // ✅ RESTORED: Margins για σωστή μετατροπή relative από rulers
    const { left, top } = COORDINATE_LAYOUT.MARGINS;
    if (!screenPoint) {
      console.warn("screenToWorld received undefined point. Returning origin offset");
      return { x: -transform.offsetX / transform.scale, y: -transform.offsetY / transform.scale };
    }
    // 🎯 CRITICAL: offsetX/offsetY are SCREEN OFFSETS (pixels)
    // Formula: worldX = (screenX - left - offsetX) / scale
    //          worldY = ((height - top) - screenY - offsetY) / scale
    // Note: offsetY is SUBTRACTED (inverse of worldToScreen where it's subtracted)
    return {
      x: (screenPoint.x - left - transform.offsetX) / transform.scale,
      y: ((viewport.height - top) - screenPoint.y - transform.offsetY) / transform.scale
    };
  }

  /**
   * Υπολογισμός νέου transform για zoom
   *
   * 🏢 ENTERPRISE FIX (2025-10-04): Zoom-to-Cursor με Margins Adjustment
   *
   * Το πρόβλημα: Το zoomCenter είναι canvas-relative (0,0 = top-left του canvas),
   * αλλά το world (0,0) εμφανίζεται στο (MARGINS.left, MARGINS.top) του canvas.
   *
   * Η λύση: Adjust το zoomCenter για margins πριν εφαρμόσουμε τη zoom formula.
   * Αυτό εξασφαλίζει ότι το σημείο κάτω από τον cursor παραμένει σταθερό.
   *
   * @see https://stackoverflow.com/questions/2916081/zoom-in-on-a-point-using-scale-and-translate
   * @see CAD Systems: Translate → Scale → Translate back pattern
   */
  static calculateZoomTransform(
    currentTransform: ViewTransform,
    zoomFactor: number,
    zoomCenter: Point2D,
    viewport: Viewport
  ): ViewTransform {
    const newScale = currentTransform.scale * zoomFactor;

    // 🎯 ENTERPRISE: Adjust zoomCenter για margins
    // Το zoomCenter είναι canvas-relative, αλλά πρέπει να γίνει viewport-relative
    const { left, top } = COORDINATE_LAYOUT.MARGINS;
    const adjustedCenterX = zoomCenter.x - left;
    const adjustedCenterY = zoomCenter.y - top;

    // ✅ CLASSIC CAD FORMULA: offsetNew = center - (center - offsetOld) * zoomFactor
    // Με adjusted center, το world point κάτω από το zoomCenter παραμένει σταθερό
    return {
      scale: newScale,
      offsetX: adjustedCenterX - (adjustedCenterX - currentTransform.offsetX) * zoomFactor,
      offsetY: adjustedCenterY - (adjustedCenterY - currentTransform.offsetY) * zoomFactor
    };
  }

  /**
   * Υπολογισμός νέου transform για pan
   */
  static calculatePanTransform(
    currentTransform: ViewTransform,
    deltaX: number,
    deltaY: number
  ): ViewTransform {
    return {
      scale: currentTransform.scale,
      offsetX: currentTransform.offsetX + deltaX,
      offsetY: currentTransform.offsetY + deltaY
    };
  }

  /**
   * Έλεγχος αν point είναι εντός viewport
   */
  static isPointInViewport(
    point: Point2D,
    viewport: Viewport
  ): boolean {
    return point.x >= 0 &&
           point.x <= viewport.width &&
           point.y >= 0 &&
           point.y <= viewport.height;
  }

  /**
   * LEGACY SUPPORT: Wrapper methods για παλιό κώδικα που περιμένει canvas-based calls
   */
  static worldToScreenLegacy(
    worldPoint: Point2D,
    transform: ViewTransform,
    canvasRect: DOMRect
  ): Point2D {
    const viewport = { width: canvasRect.width, height: canvasRect.height };
    return this.worldToScreen(worldPoint, transform, viewport);
  }

  static screenToWorldLegacy(
    screenPoint: Point2D,
    transform: ViewTransform,
    canvasRect: DOMRect
  ): Point2D {
    const viewport = { width: canvasRect.width, height: canvasRect.height };
    return this.screenToWorld(screenPoint, transform, viewport);
  }

  /**
   * Simple coordinate transform χωρίς Y-flip για legacy compatibility
   */
  static worldToScreenSimple(worldPoint: Point2D, transform: ViewTransform): Point2D {
    return {
      x: worldPoint.x * transform.scale + transform.offsetX,
      y: worldPoint.y * transform.scale + transform.offsetY
    };
  }
}