/**
 * ADR-363 Phase 4.5c.2/4.5c.3 — Column material hatch patterns (pure SSoT module).
 *
 * Generates per-material `HatchPlan` (lines + dots + arcs σε world coords / mm)
 * από το column bbox. ZERO dependencies σε React / DOM / Firestore / canvas-state —
 * rendering side κάνει polygon clip + `worldToScreen` per segment/arc.
 *
 * 4 industry-convention plan-view families (κρατώντας τις conventions του
 * AutoCAD architectural set):
 *   - `'rc'`      → dot grid για non-circular; concentric rings για circular.
 *                   Spacing 150mm (dots) ή 3 rings @ 25/50/75% radius.
 *   - `'steel'`   → diagonal cross-hatch @45° + @135°. Spacing 100mm.
 *   - `'masonry'` → horizontal brick rows + staggered vertical joints
 *                   (brick 200×80 mm). Mirror AR-B816 ish.
 *   - `'wood'`    → single-direction diagonal @45°. Spacing 80mm.
 *
 * Lookup: case-insensitive. Unknown / undefined → `'rc'` fallback.
 *
 * SSoT linkage:
 *   - Consumed by `ColumnRenderer.drawMaterialHatch()` ως polygon-clipped pass
 *     μεταξύ fill και stroke (mirror Phase 3.6 `SlabRenderer.drawReinforcementHatch`).
 *   - Constants exported για unit-test reuse + downstream UI inspection.
 *
 * Phase 4.5c.3: circular column hatch added via `computeCircularHatchPlan()`.
 *   RC circular → 3 concentric arcs (rings) inside footprint.
 *   Steel/Masonry/Wood circular → same bbox-based line patterns (clip handles circle).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 4.5c.2
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 4.5c.3
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BoundingBox3D } from '../types/bim-base';

// ─── Material taxonomy ───────────────────────────────────────────────────────

/** Supported plan-view hatch families. */
export type ColumnMaterialKey = 'rc' | 'steel' | 'masonry' | 'wood';

const KNOWN_KEYS: ReadonlyArray<ColumnMaterialKey> = ['rc', 'steel', 'masonry', 'wood'];

/**
 * Case-insensitive lookup με safe fallback. `undefined` / `''` / unknown string
 * → `'rc'` (RC = most common construction default).
 */
export function resolveMaterialKey(raw: string | undefined): ColumnMaterialKey {
  if (!raw) return 'rc';
  const lower = raw.toLowerCase();
  return (KNOWN_KEYS as readonly string[]).includes(lower)
    ? (lower as ColumnMaterialKey)
    : 'rc';
}

// ─── Plan shape ──────────────────────────────────────────────────────────────

export interface HatchLineSegment {
  readonly start: Readonly<Point2D>;
  readonly end: Readonly<Point2D>;
}

export interface HatchDot {
  readonly center: Readonly<Point2D>;
  /**
   * Reserved για future per-dot world-scaled radius. Phase 4.5c.2 renders με
   * fixed PX-based `RC_DOT_RADIUS_PX` (zoom-invariant visual hint). Pure
   * module ωστόσο το εκθέτει για forward-compat — render side αγνοεί.
   */
  readonly radiusMm: number;
}

/**
 * Phase 4.5c.3 — Circular arc descriptor σε world coords. Used για RC circular
 * column concentric rings. `center` + `radiusMm` → renderer calls `ctx.arc()`.
 * Clip (to circular footprint polygon) εφαρμόζεται από τον renderer, same pattern
 * as lines + dots.
 */
export interface HatchArc {
  readonly center: Readonly<Point2D>;
  readonly radiusMm: number;
}

export interface HatchPlan {
  readonly lines: readonly HatchLineSegment[];
  readonly dots: readonly HatchDot[];
  /** Phase 4.5c.3: circular arcs (RC concentric rings). Empty για non-circular. */
  readonly arcs: readonly HatchArc[];
}

// ─── Constants (exported για test + UI reuse) ───────────────────────────────

/** Primary world-space spacing (mm) per material. */
export const HATCH_SPACING_MM: Readonly<Record<ColumnMaterialKey, number>> = {
  'rc':      150,
  'steel':   100,
  'masonry':  80,
  'wood':     80,
};

/** Shared faint stroke colour (mirror του Phase 3.6 slab convention). */
export const HATCH_STROKE_RGBA = 'rgba(0, 0, 0, 0.20)';

/** Per-material stroke width σε CSS px (rendering side). */
export const HATCH_LINE_WIDTH_PX: Readonly<Record<ColumnMaterialKey, number>> = {
  'rc':      0.5,
  'steel':   0.6,
  'masonry': 0.5,
  'wood':    0.4,
};

/** RC dot radius σε CSS px (zoom-invariant). */
export const RC_DOT_RADIUS_PX = 1.5;

/** Masonry brick dimensions (mm) — industry-standard κοινό τούβλο. */
export const MASONRY_BRICK_LENGTH_MM = 200;
export const MASONRY_BRICK_HEIGHT_MM = 80;

/** Safety cap για degenerate / huge bbox — αποφεύγει busy loops. */
const MAX_HATCH_STEPS = 4000;

/**
 * Phase 4.5c.3 — RC circular column: concentric ring fractions.
 * 3 rings at these radii = r × fraction. Industry convention: inner rings show
 * the reinforced concrete core in plan view.
 */
export const CIRCULAR_RC_RING_FRACTIONS: readonly number[] = [0.25, 0.50, 0.75];

// ─── Plan computation ────────────────────────────────────────────────────────

/**
 * Compute the per-material `HatchPlan` σε world coords. Polygon clip
 * εφαρμόζεται από τον renderer; εδώ τα segments καλύπτουν ολόκληρο το bbox
 * extents (lines έχουν length = bbox diagonal για διαγώνιες).
 *
 * Degenerate bbox (min === max ή negative extents) → empty plan, ώστε να
 * αποφεύγονται infinite loops + division-by-zero.
 */
export function computeHatchPlan(
  bbox: BoundingBox3D,
  material: ColumnMaterialKey,
): HatchPlan {
  const dx = bbox.max.x - bbox.min.x;
  const dy = bbox.max.y - bbox.min.y;
  if (dx <= 0 || dy <= 0 || !Number.isFinite(dx) || !Number.isFinite(dy)) {
    return { lines: [], dots: [], arcs: [] };
  }

  switch (material) {
    case 'rc':
      return { lines: [], dots: buildDotGrid(bbox, HATCH_SPACING_MM.rc), arcs: [] };
    case 'steel':
      return { lines: buildSteelCrossHatch(bbox), dots: [], arcs: [] };
    case 'masonry':
      return { lines: buildMasonryPattern(bbox), dots: [], arcs: [] };
    case 'wood':
      return { lines: buildDiagonalHatch(bbox, HATCH_SPACING_MM.wood, +1), dots: [], arcs: [] };
  }
}

/**
 * Phase 4.5c.3 — Compute hatch plan for circular column kind.
 *
 * RC: 3 concentric rings at `CIRCULAR_RC_RING_FRACTIONS` × radius. Industry
 *   convention για στρογγυλές RC κολώνες σε κάτοψη (εσωτερικοί δακτύλιοι
 *   δηλώνουν οπλισμένο σκυρόδεμα). Renderer applies polygon clip to the
 *   32-vertex footprint — arcs beyond the circle are naturally invisible.
 *
 * Steel / Masonry / Wood: same bbox-based line patterns as non-circular (the
 *   circular footprint polygon clip handles the circular boundary).
 *
 * Degenerate (radius ≤ 0) → empty plan.
 *
 * @param center column position σε world mm.
 * @param radiusMm half-diameter of the circular column.
 * @param material resolved material key.
 */
export function computeCircularHatchPlan(
  center: Readonly<Point2D>,
  radiusMm: number,
  material: ColumnMaterialKey,
): HatchPlan {
  if (radiusMm <= 0 || !Number.isFinite(radiusMm)) {
    return { lines: [], dots: [], arcs: [] };
  }

  if (material === 'rc') {
    const arcs: HatchArc[] = CIRCULAR_RC_RING_FRACTIONS.map((f) => ({
      center,
      radiusMm: radiusMm * f,
    }));
    return { lines: [], dots: [], arcs };
  }

  const bbox: BoundingBox3D = {
    min: { x: center.x - radiusMm, y: center.y - radiusMm, z: 0 },
    max: { x: center.x + radiusMm, y: center.y + radiusMm, z: 0 },
  };
  return computeHatchPlan(bbox, material);
}

// ─── Per-material builders ───────────────────────────────────────────────────

function buildDotGrid(bbox: BoundingBox3D, spacingMm: number): readonly HatchDot[] {
  const dots: HatchDot[] = [];
  const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
  const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
  let steps = 0;
  for (let x = startX; x <= bbox.max.x; x += spacingMm) {
    for (let y = startY; y <= bbox.max.y; y += spacingMm) {
      dots.push({ center: { x, y }, radiusMm: 0 });
      if (++steps > MAX_HATCH_STEPS) return dots;
    }
  }
  return dots;
}

function buildSteelCrossHatch(bbox: BoundingBox3D): readonly HatchLineSegment[] {
  return [
    ...buildDiagonalHatch(bbox, HATCH_SPACING_MM.steel, +1),
    ...buildDiagonalHatch(bbox, HATCH_SPACING_MM.steel, -1),
  ];
}

/**
 * Build parallel diagonal segments @45° (slope=+1) or @135° (slope=-1).
 * Spacing μετριέται κάθετα στις γραμμές (orthogonal mm).
 *
 * Algorithm: iterate κατά "perpendicular offset" `k = x − slope·y`, μετά clip
 * την ευθεία `y = slope · (x − k)` στο bbox rectangle. Spacing μεταξύ
 * διαδοχικών k τιμών = `spacingMm × √2` (orthogonal → axial conversion για
 * 45° lines).
 */
function buildDiagonalHatch(
  bbox: BoundingBox3D,
  spacingMm: number,
  slope: 1 | -1,
): readonly HatchLineSegment[] {
  const axial = spacingMm * Math.SQRT2;
  const kMin = bbox.min.x - slope * bbox.max.y;
  const kMax = bbox.max.x - slope * bbox.min.y;
  const startK = Math.ceil(kMin / axial) * axial;
  const out: HatchLineSegment[] = [];
  let steps = 0;
  for (let k = startK; k <= kMax; k += axial) {
    const seg = clipDiagonalToBbox(k, slope, bbox);
    if (seg) out.push(seg);
    if (++steps > MAX_HATCH_STEPS) return out;
  }
  return out;
}

/**
 * Clip line `x = slope · y + k` στο bbox. Returns endpoints ή `null` αν δεν
 * τέμνει.
 */
function clipDiagonalToBbox(
  k: number,
  slope: 1 | -1,
  bbox: BoundingBox3D,
): HatchLineSegment | null {
  // Candidate intersection points με τις 4 πλευρές.
  const ys = [bbox.min.y, bbox.max.y];
  const xs = [bbox.min.x, bbox.max.x];
  const pts: Point2D[] = [];
  for (const y of ys) {
    const x = slope * y + k;
    if (x >= bbox.min.x - 1e-6 && x <= bbox.max.x + 1e-6) pts.push({ x, y });
  }
  for (const x of xs) {
    const y = (x - k) / slope;
    if (y >= bbox.min.y - 1e-6 && y <= bbox.max.y + 1e-6) pts.push({ x, y });
  }
  if (pts.length < 2) return null;
  // Two extremes (max distance) από τα candidate σημεία.
  let a = pts[0];
  let b = pts[1];
  let best = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
      if (d > best) { best = d; a = pts[i]; b = pts[j]; }
    }
  }
  if (best <= 1e-6) return null;
  return { start: a, end: b };
}

/**
 * Masonry brick hatch: horizontal lines κάθε `MASONRY_BRICK_HEIGHT_MM` +
 * staggered vertical joints κάθε `MASONRY_BRICK_LENGTH_MM` με offset/2 σε
 * εναλλασσόμενες σειρές.
 */
function buildMasonryPattern(bbox: BoundingBox3D): readonly HatchLineSegment[] {
  const out: HatchLineSegment[] = [];
  const rowH = MASONRY_BRICK_HEIGHT_MM;
  const brickL = MASONRY_BRICK_LENGTH_MM;
  const startY = Math.ceil(bbox.min.y / rowH) * rowH;

  // Horizontal courses.
  let rowSteps = 0;
  for (let y = startY; y <= bbox.max.y; y += rowH) {
    out.push({ start: { x: bbox.min.x, y }, end: { x: bbox.max.x, y } });
    if (++rowSteps > MAX_HATCH_STEPS) return out;
  }

  // Vertical joints (staggered). Row index από `startY` step rowH.
  let rowIdx = 0;
  let joinSteps = 0;
  for (let y = startY; y < bbox.max.y; y += rowH) {
    const isOddRow = rowIdx % 2 === 1;
    const offset = isOddRow ? brickL / 2 : 0;
    const baseX = Math.ceil((bbox.min.x - offset) / brickL) * brickL + offset;
    for (let x = baseX; x <= bbox.max.x; x += brickL) {
      out.push({ start: { x, y }, end: { x, y: y + rowH } });
      if (++joinSteps > MAX_HATCH_STEPS) return out;
    }
    rowIdx++;
  }
  return out;
}
