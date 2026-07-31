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
import { getCachedClientRect } from './pointer-rect-cache';
// 🔑 SSoT — «πού είναι η περιοχή σχεδίασης». Η αρχή του κόσμου κάθεται στην ΚΑΤΩ-ΑΡΙΣΤΕΡΗ
// γωνία της, οπότε η άγκυρα του μετασχηματισμού ΕΙΝΑΙ αυτό το ορθογώνιο (βλ. ./drawing-area.ts).
import { DRAWING_AREA_CHROME, getDrawingAreaRect } from './drawing-area';
// ADR-726 Φ5 build fix (2026-07-30): ΚΑΝΕΝΑ import από systems/cursor εδώ. Αυτό το αρχείο
// φτάνει σε SERVER API routes (route.ts → dxf-scene-builder → … → bounds-operations) και
// κάθε React-hook import στο γράφημα σπάει το production build. Το client-only helper
// `screenToWorldCached` ζει στο ./screen-to-world-cached.

const logger = createModuleLogger('CoordinateTransforms');

// ⚠️ ΔΕΝ είναι πια πηγή — είναι **προβολή** του `DRAWING_AREA_CHROME` (./drawing-area.ts), που
// είναι το SSoT. Μένει εξαγόμενο μόνο για τους ~10 υπάρχοντες καταναλωτές· **μη γράψεις νέο**.
//
// 🔑 Το `MARGINS.top` ΕΙΝΑΙ το ύψος του ΚΑΤΩ χάρακα, με ιστορικά λάθος όνομα: ο τύπος
// `screenY = (height − top)` τοποθετεί το `worldY = 0` στο `height − 30`, δηλαδή στην άνω ακμή
// της ζώνης του κάτω χάρακα. Γι' αυτό τρέφεται από το `bottomRulerHeight` — ίδια τιμή, τώρα
// με ειλικρινή προέλευση. Το λάθος όνομα ήταν η ρίζα των δύο ασύνδετων στρατοπέδων ανάγνωσης.
export const COORDINATE_LAYOUT = {
  RULER_LEFT_WIDTH: DRAWING_AREA_CHROME.leftRulerWidth,
  RULER_TOP_HEIGHT: DRAWING_AREA_CHROME.bottomRulerHeight,
  MARGINS: {
    left: DRAWING_AREA_CHROME.leftRulerWidth,
    /** @deprecated Λάθος όνομα — είναι το ύψος του ΚΑΤΩ χάρακα. Χρησιμοποίησε `getDrawingAreaRect().bottom`. */
    top: DRAWING_AREA_CHROME.bottomRulerHeight,
    right: 0,   // Δεν υπάρχει δεξιός χάρακας
    bottom: DRAWING_AREA_CHROME.bottomRulerHeight
  }
} as const;

// Legacy exports for compatibility
export const MARGINS = COORDINATE_LAYOUT.MARGINS;

export class CoordinateTransforms {
  /**
   * SSoT viewport-readiness classifier (shared by worldToScreen + screenToWorld).
   *
   * - `ready`     → dimensions are positive, use the real Y-inverted formula.
   * - `transient` → width/height is exactly 0. This is the EXPECTED state before the
   *                 canvas is laid out (first paint, hidden tab, sidebar/panel toggle).
   *                 It must stay SILENT — logging here floods the console at 60fps with
   *                 "Invalid viewport dimensions {0,0}" (the noise Giorgio flagged).
   * - `malformed` → missing, negative, or NaN. A genuine bug worth a single warn.
   *
   * Both states still fall back to the non-inverted conversion; only the logging differs.
   */
  private static classifyViewport(
    viewport: Viewport | undefined | null
  ): 'ready' | 'transient' | 'malformed' {
    if (!viewport) return 'malformed';
    const { width, height } = viewport;
    if (Number.isNaN(width) || Number.isNaN(height) || width < 0 || height < 0) {
      return 'malformed';
    }
    if (width === 0 || height === 0) return 'transient';
    return 'ready';
  }

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
    // Άγκυρα = η κάτω-αριστερή γωνία της περιοχής σχεδίασης (SSoT ./drawing-area.ts).
    const { leftRulerWidth: left, bottomRulerHeight: bottom } = DRAWING_AREA_CHROME;
    if (!worldPoint) {
      logger.warn('worldToScreen received undefined point. Returning (0,0)');
      return { x: left, y: viewport?.height ? viewport.height - bottom : bottom };
    }

    // 🏢 ENTERPRISE FIX (2026-01-27): Viewport validation
    // Αν το viewport δεν είναι έτοιμο, χρησιμοποιεί fallback υπολογισμό.
    // 0×0 = αναμενόμενο πριν το layout → σιωπηλό. Μόνο malformed → warn.
    const worldViewportState = CoordinateTransforms.classifyViewport(viewport);
    if (worldViewportState !== 'ready') {
      if (worldViewportState === 'malformed') {
        logger.warn('worldToScreen: malformed viewport dimensions', { viewport });
      }
      // Fallback: Use simple conversion without Y-inversion
      return {
        x: left + worldPoint.x * transform.scale + transform.offsetX,
        y: bottom + worldPoint.y * transform.scale + transform.offsetY
      };
    }

    // 🎯 CRITICAL: offsetX/offsetY are SCREEN OFFSETS (pixels)
    // Formula: screenX = area.x      + worldX * scale + offsetX
    //          screenY = area.bottom - worldY * scale - offsetY
    // Δηλαδή το world (0,0) κάθεται στην ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία της περιοχής σχεδίασης.
    // Note: offsetY is SUBTRACTED because positive offset moves drawing UP (decreases screenY)
    const area = getDrawingAreaRect(viewport);
    return {
      x: area.x + worldPoint.x * transform.scale + transform.offsetX,
      y: area.bottom - worldPoint.y * transform.scale - transform.offsetY
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
    // Άγκυρα = η κάτω-αριστερή γωνία της περιοχής σχεδίασης (SSoT ./drawing-area.ts).
    const { leftRulerWidth: left, bottomRulerHeight: bottom } = DRAWING_AREA_CHROME;
    if (!screenPoint) {
      logger.warn('screenToWorld received undefined point. Returning origin offset');
      return { x: -transform.offsetX / transform.scale, y: -transform.offsetY / transform.scale };
    }

    // 🏢 ENTERPRISE FIX (2026-01-27): Viewport validation
    // Αν το viewport δεν είναι έτοιμο (width ή height = 0), επιστρέφει fallback.
    // 0×0 = αναμενόμενο πριν το layout stabilize → σιωπηλό. Μόνο malformed → warn.
    const screenViewportState = CoordinateTransforms.classifyViewport(viewport);
    if (screenViewportState !== 'ready') {
      if (screenViewportState === 'malformed') {
        logger.warn('screenToWorld: malformed viewport dimensions', { viewport });
      }
      // Fallback: Use screen position as world position (1:1 mapping)
      // This is better than returning wildly incorrect values
      return {
        x: (screenPoint.x - left - transform.offsetX) / transform.scale,
        y: (screenPoint.y - bottom - transform.offsetY) / transform.scale
      };
    }

    // 🎯 CRITICAL: offsetX/offsetY are SCREEN OFFSETS (pixels)
    // Formula: worldX = (screenX - area.x - offsetX) / scale
    //          worldY = (area.bottom - screenY - offsetY) / scale
    // Note: offsetY is SUBTRACTED (inverse of worldToScreen where it's subtracted)
    const area = getDrawingAreaRect(viewport);
    return {
      x: (screenPoint.x - area.x - transform.offsetX) / transform.scale,
      y: (area.bottom - screenPoint.y - transform.offsetY) / transform.scale
    };
  }

  /**
   * Υπολογισμός νέου transform για zoom
   *
   * 🏢 ENTERPRISE FIX (2025-10-04): Zoom-to-Cursor με Margins Adjustment
   *
   * Το πρόβλημα: Το zoomCenter είναι canvas-relative (0,0 = top-left του canvas),
   * αλλά το world (0,0) εμφανίζεται στην ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία της περιοχής σχεδίασης.
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
    const area = getDrawingAreaRect(viewport);

    // 🏢 X-axis: Απλή αφαίρεση margin (screen X αυξάνει προς τα δεξιά)
    // Formula: screenX = area.x + worldX * scale + offsetX
    // Άρα: adjustedX = screenX - area.x = worldX * scale + offsetX
    const adjustedCenterX = zoomCenter.x - area.x;

    // 🏢 Y-axis: INVERTED! (screen Y αυξάνει προς τα κάτω, world Y προς τα πάνω)
    // Formula: screenY = area.bottom - worldY * scale - offsetY
    // Άρα: adjustedY = area.bottom - screenY = worldY * scale + offsetY
    // 🐛 FIX (2026-01-25): Ήταν λάθος: zoomCenter.y - top (δεν λάμβανε υπόψη Y-inversion)
    const adjustedCenterY = area.bottom - zoomCenter.y;

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
 * - rect is served from `getCachedClientRect` (ADR-040 cursor-lag Φ5): the cache
 *   re-reads getBoundingClientRect ONLY on resize / scroll / mousedown, so the
 *   high-frequency mousemove path no longer forces a sync reflow per event.
 *
 * @param element - The event target element (typically e.currentTarget)
 * @returns PointerSnapshot with rect and viewport, or null if invalid
 */
export function getPointerSnapshotFromElement(element: HTMLElement | null): PointerSnapshot | null {
  if (!element) {
    // 🏢 ENTERPRISE: Silent fail in production, no console spam
    return null;
  }

  // ADR-040 cursor-lag Φ5: cached rect (re-read only on resize/scroll/mousedown)
  // instead of a forced reflow on every mousemove.
  const rect = getCachedClientRect(element);

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

// `screenToWorldCached` (ADR-583 de-dup, ADR-040 Phase XXII.B) μετακόμισε στο
// ./screen-to-world-cached — client-only, διαβάζει το live ImmediateTransformStore.

// ============================================================================
// 🏢 ADR-151: SIMPLE COORDINATE TRANSFORM FUNCTIONS (Standalone Exports)
// ============================================================================
// Extracted to ./coordinate-transforms-simple for the Google SRP 500-line
// limit. Re-exported here so existing deep imports keep resolving.
// ============================================================================
export {
  worldToScreenSimple,
  screenToWorldSimple,
  transformBoundsToScreen,
  transformBoundsToWorld,
  IDENTITY_COORDINATE_TRANSFORM,
} from './coordinate-transforms-simple';
