/**
 * ZOOM SYSTEM - CALCULATIONS
 * Μαθηματικές πράξεις για zoom operations
 */

import type { Point2D, ViewTransform } from '../../../rendering/types/Types';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας αντί για διπλότυπη fit logic
import { FitToViewService } from '../../../services/FitToViewService';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
// 🏢 ENTERPRISE: Use centralized constants
import {
  ZOOM_FACTORS,
  TRANSFORM_SCALE_LIMITS,
  FIT_TO_VIEW_DEFAULTS,
  clampScale as centralizedClampScale
} from '../../../config/transform-config';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-089: Centralized Point-In-Bounds
import { SpatialUtils } from '../../../core/spatial/SpatialUtils';

// === WHEEL ZOOM (AutoCAD-parity exponential, magnitude-aware) ===

/**
 * AutoCAD-parity wheel-zoom factor (exponential, magnitude-aware — Google Maps / Figma model).
 *
 * `factor = exp(-deltaY × sensitivity)`. Όσο πιο δυνατά/γρήγορα το ροδάκι, τόσο μεγαλύτερο βήμα·
 * συμμετρικό (in × out = 1). Αντικαθιστά το σταθερό 10% που έκανε το zoom να νιώθει αργό έναντι AutoCAD.
 *
 * @param deltaY - normalized wheel delta σε pixels (sign: <0 → zoom IN, >0 → zoom OUT)
 * @param ctrlKey - Ctrl πατημένο → 2× sensitivity
 * @returns scale multiplier (`newScale = currentScale × factor`)
 */
export function computeWheelZoomFactor(deltaY: number, ctrlKey: boolean = false): number {
  const sensitivity = ctrlKey ? ZOOM_FACTORS.CTRL_WHEEL_SENSITIVITY : ZOOM_FACTORS.WHEEL_SENSITIVITY;
  const clamped = clamp(deltaY, -ZOOM_FACTORS.WHEEL_MAX_DELTA, ZOOM_FACTORS.WHEEL_MAX_DELTA);
  return Math.exp(-clamped * sensitivity);
}

/**
 * Inverse of {@link computeWheelZoomFactor}: the wheel `deltaY` that yields exactly `factor`.
 *
 * Επιτρέπει στους factor-based callers (κουμπιά zoom μέσω `zoomAtScreenPoint`, π.χ. BUTTON_IN = 1.2)
 * να περνούν από τον ΕΝΑ wheel-zoom δρόμο και να τιμούν τον ΑΚΡΙΒΗ factor τους, αντί για ένα ψεύτικο
 * ±120 που το παλιό sign-based `wheelZoom` αγνοούσε (latent bug: κουμπιά έκαναν 10% αντί 20%).
 *
 * @param factor - επιθυμητός scale multiplier (>0)
 * @param ctrlKey - πρέπει να ταιριάζει με το sensitivity που θα χρησιμοποιηθεί στην κατανάλωση
 */
export function wheelDeltaForFactor(factor: number, ctrlKey: boolean = false): number {
  const sensitivity = ctrlKey ? ZOOM_FACTORS.CTRL_WHEEL_SENSITIVITY : ZOOM_FACTORS.WHEEL_SENSITIVITY;
  return -Math.log(factor) / sensitivity;
}

// === TRANSFORM CALCULATIONS ===

/**
 * ❌ REMOVED: calculateZoomTransform
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-10-04):
 * This duplicate function has been removed. Use the centralized version instead:
 *
 * @see CoordinateTransforms.calculateZoomTransform() - Single source of truth for zoom calculations
 * @location src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts:79
 *
 * Migration:
 * - Old: calculateZoomTransform(transform, newScale, center, viewport)
 * - New: CoordinateTransforms.calculateZoomTransform(transform, zoomFactor, center, viewport)
 * - Note: zoomFactor = newScale / currentScale
 */

/**
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Υπολογισμός fit-to-bounds transform - WRAPPER για κεντρική υπηρεσία
 * 🔥 ΔΙΠΛΟΤΥΠΟ ΑΦΑΙΡΕΘΗΚΕ: Αντικαταστάθηκε με FitToViewService
 *
 * 🏢 ENTERPRISE FIX (2026-01-26): Returns null instead of default transform on failure
 * This prevents DxfCanvas from detecting "default transform" and triggering unwanted initial transform
 * which causes canvas to "jump" during measurement tool usage
 */
export function calculateFitTransform(
  bounds: { min: Point2D; max: Point2D },
  viewport: { width: number; height: number },
  padding: number = ZOOM_FACTORS.FIT_PADDING,
  maxScale: number = TRANSFORM_SCALE_LIMITS.MAX_SCALE,
  minScale: number = TRANSFORM_SCALE_LIMITS.MIN_SCALE,
  alignToOrigin: boolean = false
): ViewTransform | null {
  // 🛡️ GUARD: Validate viewport before calculations
  // 🏢 ADR-161: Use Number.isFinite() for strict type checking (no coercion)
  if (!viewport || viewport.width <= 0 || viewport.height <= 0 || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    console.error('🚨 calculateFitTransform: Invalid viewport!');
    return null; // 🏢 FIX: Return null instead of default transform
  }

  // 🏢 FIX (2026-01-04): Use centralized padding from FIT_TO_VIEW_DEFAULTS
  // Previous formula created excessive padding for small viewports (25% for 800px)
  // Now uses consistent 10% padding regardless of viewport size
  const paddingPercentage = FIT_TO_VIEW_DEFAULTS.PADDING_PERCENTAGE;

  // 🏢 ADR-161: Use Number.isFinite() for strict type checking (no coercion)
  if (!Number.isFinite(paddingPercentage)) {
    console.error('🚨 calculateFitTransform: Invalid paddingPercentage!');
    return null; // 🏢 FIX: Return null instead of default transform
  }

  const result = FitToViewService.calculateFitToViewFromBounds(
    bounds,
    viewport,
    {
      padding: paddingPercentage,
      maxScale,
      minScale,
      alignToOrigin
    }
  );

  if (result.success && result.transform) {
    return result.transform;
  }

  // 🏢 ENTERPRISE FIX (2026-01-26): Return null on failure instead of default transform
  // Returning default {scale:1, offsetX:0, offsetY:0} caused DxfCanvas to trigger initial transform
  // which moved the canvas during measurement tool usage
  // 🏢 ENTERPRISE (2026-01-26): Silent return - missing bounds is normal state (no DXF loaded)
  return null;
}

/**
 * Υπολογισμός bounds normalization (bottom-left to origin)
 * 🏢 ENTERPRISE: Uses centralized ZOOM_FACTORS.FIT_PADDING as default
 * 🏢 ENTERPRISE FIX (2026-01-26): Returns null if fit calculation fails
 */
export function calculateNormalizedTransform(
  bounds: { min: Point2D; max: Point2D },
  viewport: { width: number; height: number },
  padding: number = ZOOM_FACTORS.FIT_PADDING
): ViewTransform | null {
  const fitTransform = calculateFitTransform(bounds, viewport, padding);

  // 🏢 ENTERPRISE FIX (2026-01-26): Return null if fit calculation failed
  if (fitTransform === null) {
    return null;
  }

  // Additional offset to move bottom-left corner to origin
  const offsetX = -bounds.min.x * fitTransform.scale + padding;
  const offsetY = -bounds.min.y * fitTransform.scale + padding;

  return {
    scale: fitTransform.scale,
    offsetX,
    offsetY
  };
}

// === COORDINATE CONVERSIONS ===

// ✅ ΔΙΠΛΟΤΥΠΟ ΑΦΑΙΡΕΘΗΚΕ: Χρήση κεντρικής CoordinateTransforms για συνέπεια
// 🚨 REMOVED: Local screenToWorld function - ασυνεπής με margins
// Use CoordinateTransforms.screenToWorld() instead for consistency

// Removed duplicate worldToScreen function - use CoordinateTransforms.worldToScreen() instead

// === BOUNDS CALCULATIONS ===

/**
 * Υπολογισμός visible world bounds
 * ✅ FIXED: Χρήση κεντρικής CoordinateTransforms για συνέπεια με margins
 */
export function getVisibleBounds(
  transform: ViewTransform,
  viewport: { width: number; height: number }
): { min: Point2D; max: Point2D } {
  const topLeft = CoordinateTransforms.screenToWorld({ x: 0, y: 0 }, transform, viewport);
  const bottomRight = CoordinateTransforms.screenToWorld(
    { x: viewport.width, y: viewport.height },
    transform,
    viewport
  );

  return {
    min: { x: topLeft.x, y: topLeft.y },
    max: { x: bottomRight.x, y: bottomRight.y }
  };
}

/**
 * Έλεγχος αν point είναι εντός bounds
 * 🏢 ADR-089: Wrapper για SpatialUtils.pointInRect() - Single Source of Truth
 * @deprecated Prefer using SpatialUtils.pointInRect() directly for new code
 */
export function isPointInBounds(
  point: Point2D,
  bounds: { min: Point2D; max: Point2D }
): boolean {
  return SpatialUtils.pointInRect(point, bounds);
}

/**
 * Υπολογισμός bounds union (combine multiple bounds)
 */
export function unionBounds(
  bounds1: { min: Point2D; max: Point2D },
  bounds2: { min: Point2D; max: Point2D }
): { min: Point2D; max: Point2D } {
  return {
    min: {
      x: Math.min(bounds1.min.x, bounds2.min.x),
      y: Math.min(bounds1.min.y, bounds2.min.y)
    },
    max: {
      x: Math.max(bounds1.max.x, bounds2.max.x),
      y: Math.max(bounds1.max.y, bounds2.max.y)
    }
  };
}

// === SCALE UTILITIES ===
// 🏢 CENTRALIZED: Re-export from transform-config for backward compatibility

/**
 * Clamp scale within limits
 * 🏢 CENTRALIZED: Re-export from transform-config.ts - Single source of truth
 * @see config/transform-config.ts - clampScale function
 */
export const clampScale = centralizedClampScale;

/**
 * Υπολογισμός επόμενου zoom level
 */
export function getNextZoomLevel(
  currentScale: number,
  direction: 'in' | 'out',
  factor: number,
  minScale: number,
  maxScale: number
): number {
  const newScale = direction === 'in'
    ? currentScale * factor
    : currentScale / factor;

  return clamp(newScale, minScale, maxScale);
}

// === DISTANCE & GEOMETRY ===

/**
 * Υπολογισμός απόστασης μεταξύ δύο σημείων
 * ✅ CENTRALIZED: Re-export από centralized location
 */
export { calculateDistance as distance } from '../../../rendering/entities/shared/geometry-rendering-utils';

/**
 * Υπολογισμός center point από bounds
 * ✅ CENTRALIZED: Re-export από bounds.ts
 */
export { getBoundsCenter } from './bounds';

/**
 * Υπολογισμός viewport center
 */
export function getViewportCenter(viewport: { width: number; height: number }): Point2D {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2
  };
}