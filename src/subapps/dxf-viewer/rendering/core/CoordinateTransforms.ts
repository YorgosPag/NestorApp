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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CoordinateTransforms');

// ✅ MARGINS SYSTEM - Single Source of Truth για ruler dimensions
// 🏢 ENTERPRISE FIX (2026-01-06): Synchronized with actual ruler settings (30px)
// Previously had inconsistent values (80px) causing snap indicator misalignment
export const COORDINATE_LAYOUT = {
  RULER_LEFT_WIDTH: 30,   // ✅ FIXED: Was 80, actual rulers are 30px
  RULER_TOP_HEIGHT: 30,
  MARGINS: {
    left: 30,   // Space for vertical ruler (synchronized with ruler width)
    top: 30,    // Y-inversion anchor: used in formula screenY = (height - top) — NOT a top-of-screen margin
    right: 0,   // No right margin
    bottom: 30  // Space for bottom horizontal ruler / coordinates
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
      logger.warn('worldToScreen received undefined point. Returning (0,0)');
      return { x: left, y: viewport?.height ? viewport.height - top : top };
    }

    // 🏢 ENTERPRISE FIX (2026-01-27): Viewport validation
    // Αν το viewport δεν είναι έτοιμο, χρησιμοποιεί fallback υπολογισμό
    if (!viewport || viewport.height <= 0 || viewport.width <= 0) {
      logger.warn('worldToScreen: Invalid viewport dimensions', { viewport });
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
      logger.warn('screenToWorld received undefined point. Returning origin offset');
      return { x: -transform.offsetX / transform.scale, y: -transform.offsetY / transform.scale };
    }

    // 🏢 ENTERPRISE FIX (2026-01-27): Viewport validation
    // Αν το viewport δεν είναι έτοιμο (width ή height = 0), επιστρέφει fallback
    // που βασίζεται μόνο στο X coordinate (Y θα είναι 0)
    // Αυτό αποτρέπει λανθασμένες μετατροπές πριν το layout stabilize
    if (!viewport || viewport.height <= 0 || viewport.width <= 0) {
      logger.warn('screenToWorld: Invalid viewport dimensions', { viewport });
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

// ============================================================================
// 🏢 ENTERPRISE (2026-01-30): POINTER SNAPSHOT UTILITIES - SSoT Pattern
// ============================================================================
// PROBLEM: Stale bounds (rect) and viewport from caching services cause drift
// when DevTools toggles. React state updates are also async.
// SOLUTION: Single "Pointer Snapshot" per event that captures BOTH rect AND
// viewport from the SAME element at the SAME moment. No caching, no mixing.
//
// CRITICAL: viewport MUST come from rect.width/rect.height (not clientWidth)
// to guarantee 1:1 consistency with screenPos calculations.
// ============================================================================

/**
 * 🎯 Unified Pointer Snapshot - rect + viewport from SAME element
 *
 * This is the CANONICAL way to get bounds and viewport for coordinate transforms.
 * Using this ensures rect and viewport are ALWAYS consistent (same source).
 */
export interface PointerSnapshot {
  /** Fresh DOMRect from getBoundingClientRect() */
  rect: DOMRect;
  /** Viewport derived from rect.width/rect.height (1:1 with rect) */
  viewport: Viewport;
}

/**
 * 🎯 Get unified pointer snapshot (rect + viewport) from DOM element
 *
 * CRITICAL: This is the ONLY way to get bounds/viewport for transforms!
 * - rect and viewport come from the SAME element at the SAME moment
 * - viewport is derived from rect (not clientWidth) for 1:1 consistency
 * - No caching, no service calls - fresh read every time
 *
 * @param element - The event target element (typically e.currentTarget)
 * @returns PointerSnapshot with rect and viewport, or null if invalid
 */
export function getPointerSnapshotFromElement(element: HTMLElement | null): PointerSnapshot | null {
  if (!element) {
    // 🏢 ENTERPRISE: Silent fail in production, no console spam
    return null;
  }

  // 🎯 CRITICAL: Fresh rect from DOM - no caching!
  const rect = element.getBoundingClientRect();

  // 🏢 ENTERPRISE: Strict validation - fail-fast
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  // 🎯 CRITICAL: viewport from rect (not clientWidth) for 1:1 consistency
  const viewport: Viewport = {
    width: rect.width,
    height: rect.height
  };

  return { rect, viewport };
}

/**
 * 🎯 Calculate screen position from mouse event using pointer snapshot
 *
 * Helper to compute canvas-relative screen coordinates from a mouse event.
 *
 * @param e - The mouse event
 * @param snap - The pointer snapshot (from getPointerSnapshotFromElement)
 * @returns Screen position relative to the element
 */
export function getScreenPosFromEvent(
  e: { clientX: number; clientY: number },
  snap: PointerSnapshot
): Point2D {
  return {
    x: e.clientX - snap.rect.left,
    y: e.clientY - snap.rect.top
  };
}

/**
 * 🎯 Convert screen point to world using pointer snapshot
 *
 * Convenience wrapper that uses the unified PointerSnapshot for transform.
 *
 * @param screenPoint - The screen coordinates to convert
 * @param transform - The current view transform
 * @param snap - The pointer snapshot (from getPointerSnapshotFromElement)
 * @returns World coordinates
 */
export function screenToWorldWithSnapshot(
  screenPoint: Point2D,
  transform: ViewTransform,
  snap: PointerSnapshot
): Point2D {
  return CoordinateTransforms.screenToWorld(screenPoint, transform, snap.viewport);
}

// ============================================================================
// 🏢 DEV-ONLY INSTRUMENTATION (2026-01-30): Viewport Mismatch Detection
// ============================================================================
// PURPOSE: Detect when input and render use different viewports (causes drift)
// USAGE: Call logViewportForInput() in mouse handlers, logViewportForRender() in render
// DETECTION: If viewports differ by more than 1px, logs actionable warning

// Store last input viewport for comparison
let lastInputViewport: Viewport | null = null;
let lastInputTimestamp = 0;
const VIEWPORT_MISMATCH_THRESHOLD = 1; // pixels
const VIEWPORT_COMPARISON_WINDOW = 100; // ms - compare if render happens within 100ms of input

/**
 * 🔍 DEV-ONLY: Log viewport used by input handler
 * Call this in mouse event handlers AFTER getting viewport
 */
export function logViewportForInput(viewport: Viewport, eventType: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  lastInputViewport = { ...viewport };
  lastInputTimestamp = Date.now();
  // Uncomment for verbose logging:
  // console.log(`[Viewport:Input] ${eventType}:`, viewport);
}

/**
 * 🔍 DEV-ONLY: Log viewport used by render and detect mismatch
 * Call this in render loops BEFORE using viewport
 */
export function logViewportForRender(viewport: Viewport, rendererName: string): void {
  if (process.env.NODE_ENV !== 'development') return;

  // Only compare if we have a recent input event
  const now = Date.now();
  if (!lastInputViewport || (now - lastInputTimestamp) > VIEWPORT_COMPARISON_WINDOW) {
    return; // No recent input to compare with
  }

  // Check for mismatch
  const widthDiff = Math.abs(viewport.width - lastInputViewport.width);
  const heightDiff = Math.abs(viewport.height - lastInputViewport.height);

  if (widthDiff > VIEWPORT_MISMATCH_THRESHOLD || heightDiff > VIEWPORT_MISMATCH_THRESHOLD) {
    logger.warn(
      `Viewport MISMATCH ${rendererName}: ` +
      `Input used: ${lastInputViewport.width}x${lastInputViewport.height}, ` +
      `Render uses: ${viewport.width}x${viewport.height}, ` +
      `Diff: ${widthDiff.toFixed(1)}px x ${heightDiff.toFixed(1)}px, ` +
      `Time since input: ${now - lastInputTimestamp}ms. ` +
      `ACTION: Check if render is using stale React state instead of fresh ref`
    );
  }
}

/**
 * 🔍 DEV-ONLY: Clear stored viewport (call on unmount)
 */
export function clearViewportInstrumentation(): void {
  lastInputViewport = null;
  lastInputTimestamp = 0;
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility during migration)
// ============================================================================

/**
 * @deprecated Use getPointerSnapshotFromElement instead
 */
export function getViewportSnapshotFromElement(element: HTMLElement | null): Viewport | null {
  const snap = getPointerSnapshotFromElement(element);
  return snap ? snap.viewport : null;
}

/**
 * @deprecated Use getPointerSnapshotFromElement instead
 */
export function getBoundsSnapshotFromElement(element: HTMLElement | null): DOMRect | null {
  const snap = getPointerSnapshotFromElement(element);
  return snap ? snap.rect : null;
}

/**
 * @deprecated Use getPointerSnapshotFromElement + screenToWorldWithSnapshot instead
 */
export function screenToWorldFromElement(
  screenPoint: Point2D,
  transform: ViewTransform,
  element: HTMLElement | null
): Point2D | null {
  const snap = getPointerSnapshotFromElement(element);
  if (!snap) {
    return null;
  }
  return CoordinateTransforms.screenToWorld(screenPoint, transform, snap.viewport);
}

// ============================================================================
// 🏢 ADR-151: SIMPLE COORDINATE TRANSFORM FUNCTIONS (Standalone Exports)
// ============================================================================
// PURPOSE: Eliminate scattered inline coordinate transform patterns like:
//   x: point.x * transform.scale + transform.offsetX,
//   y: point.y * transform.scale + transform.offsetY
//
// USE CASES: Overlay systems, visibility checks, bounding boxes (NO Y-inversion needed)
// For CAD rendering with Y-inversion, use CoordinateTransforms.worldToScreen() instead
// ============================================================================

/**
 * 🏢 ADR-151: Simple world-to-screen coordinate transform (NO Y-inversion)
 *
 * Standalone export wrapper for CoordinateTransforms.worldToScreenSimple()
 * Use this for overlay systems, visibility checks, and bounding box calculations
 * where Y-axis inversion is NOT needed.
 *
 * @param point - World coordinates to convert
 * @param transform - Current view transform (scale, offsetX, offsetY)
 * @returns Screen coordinates (without Y-axis inversion)
 */
export function worldToScreenSimple(point: Point2D, transform: ViewTransform): Point2D {
  return CoordinateTransforms.worldToScreenSimple(point, transform);
}

/**
 * 🏢 ADR-151: Simple screen-to-world coordinate transform (NO Y-inversion)
 *
 * Inverse of worldToScreenSimple - converts screen coordinates back to world.
 * Use this for overlay systems and visibility checks where Y-axis inversion is NOT needed.
 *
 * @param point - Screen coordinates to convert
 * @param transform - Current view transform (scale, offsetX, offsetY)
 * @returns World coordinates (without Y-axis inversion)
 */
export function screenToWorldSimple(point: Point2D, transform: ViewTransform): Point2D {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale
  };
}

/**
 * 🏢 ADR-151: Transform bounding box from world to screen (NO Y-inversion)
 *
 * Converts all four corners of a bounding box from world to screen coordinates.
 * Use this for visibility checks and culling operations.
 *
 * @param bounds - World-space bounding box
 * @param transform - Current view transform (scale, offsetX, offsetY)
 * @returns Screen-space bounding box
 */
export function transformBoundsToScreen(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  transform: ViewTransform
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: bounds.minX * transform.scale + transform.offsetX,
    minY: bounds.minY * transform.scale + transform.offsetY,
    maxX: bounds.maxX * transform.scale + transform.offsetX,
    maxY: bounds.maxY * transform.scale + transform.offsetY
  };
}

/**
 * 🏢 ADR-151: Transform bounding box from screen to world (NO Y-inversion)
 *
 * Inverse of transformBoundsToScreen - converts screen bounds back to world.
 *
 * @param bounds - Screen-space bounding box
 * @param transform - Current view transform (scale, offsetX, offsetY)
 * @returns World-space bounding box
 */
export function transformBoundsToWorld(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  transform: ViewTransform
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: (bounds.minX - transform.offsetX) / transform.scale,
    minY: (bounds.minY - transform.offsetY) / transform.scale,
    maxX: (bounds.maxX - transform.offsetX) / transform.scale,
    maxY: (bounds.maxY - transform.offsetY) / transform.scale
  };
}

export const IDENTITY_COORDINATE_TRANSFORM = {
  worldToScreen: (point: Point2D): Point2D => point,
  screenToWorld: (point: Point2D): Point2D => point
} as const;
