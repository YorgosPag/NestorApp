/**
 * ADR-363 Phase 4.5c.6 — Column L/T Section-Profile Symbols (pure SSoT).
 *
 * Computes outline polygons for L-shape and T-shape cross-section profile
 * symbols drawn near a column entity in plan view (hover/selection only).
 * Mirrors the ADR-363 Phase 5.5h pattern (`bim/beams/beam-section-profile.ts`)
 * applied to column variants.
 *
 * Symbols communicate actual section shape (∟ for L-shape, ⊤ for T-shape)
 * per Revit/Tekla structural plan conventions. flipY reflects the mirror
 * handedness set by ADR-363 Phase 7.2 bim-mirror-geometry.
 *
 * Coordinate convention (LOCAL symbol space, centre = origin):
 *   ±X = horizontal, ±Y = vertical.
 *   Screen Y increases downward, so positive Y = screen-bottom of symbol.
 *   flipY=true negates all Y-coords → vertical mirror of the symbol.
 *
 * Usage (in ColumnRenderer):
 *   const outline = computeLProfileOutline();
 *   ctx.save();
 *   ctx.translate(cx, cy);  // symbol centre in screen space
 *   tracePath(ctx, outline);
 *   ctx.fill(); ctx.stroke();
 *   ctx.restore();
 *
 * All values in screen pixels. Zero dependencies (React / DOM / canvas / Firestore).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md § Phase 4.5c.6
 */

// ─── Symbol size constants (screen pixels) ────────────────────────────────────

/** L-shape symbol total width (X-axis). */
export const COL_L_SECTION_W_PX = 18;

/** L-shape symbol total height (Y-axis). */
export const COL_L_SECTION_H_PX = 18;

/** L-shape leg thickness (shared by both arms). */
export const COL_L_LEG_T_PX = 5;

/** T-shape symbol flange total width (X-axis). */
export const COL_T_FLANGE_W_PX = 20;

/** T-shape symbol total height (Y-axis). */
export const COL_T_TOTAL_H_PX = 20;

/** T-shape flange thickness (Y-axis portion). */
export const COL_T_FLANGE_T_PX = 5;

/** T-shape web width (X-axis). */
export const COL_T_WEB_W_PX = 5;

/** Offset from column bbox right-edge to symbol centre (px). */
export const COL_SECTION_OFFSET_PX = 12;

/** Minimum scale below which the symbol is suppressed (prevents pixel blur). */
export const COL_SECTION_MIN_SCALE = 0.06;

/** Minimum column screen footprint size (px) below which the symbol is suppressed. */
export const COL_SECTION_MIN_FOOTPRINT_PX = 14;

// ─── Visual style constants ────────────────────────────────────────────────────

/** Fill colour — semi-transparent violet (column brand tone, distinct from beam blue). */
export const COL_SECTION_FILL_COLOR = 'rgba(90, 50, 190, 0.18)';

/** Stroke colour — dark violet, high opacity for legibility. */
export const COL_SECTION_STROKE_COLOR = 'rgba(50, 20, 140, 0.82)';

/** Stroke line width (screen pixels). */
export const COL_SECTION_LINE_WIDTH_PX = 1.5;

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface SectionPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute the outline polygon of an L-shape cross-section profile symbol (∟).
 *
 * Returns 6 points in LOCAL symbol coords (centre = origin). Shape: bottom
 * horizontal flange (full width) + left vertical leg (lt wide). flipY=true
 * mirrors vertically so the flange moves to the top (follows
 * `ColumnLshapeParams.flipY` from ADR-363 Phase 7.2).
 *
 * Shape diagram (Y-down screen, flipY=false):
 *
 *   ┌────┐
 *   │ LT │← left leg (lt wide, full height h)
 *   │    │
 *   │    ├──────────────┐
 *   └────┴──────────────┘← bottom flange (full width w, lt tall)
 *
 * @param w     Total symbol width  (default: COL_L_SECTION_W_PX)
 * @param h     Total symbol height (default: COL_L_SECTION_H_PX)
 * @param lt    Leg thickness       (default: COL_L_LEG_T_PX)
 * @param flipY Mirror vertically   (default: false)
 */
export function computeLProfileOutline(
  w: number = COL_L_SECTION_W_PX,
  h: number = COL_L_SECTION_H_PX,
  lt: number = COL_L_LEG_T_PX,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  const hw = w / 2;
  const hh = h / 2;
  const ys = flipY ? -1 : 1;
  // 6 vertices CCW in math-space (= visually CW on screen due to Y-flip):
  // bottom-left → bottom-right → notch br → notch corner → leg top-right → top-left
  return [
    { x: -hw,      y: ys *  hh },        // v0 bottom-left
    { x:  hw,      y: ys *  hh },        // v1 bottom-right
    { x:  hw,      y: ys * (hh - lt) },  // v2 notch inner bottom-right
    { x: -hw + lt, y: ys * (hh - lt) },  // v3 notch inner corner
    { x: -hw + lt, y: ys * -hh },        // v4 top of inner-right edge of leg
    { x: -hw,      y: ys * -hh },        // v5 top-left
  ];
}

/**
 * Compute the outline polygon of a T-shape cross-section profile symbol (⊤).
 *
 * Returns 8 points in LOCAL symbol coords (centre = origin). Shape: top
 * horizontal flange (flangeW wide) + centre vertical web (webW wide, hangs
 * down). flipY=true mirrors vertically so the flange moves to the bottom
 * (follows `ColumnTshapeParams.flipY` from ADR-363 Phase 7.2).
 *
 * Shape diagram (Y-down screen, flipY=false):
 *
 *   ┌──────────────────┐← top flange (flangeW wide, flangeT tall)
 *   └───────┬──────┬───┘
 *           │ web  │← web (webW wide, hangs down)
 *           └──────┘
 *
 * @param flangeW  Flange total width  (default: COL_T_FLANGE_W_PX)
 * @param totalH   Total symbol height (default: COL_T_TOTAL_H_PX)
 * @param flangeT  Flange thickness    (default: COL_T_FLANGE_T_PX)
 * @param webW     Web width           (default: COL_T_WEB_W_PX)
 * @param flipY    Mirror vertically   (default: false)
 */
export function computeTProfileOutline(
  flangeW: number = COL_T_FLANGE_W_PX,
  totalH: number = COL_T_TOTAL_H_PX,
  flangeT: number = COL_T_FLANGE_T_PX,
  webW: number = COL_T_WEB_W_PX,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  const hfl = flangeW / 2;
  const hwb = webW / 2;
  const hh = totalH / 2;
  const ys = flipY ? -1 : 1;
  // 8 vertices: web-bottom → junction right → flange right → flange top →
  //             flange left → junction left → web-bottom (close)
  return [
    { x: -hwb,  y: ys *  hh },              // v0 web bottom-left
    { x:  hwb,  y: ys *  hh },              // v1 web bottom-right
    { x:  hwb,  y: ys * (-hh + flangeT) },  // v2 web-flange junction right
    { x:  hfl,  y: ys * (-hh + flangeT) },  // v3 flange inner-right
    { x:  hfl,  y: ys * -hh },              // v4 flange top-right
    { x: -hfl,  y: ys * -hh },              // v5 flange top-left
    { x: -hfl,  y: ys * (-hh + flangeT) },  // v6 flange inner-left
    { x: -hwb,  y: ys * (-hh + flangeT) },  // v7 web-flange junction left
  ];
}
