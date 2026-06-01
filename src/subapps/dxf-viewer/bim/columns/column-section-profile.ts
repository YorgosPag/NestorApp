/**
 * ADR-363 Phase 4.5c.6 / Phase 8 — Column Section-Profile Symbols (pure SSoT).
 *
 * Computes outline polygons for cross-section profile symbols drawn near a
 * column entity in plan view (hover/selection only). Mirrors the ADR-363
 * Phase 5.5h pattern (`bim/beams/beam-section-profile.ts`) applied to column
 * variants.
 *
 * Symbols communicate actual section shape per Revit/Tekla structural plan
 * conventions:
 *   - ∟ (L-shape)         — Phase 4.5c.6
 *   - ⊤ (T-shape)         — Phase 4.5c.6
 *   - ⬡ (polygon, N=3..12) — Phase 8
 *   - ▬ (shear-wall)      — Phase 8 (μακρόστενη)
 *   - Ι (I-shape, double-T) — Phase 8
 *
 * flipY reflects the mirror handedness set by ADR-363 Phase 7.2
 * bim-mirror-geometry.
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

// ─── ADR-363 Phase 8 — polygon / shear-wall / I-shape symbol sizes ─────────

/** Polygon symbol circumscribed Ø (px). Matches L/T extent. */
export const COL_POLYGON_D_PX = 18;

/** Shear-wall symbol total length (X-axis, μακρόστενο). */
export const COL_SHEAR_WALL_LEN_PX = 24;

/** Shear-wall symbol thickness (Y-axis). 4:1 aspect για visual wall hint. */
export const COL_SHEAR_WALL_THK_PX = 6;

/** I-shape symbol flange total width (X-axis). */
export const COL_I_FLANGE_W_PX = 18;

/** I-shape symbol total section depth (Y-axis). */
export const COL_I_TOTAL_H_PX = 20;

/** I-shape flange thickness (Y-axis portion of each flange). */
export const COL_I_FLANGE_T_PX = 4;

/** I-shape web width (X-axis). */
export const COL_I_WEB_W_PX = 4;

// ─── ADR-363 Phase 2b — U-shape (Π) / polygon-backed symbol sizes ──────────

/** U-shape (Π) symbol total width (X-axis). */
export const COL_U_SECTION_W_PX = 18;

/** U-shape (Π) symbol total height (Y-axis). */
export const COL_U_SECTION_H_PX = 18;

/** U-shape (Π) leg thickness (each vertical leg). */
export const COL_U_LEG_T_PX = 5;

/** U-shape (Π) base thickness (bottom flange). */
export const COL_U_BASE_T_PX = 5;

/** Polygon-backed (composite / από-περίγραμμα U) symbol target box (px). */
export const COL_POLY_BACKED_BOX_PX = 18;

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

// ─── ADR-363 Phase 8 — polygon / shear-wall / I-shape outlines ─────────────

/**
 * Compute the outline polygon of a regular N-gon section symbol (⬡).
 *
 * Returns N points in LOCAL symbol coords (centre = origin), CCW math-frame.
 * Vertex 0 points up (math +Y, screen −Y due to Y-down) per AutoCAD/Revit
 * polygon default (vertex-up for odd, flat-bottom emergent for even due to
 * symmetry).
 *
 * @param d      Circumscribed diameter (default COL_POLYGON_D_PX)
 * @param sides  Number of sides (clamped to [3, 12])
 * @param flipY  Mirror vertically (parity-only, polygon is point-symmetric)
 */
export function computePolygonOutline(
  d: number = COL_POLYGON_D_PX,
  sides = 6,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  const r = d / 2;
  const n = Math.max(3, Math.min(12, Math.round(sides)));
  const ys = flipY ? -1 : 1;
  const verts: SectionPoint[] = [];
  const step = (2 * Math.PI) / n;
  const startAngle = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    // Screen-space: math +Y → screen −Y, so negate sin output before ys.
    verts.push({ x: r * Math.cos(a), y: ys * -r * Math.sin(a) });
  }
  return verts;
}

/**
 * Compute the outline polygon of a shear-wall section symbol (▬).
 *
 * Returns 4 CCW vertices in LOCAL symbol coords (centre = origin). Plain
 * rectangle with 4:1 aspect for visual "wall" hint.
 *
 * @param length     Symbol total length  (X-axis, default COL_SHEAR_WALL_LEN_PX)
 * @param thickness  Symbol total thickness (Y-axis, default COL_SHEAR_WALL_THK_PX)
 * @param flipY      Mirror vertically (parity-only)
 */
export function computeShearWallOutline(
  length: number = COL_SHEAR_WALL_LEN_PX,
  thickness: number = COL_SHEAR_WALL_THK_PX,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  const hl = length / 2;
  const ht = thickness / 2;
  const ys = flipY ? -1 : 1;
  return [
    { x: -hl, y: ys *  ht },  // v0 bottom-left
    { x:  hl, y: ys *  ht },  // v1 bottom-right
    { x:  hl, y: ys * -ht },  // v2 top-right
    { x: -hl, y: ys * -ht },  // v3 top-left
  ];
}

/**
 * Compute the outline polygon of an I-shape (double-T) section symbol (Ι).
 *
 * Returns 12 points in LOCAL symbol coords (centre = origin) tracing the
 * outer outline of a steel IPE/HEA profile. Both flanges visible (top + bottom).
 *
 * @param b       Flange total width (X-axis, default COL_I_FLANGE_W_PX)
 * @param h       Total section depth (Y-axis, default COL_I_TOTAL_H_PX)
 * @param tf      Flange thickness (default COL_I_FLANGE_T_PX)
 * @param tw      Web width (default COL_I_WEB_W_PX)
 * @param flipY   Mirror vertically (parity-only, I is symmetric)
 */
export function computeIProfileOutline(
  b: number = COL_I_FLANGE_W_PX,
  h: number = COL_I_TOTAL_H_PX,
  tf: number = COL_I_FLANGE_T_PX,
  tw: number = COL_I_WEB_W_PX,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  const hb = b / 2;
  const hh = h / 2;
  const hw = Math.min(tw / 2, hb);
  const tfc = Math.min(tf, hh);
  const ys = flipY ? -1 : 1;
  // 12 vertices CCW outer trace (screen Y-down → ys handles flip):
  return [
    { x: -hb, y: ys *  hh },             // v0  bottom flange BL
    { x:  hb, y: ys *  hh },             // v1  bottom flange BR
    { x:  hb, y: ys * ( hh - tfc) },     // v2  top of BR corner
    { x:  hw, y: ys * ( hh - tfc) },     // v3  web BR
    { x:  hw, y: ys * (-hh + tfc) },     // v4  web TR
    { x:  hb, y: ys * (-hh + tfc) },     // v5  bottom of TR corner
    { x:  hb, y: ys * -hh },             // v6  top flange TR
    { x: -hb, y: ys * -hh },             // v7  top flange TL
    { x: -hb, y: ys * (-hh + tfc) },     // v8  bottom of TL corner
    { x: -hw, y: ys * (-hh + tfc) },     // v9  web TL
    { x: -hw, y: ys * ( hh - tfc) },     // v10 web BL
    { x: -hb, y: ys * ( hh - tfc) },     // v11 top of BL corner
  ];
}

/**
 * Compute the outline polygon of a U-shape (Π/channel) section symbol.
 * ADR-363 Phase 2b. For the MANUAL parametric Π (no `polygon`). Returns 8 CCW
 * vertices in LOCAL symbol coords (centre = origin). Two vertical legs + bottom
 * base; opening up for flipY=false (mirror `buildUshapeLocal`).
 *
 * Shape diagram (Y-down screen, flipY=false → opening at top):
 *
 *   ┌───┐     ┌───┐
 *   │   │     │   │← legs (legT wide)
 *   │   │     │   │
 *   └───┴─────┴───┘← base (baseT tall)
 *
 * @param w      Total symbol width  (default COL_U_SECTION_W_PX)
 * @param h      Total symbol height (default COL_U_SECTION_H_PX)
 * @param legT   Leg thickness       (default COL_U_LEG_T_PX)
 * @param baseT  Base thickness      (default COL_U_BASE_T_PX)
 * @param flipY  Mirror vertically — opening at bottom (default false)
 */
export function computeUProfileOutline(
  w: number = COL_U_SECTION_W_PX,
  h: number = COL_U_SECTION_H_PX,
  legT: number = COL_U_LEG_T_PX,
  baseT: number = COL_U_BASE_T_PX,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  const hw = w / 2;
  const hh = h / 2;
  const lt = Math.min(legT, hw);
  const bt = Math.min(baseT, h);
  const ys = flipY ? -1 : 1;
  // 8 vertices CCW (screen Y-down). Base at screen-bottom (+Y) for flipY=false.
  return [
    { x: -hw,      y: ys *  hh },          // v0 base bottom-left
    { x:  hw,      y: ys *  hh },          // v1 base bottom-right
    { x:  hw,      y: ys * -hh },          // v2 right leg outer-top
    { x:  hw - lt, y: ys * -hh },          // v3 right leg inner-top
    { x:  hw - lt, y: ys * ( hh - bt) },   // v4 right leg inner-bottom (base top)
    { x: -hw + lt, y: ys * ( hh - bt) },   // v5 left leg inner-bottom (base top)
    { x: -hw + lt, y: ys * -hh },          // v6 left leg inner-top
    { x: -hw,      y: ys * -hh },          // v7 left leg outer-top
  ];
}

/**
 * Compute the outline of a polygon-backed section symbol (composite, or U-shape
 * created «από περίγραμμα»). ADR-363 Phase 2b. Scales the actual cross-section
 * polygon (LOCAL mm, bbox-centered) down to fit a `targetPx` box, preserving
 * aspect ratio — so the symbol shows the REAL section shape (mirror του
 * generic-polygon pattern του `beam-section-profile`). Returns `[]` για
 * degenerate polygons (<3 κορυφές).
 *
 * @param poly     Cross-section polygon (LOCAL mm, ≥3 vertices)
 * @param targetPx Target box size (default COL_POLY_BACKED_BOX_PX)
 * @param flipY    Mirror vertically (parity-only)
 */
export function computePolygonBackedOutline(
  poly: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  targetPx: number = COL_POLY_BACKED_BOX_PX,
  flipY = false,
): ReadonlyArray<SectionPoint> {
  if (poly.length < 3) return [];
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = targetPx / span;
  const ys = flipY ? -1 : 1;
  return poly.map((p) => ({ x: (p.x - cx) * scale, y: ys * (p.y - cy) * scale }));
}
