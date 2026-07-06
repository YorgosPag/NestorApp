/**
 * 🏢 ADR-137: Centralized Snap Icon Geometry
 * Single Source of Truth για snap indicator dimensions
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-137-snap-icon-geometry
 * @see canvas-v2/overlays/SnapIndicatorGlyph.tsx - the ONE snap-glyph renderer (SVG, shared 2D+3D per ADR-542)
 *
 * HISTORY: originally there were TWO renderers (SVG overlay + a Canvas path-based
 * `SnapRenderer`) with drifting constants (tangent ratio 0.5 vs 0.6, grid dot 3px vs 2px).
 * The canvas `SnapRenderer`/`LegacySnapAdapter` were DELETED (ADR-137 §Step 2) — this
 * geometry SSoT now feeds a single SVG glyph, so those inconsistencies cannot reappear.
 */

// 🏢 ADR-133: Re-export stroke width for convenience
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

/**
 * 🔺 SNAP ICON GEOMETRY CONSTANTS
 * Industry-standard snap indicator dimensions (AutoCAD/MicroStation compatible)
 */
export const SNAP_ICON_GEOMETRY = {
  // ═══════════════════════════════════════════════════════════════════════
  // BASE SIZE
  // ═══════════════════════════════════════════════════════════════════════

  /** Base size in pixels - CAD standard */
  SIZE: 12,

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED DIMENSION RATIOS
  // ═══════════════════════════════════════════════════════════════════════

  /** Half ratio: SIZE * 0.5 = 6 pixels */
  HALF_RATIO: 0.5,

  /** Quarter ratio: SIZE * 0.25 = 3 pixels (for perpendicular, parallel) */
  QUARTER_RATIO: 0.25,

  // ═══════════════════════════════════════════════════════════════════════
  // SHAPE-SPECIFIC RATIOS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Tangent inner circle ratio (relative to half size)
   * UNIFIED: Was 0.5 (SnapIndicatorOverlay) vs 0.6 (SnapRenderer)
   * Decision: 0.5 is mathematically cleaner and matches AutoCAD standard
   */
  TANGENT_CIRCLE_RATIO: 0.5,

  /**
   * Grid snap dot radius in pixels
   * UNIFIED: Was 3px (SnapIndicatorOverlay) vs 2px (SnapRenderer)
   * Decision: 3px for better visibility
   */
  GRID_DOT_RADIUS: 3,

  /** Node/insertion center dot radius in pixels */
  NODE_DOT_RADIUS: 2,

  // ═══════════════════════════════════════════════════════════════════════
  // STROKE SETTINGS (RE-EXPORT FROM PANEL_LAYOUT)
  // ═══════════════════════════════════════════════════════════════════════

  /** Standard stroke width for snap indicators (from ADR-133) */
  get STROKE_WIDTH(): number {
    return PANEL_LAYOUT.SVG_ICON.STROKE_WIDTH.STANDARD;
  }
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// PER-TYPE SIZE OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-snap-type box size (px) override. Most snap glyphs use the base `SIZE` (12);
 * a few read too small at that box and get bumped here. SSoT — `getSnapIconSize`
 * is the ONLY reader (both `SnapShape` and the overlay's centering offset go
 * through it), so the glyph never renders off-centre.
 *
 * DIMENSION glyphs (`dim_line` = ⊢───⊣ witness line, `dim_def_point` = ⊡ def
 * point) are enlarged because the thin dim-line iconography is hard to read next
 * to the full-box endpoint square at 12px (Giorgio 2026-07-07). Keyed by the
 * lower-cased snap type (matches `SnapShape`'s `type.toLowerCase()` switch).
 */
export const SNAP_ICON_SIZE_BY_TYPE: Readonly<Record<string, number>> = {
  dim_line: 18,
  dim_def_point: 18,
};

/**
 * Box size (px) for a snap glyph of `type` — the per-type override if one exists,
 * else the base `SIZE`. `undefined`/unknown type → base size.
 */
export function getSnapIconSize(type?: string): number {
  const key = type?.toLowerCase();
  return (key && SNAP_ICON_SIZE_BY_TYPE[key]) || SNAP_ICON_GEOMETRY.SIZE;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate half size from base size
 * @param size - Base size (defaults to SNAP_ICON_GEOMETRY.SIZE)
 * @returns Half size value
 */
export function getSnapIconHalf(size: number = SNAP_ICON_GEOMETRY.SIZE): number {
  return size * SNAP_ICON_GEOMETRY.HALF_RATIO;
}

/**
 * Calculate quarter size from base size
 * Used for perpendicular and parallel snap indicators
 * @param size - Base size (defaults to SNAP_ICON_GEOMETRY.SIZE)
 * @returns Quarter size value
 */
export function getSnapIconQuarter(size: number = SNAP_ICON_GEOMETRY.SIZE): number {
  return size * SNAP_ICON_GEOMETRY.QUARTER_RATIO;
}

/**
 * Calculate tangent inner circle radius
 * @param halfSize - Half of the icon size
 * @returns Tangent circle radius
 */
export function getTangentCircleRadius(halfSize: number): number {
  return halfSize * SNAP_ICON_GEOMETRY.TANGENT_CIRCLE_RATIO;
}

/**
 * Get grid dot radius (fixed size, not relative)
 * @returns Grid dot radius in pixels
 */
export function getGridDotRadius(): number {
  return SNAP_ICON_GEOMETRY.GRID_DOT_RADIUS;
}

/**
 * Get node/insertion center dot radius
 * @returns Node dot radius in pixels
 */
export function getNodeDotRadius(): number {
  return SNAP_ICON_GEOMETRY.NODE_DOT_RADIUS;
}
