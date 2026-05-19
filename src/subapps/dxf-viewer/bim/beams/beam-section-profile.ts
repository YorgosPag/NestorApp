/**
 * ADR-363 Phase 5.5h — Steel I/H Section-Profile Symbol (pure SSoT).
 *
 * Computes the outline polyline for a standard I/H cross-section profile symbol
 * to be drawn near a steel beam entity in plan view. The symbol communicates
 * the actual cross-section shape (flanges + web) in the Revit/Tekla convention:
 * shown on hover or selection, positioned at beam midpoint offset perpendicularly.
 *
 * Coordinate convention (LOCAL symbol space, before ctx rotation):
 *   - ±X  = flange direction (perpendicular to beam axis after `rotate(angle+PI/2)`)
 *   - ±Y  = depth/web direction (parallel to beam axis after rotation)
 * After `ctx.rotate(screenAngle + Math.PI/2)` the flanges align perpendicular
 * to the beam on screen — Revit/Tekla convention for structural plan symbols.
 *
 * Usage (in BeamRenderer):
 *   const outline = computeIProfileOutline(w, h, webW, flangeT);
 *   ctx.save();
 *   ctx.translate(cx, cy);
 *   ctx.rotate(screenAngle + Math.PI / 2);
 *   tracePath(ctx, outline);
 *   ctx.fill(); ctx.stroke();
 *   ctx.restore();
 *
 * All values in screen pixels. Zero dependencies (React / DOM / canvas / Firestore).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md § Phase 5.5h
 */

// ─── Symbol size constants (screen pixels) ───────────────────────────────────

/** Total flange width (X-axis, perpendicular to beam after rotation). */
export const SECTION_PROFILE_W_PX = 20;

/** Total symbol height (Y-axis, parallel to beam after rotation = represents depth). */
export const SECTION_PROFILE_H_PX = 26;

/** Web width (X-axis). ~20% of flange width → 4 px. */
export const SECTION_WEB_W_PX = 4;

/** Flange thickness (Y-axis). ~15% of total height → 4 px. */
export const SECTION_FLANGE_T_PX = 4;

/** Perpendicular offset from beam outer edge to symbol centre (px). */
export const SECTION_OFFSET_PX = 12;

/** Minimum scale below which the symbol is suppressed (prevents pixel blur). */
export const SECTION_MIN_SCALE = 0.08;

/** Minimum beam screen length below which the symbol is suppressed. */
export const SECTION_MIN_BEAM_LEN_PX = 24;

// ─── Visual style constants ───────────────────────────────────────────────────

/** Fill colour — semi-transparent steel blue. */
export const SECTION_FILL_COLOR = 'rgba(60, 100, 200, 0.18)';

/** Stroke colour — dark steel blue, high opacity for legibility. */
export const SECTION_STROKE_COLOR = 'rgba(30, 60, 160, 0.82)';

/** Stroke line width (screen pixels). */
export const SECTION_LINE_WIDTH_PX = 1.5;

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface SectionPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute the outline polygon of an I/H cross-section profile symbol.
 *
 * Returns a closed CCW polygon in LOCAL symbol coords (centre = origin).
 * The caller applies `ctx.rotate(screenAngle + Math.PI/2)` so that flanges
 * become perpendicular to the beam direction in screen space.
 *
 * Shape (local coords, Y-up convention for clarity):
 *
 *   ┌──────────────── W ─────────────────┐
 *   │          top flange (ft thick)      │  y = +H/2  .. +H/2-ft
 *   └─────────┬──── ww ────┬─────────────┘
 *             │    web     │              (ww = WEB_W_PX)
 *   ┌─────────┴────────────┴─────────────┐
 *   │          bottom flange             │  y = -H/2+ft .. -H/2
 *   └────────────────────────────────────┘
 *
 * @param w   Total flange width (default: SECTION_PROFILE_W_PX)
 * @param h   Total symbol height (default: SECTION_PROFILE_H_PX)
 * @param ww  Web width (default: SECTION_WEB_W_PX)
 * @param ft  Flange thickness (default: SECTION_FLANGE_T_PX)
 */
export function computeIProfileOutline(
  w: number = SECTION_PROFILE_W_PX,
  h: number = SECTION_PROFILE_H_PX,
  ww: number = SECTION_WEB_W_PX,
  ft: number = SECTION_FLANGE_T_PX,
): ReadonlyArray<SectionPoint> {
  const hw = w / 2;  // half flange width
  const hh = h / 2;  // half total height
  const hww = ww / 2; // half web width

  return [
    // Top flange — top-left, go clockwise
    { x: -hw, y:  hh },
    { x:  hw, y:  hh },
    { x:  hw, y:  hh - ft },
    { x:  hww, y: hh - ft },
    // Web — right side going down
    { x:  hww, y: -hh + ft },
    // Bottom flange — right side
    { x:  hw, y: -hh + ft },
    { x:  hw, y: -hh },
    { x: -hw, y: -hh },
    { x: -hw, y: -hh + ft },
    { x: -hww, y: -hh + ft },
    // Web — left side going up
    { x: -hww, y:  hh - ft },
    // Back to top flange left
    { x: -hw, y:  hh - ft },
  ];
}
