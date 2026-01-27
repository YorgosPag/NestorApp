/**
 * RENDERING CORE - UNIFIED COORDINATE TRANSFORMS
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Χωρίς διπλογραφίες - Single Source of Truth
 * ✅ CHATGPT FIXES: Y-axis και viewport-based calculations
 * ✅ MARGINS SYSTEM: From old backup για consistency με rulers
 *
 * ⚠️ ΠΡΟΣΟΧΗ - ΜΗΝ ΑΛΛΑΞΕΙΣ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΧΩΡΙΣ ΛΟΓΟ! ⚠️
 * 🏆 ZOOM-TO-CURSOR: Λειτουργεί τέλεια μετά από πολλές διορθώσεις (2026-01-25)
 * - calculateZoomTransform(): Y-axis inversion fix - ΤΟ ΣΗΜΕΙΟ ΚΑΤΩ ΑΠΟ ΤΟ CURSOR ΜΕΝΕΙ ΣΤΑΘΕΡΟ
 * - worldToScreen/screenToWorld: Margins + Y-inversion - ΔΟΚΙΜΑΣΜΕΝΑ
 */

import type { Point2D, ViewTransform, Viewport } from '../types/Types';

// ✅ MARGINS SYSTEM - Single Source of Truth για ruler dimensions
// 🏢 ENTERPRISE FIX (2026-01-06): Synchronized with actual ruler settings (30px)
// Previously had inconsistent values (80px) causing snap indicator misalignment
export const COORDINATE_LAYOUT = {
  RULER_LEFT_WIDTH: 30,   // ✅ FIXED: Was 80, actual rulers are 30px
  RULER_TOP_HEIGHT: 30,
  MARGINS: {
    left: 30,   // Space for vertical ruler (synchronized with ruler width)
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
   *
   * 🏢 ENTERPRISE FIX (2026-01-27): Viewport Validation
   * PROBLEM: Όταν viewport.height = 0, η φόρμουλα δίνει λανθασμένες screen positions.
   * SOLUTION: Validation check - επιστρέφει fallback αν το viewport δεν είναι έτοιμο.
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
      return { x: left, y: viewport?.height ? viewport.height - top : top };
    }

    // 🏢 ENTERPRISE FIX (2026-01-27): Viewport validation
    // Αν το viewport δεν είναι έτοιμο, χρησιμοποιεί fallback υπολογισμό
    if (!viewport || viewport.height <= 0 || viewport.width <= 0) {
      console.warn("worldToScreen: Invalid viewport dimensions", viewport);
      // Fallback: Use simple conversion without Y-inversion
      return {
        x: left + worldPoint.x * transform.scale + transform.offsetX,
        y: top + worldPoint.y * transform.scale + transform.offsetY
      };
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
   *
   * 🏢 ENTERPRISE FIX (2026-01-27): Viewport Validation
   * PROBLEM: Όταν viewport.height = 0 (πριν αρχικοποιηθεί), η φόρμουλα δίνει λανθασμένα Y.
   *          Αυτό προκαλεί μετατόπιση ~80px στο distance measurement την πρώτη φορά.
   * SOLUTION: Validation check - επιστρέφει fallback αν το viewport δεν είναι έτοιμο.
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

    // 🏢 ENTERPRISE FIX (2026-01-27): Viewport validation
    // Αν το viewport δεν είναι έτοιμο (width ή height = 0), επιστρέφει fallback
    // που βασίζεται μόνο στο X coordinate (Y θα είναι 0)
    // Αυτό αποτρέπει λανθασμένες μετατροπές πριν το layout stabilize
    if (!viewport || viewport.height <= 0 || viewport.width <= 0) {
      console.warn("screenToWorld: Invalid viewport dimensions", viewport);
      // Fallback: Use screen position as world position (1:1 mapping)
      // This is better than returning wildly incorrect values
      return {
        x: (screenPoint.x - left - transform.offsetX) / transform.scale,
        y: (screenPoint.y - top - transform.offsetY) / transform.scale
      };
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

    // 🎯 ENTERPRISE: Adjust zoomCenter για margins AND Y-axis inversion
    // Το zoomCenter είναι canvas-relative (screen coordinates)
    // Πρέπει να το μετατρέψουμε σε "offset-space" για τη zoom formula
    const { left, top } = COORDINATE_LAYOUT.MARGINS;

    // 🏢 X-axis: Απλή αφαίρεση margin (screen X αυξάνει προς τα δεξιά)
    // Formula: screenX = left + worldX * scale + offsetX
    // Άρα: adjustedX = screenX - left = worldX * scale + offsetX
    const adjustedCenterX = zoomCenter.x - left;

    // 🏢 Y-axis: INVERTED! (screen Y αυξάνει προς τα κάτω, world Y προς τα πάνω)
    // Formula: screenY = (height - top) - worldY * scale - offsetY
    // Άρα: adjustedY = (height - top) - screenY = worldY * scale + offsetY
    // 🐛 FIX (2026-01-25): Ήταν λάθος: zoomCenter.y - top (δεν λάμβανε υπόψη Y-inversion)
    const adjustedCenterY = (viewport.height - top) - zoomCenter.y;

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