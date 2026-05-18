/**
 * ADR-363 Phase 5.5c — Beam material hatch patterns (pure SSoT module).
 *
 * Generates per-material `BeamHatchPlan` (lines + dots σε world coords / mm)
 * από το beam outline bbox + axis direction. ZERO dependencies σε React / DOM /
 * Firestore / canvas-state — rendering side κάνει polygon clip + `worldToScreen`
 * per segment / dot.
 *
 * 3 industry-convention plan-view families για beam (διαφορετικές από column
 * λόγω structural-element semantics):
 *   - `'rc'`     → dot grid spacing 100mm (πιο πυκνό από column RC γιατί η
 *                  beam outline είναι λεπτή — οι dots χωρούν λιγότερα tiles).
 *   - `'steel'`  → diagonal cross-hatch @45° + @135° spacing 80mm (mirror
 *                  column steel αλλά πιο πυκνό για όμοιο visual density).
 *   - `'glulam'` → laminated wood: grain lines PARALLEL στον axis spacing 40mm
 *                  + ένα cross-grain set @30° spacing 120mm (industry
 *                  distinction από plain wood diagonal). `axisUnit` καθορίζει
 *                  την κατεύθυνση του grain — πιο sophisticated από column wood.
 *
 * Lookup: case-insensitive. Unknown / undefined → `'rc'` fallback.
 *
 * SSoT linkage:
 *   - Consumed by `BeamRenderer.drawMaterialHatch()` ως polygon-clipped pass
 *     μεταξύ fill και stroke (mirror Phase 4.5c.2 `ColumnRenderer.drawMaterialHatch`).
 *   - Constants exported για unit-test reuse + downstream UI inspection.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 5.5c
 * @see bim/columns/column-hatch-patterns.ts — parallel pattern για column.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BoundingBox3D } from '../types/bim-base';

// ─── Material taxonomy ───────────────────────────────────────────────────────

/** Supported plan-view hatch families για beam. */
export type BeamMaterialKey = 'rc' | 'steel' | 'glulam';

const KNOWN_KEYS: ReadonlyArray<BeamMaterialKey> = ['rc', 'steel', 'glulam'];

/**
 * Case-insensitive lookup με safe fallback. `undefined` / `''` / unknown string
 * → `'rc'` (RC = most common construction default για residential beam).
 */
export function resolveBeamMaterialKey(raw: string | undefined): BeamMaterialKey {
  if (!raw) return 'rc';
  const lower = raw.toLowerCase();
  return (KNOWN_KEYS as readonly string[]).includes(lower)
    ? (lower as BeamMaterialKey)
    : 'rc';
}

// ─── Plan shape ──────────────────────────────────────────────────────────────

export interface BeamHatchLineSegment {
  readonly start: Readonly<Point2D>;
  readonly end: Readonly<Point2D>;
}

export interface BeamHatchDot {
  readonly center: Readonly<Point2D>;
  /** Reserved για future per-dot world-scaled radius. Renderer χρησιμοποιεί
   *  fixed PX `BEAM_RC_DOT_RADIUS_PX` (zoom-invariant visual hint). */
  readonly radiusMm: number;
}

export interface BeamHatchPlan {
  readonly lines: readonly BeamHatchLineSegment[];
  readonly dots: readonly BeamHatchDot[];
}

// ─── Constants (exported για test + UI reuse) ───────────────────────────────

/** Primary world-space spacing (mm) per material. */
export const BEAM_HATCH_SPACING_MM: Readonly<Record<BeamMaterialKey, number>> = {
  'rc':     100,
  'steel':   80,
  'glulam':  40,
};

/** Glulam cross-grain spacing (mm) — sparse @30° set που τέμνει τα grain lines. */
export const GLULAM_CROSS_GRAIN_SPACING_MM = 120;

/** Glulam cross-grain angle σε radians (30°). */
export const GLULAM_CROSS_GRAIN_ANGLE_RAD = Math.PI / 6;

/** Shared faint stroke colour (mirror column convention). */
export const BEAM_HATCH_STROKE_RGBA = 'rgba(0, 0, 0, 0.20)';

/** Per-material stroke width σε CSS px. */
export const BEAM_HATCH_LINE_WIDTH_PX: Readonly<Record<BeamMaterialKey, number>> = {
  'rc':     0.5,
  'steel':  0.6,
  'glulam': 0.5,
};

/** RC dot radius σε CSS px (zoom-invariant). */
export const BEAM_RC_DOT_RADIUS_PX = 1.2;

/** Safety cap για degenerate / huge bbox — αποφεύγει busy loops. */
const MAX_HATCH_STEPS = 4000;

const DEGENERATE_EPS = 1e-6;

// ─── Plan computation ────────────────────────────────────────────────────────

/** Axis unit vector input — pre-computed from beam axis (start → end). */
export interface BeamAxisOrientation {
  readonly ux: number;
  readonly uy: number;
}

/**
 * Compute the per-material `BeamHatchPlan` σε world coords. Polygon clip
 * εφαρμόζεται από τον renderer; εδώ τα segments καλύπτουν ολόκληρο το bbox
 * extents.
 *
 * `axis` καθορίζει την κατεύθυνση grain για `glulam` (parallel σε axis).
 * Για `rc` / `steel`, ο axis αγνοείται.
 *
 * Degenerate bbox (min === max ή negative extents) → empty plan.
 */
export function computeBeamHatchPlan(
  bbox: BoundingBox3D,
  axis: Readonly<BeamAxisOrientation>,
  material: BeamMaterialKey,
): BeamHatchPlan {
  const dx = bbox.max.x - bbox.min.x;
  const dy = bbox.max.y - bbox.min.y;
  if (dx <= 0 || dy <= 0 || !Number.isFinite(dx) || !Number.isFinite(dy)) {
    return { lines: [], dots: [] };
  }

  switch (material) {
    case 'rc':
      return { lines: [], dots: buildDotGrid(bbox, BEAM_HATCH_SPACING_MM.rc) };
    case 'steel':
      return { lines: buildSteelCrossHatch(bbox), dots: [] };
    case 'glulam':
      return { lines: buildGlulamPattern(bbox, axis), dots: [] };
  }
}

// ─── Per-material builders ───────────────────────────────────────────────────

function buildDotGrid(bbox: BoundingBox3D, spacingMm: number): readonly BeamHatchDot[] {
  const dots: BeamHatchDot[] = [];
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

function buildSteelCrossHatch(bbox: BoundingBox3D): readonly BeamHatchLineSegment[] {
  return [
    ...buildAxisAlignedHatch(bbox, BEAM_HATCH_SPACING_MM.steel, { ux: Math.SQRT1_2, uy: Math.SQRT1_2 }),
    ...buildAxisAlignedHatch(bbox, BEAM_HATCH_SPACING_MM.steel, { ux: Math.SQRT1_2, uy: -Math.SQRT1_2 }),
  ];
}

/**
 * Glulam pattern: grain lines parallel σε `axis` spacing 40mm + sparse
 * cross-grain @30° offset από axis spacing 120mm. Όταν το axis είναι
 * degenerate (zero vector), fallback σε horizontal grain.
 */
function buildGlulamPattern(
  bbox: BoundingBox3D,
  axis: Readonly<BeamAxisOrientation>,
): readonly BeamHatchLineSegment[] {
  const safe = normalizeOrFallback(axis);
  const grain = buildAxisAlignedHatch(bbox, BEAM_HATCH_SPACING_MM.glulam, safe);
  const cross = buildAxisAlignedHatch(
    bbox,
    GLULAM_CROSS_GRAIN_SPACING_MM,
    rotate(safe, GLULAM_CROSS_GRAIN_ANGLE_RAD),
  );
  return [...grain, ...cross];
}

function normalizeOrFallback(axis: Readonly<BeamAxisOrientation>): BeamAxisOrientation {
  const len = Math.hypot(axis.ux, axis.uy);
  if (len < DEGENERATE_EPS) return { ux: 1, uy: 0 };
  return { ux: axis.ux / len, uy: axis.uy / len };
}

function rotate(u: Readonly<BeamAxisOrientation>, angle: number): BeamAxisOrientation {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { ux: u.ux * c - u.uy * s, uy: u.ux * s + u.uy * c };
}

/**
 * Build parallel hatch segments orthogonal to a unit direction `u`. Spacing
 * μετριέται κάθετα στις γραμμές (orthogonal mm). Equivalent με `buildDiagonalHatch`
 * του column module αλλά γενικευμένο σε arbitrary direction (όχι μόνο ±45°).
 *
 * Algorithm: iterate κατά perpendicular offset `k = -uy·x + ux·y`, μετά clip
 * την ευθεία στο bbox rectangle.
 */
function buildAxisAlignedHatch(
  bbox: BoundingBox3D,
  spacingMm: number,
  u: Readonly<BeamAxisOrientation>,
): readonly BeamHatchLineSegment[] {
  // Perpendicular direction (CCW 90° from u): n = (-uy, ux).
  // For each line: -uy·x + ux·y = k. Iterate k over bbox perpendicular extents.
  const corners: ReadonlyArray<readonly [number, number]> = [
    [bbox.min.x, bbox.min.y],
    [bbox.max.x, bbox.min.y],
    [bbox.max.x, bbox.max.y],
    [bbox.min.x, bbox.max.y],
  ];
  let kMin = Number.POSITIVE_INFINITY;
  let kMax = Number.NEGATIVE_INFINITY;
  for (const [x, y] of corners) {
    const k = -u.uy * x + u.ux * y;
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
  }
  const startK = Math.ceil(kMin / spacingMm) * spacingMm;
  const out: BeamHatchLineSegment[] = [];
  let steps = 0;
  for (let k = startK; k <= kMax; k += spacingMm) {
    const seg = clipLineToBbox(u, k, bbox);
    if (seg) out.push(seg);
    if (++steps > MAX_HATCH_STEPS) return out;
  }
  return out;
}

/**
 * Clip the infinite line `{ p : -uy·p.x + ux·p.y = k }` στο bbox. Παραμετροποίηση:
 * `p(t) = p0 + t · u` όπου p0 είναι οποιοδήποτε σημείο της ευθείας.
 */
function clipLineToBbox(
  u: Readonly<BeamAxisOrientation>,
  k: number,
  bbox: BoundingBox3D,
): BeamHatchLineSegment | null {
  // Find p0 on the line: closest point to origin → p0 = k · n  όπου n = (-uy, ux).
  const p0x = -u.uy * k;
  const p0y = u.ux * k;
  // Intersect with bbox using slab method on t.
  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;
  // X slab.
  if (Math.abs(u.ux) > DEGENERATE_EPS) {
    const t1 = (bbox.min.x - p0x) / u.ux;
    const t2 = (bbox.max.x - p0x) / u.ux;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (p0x < bbox.min.x - DEGENERATE_EPS || p0x > bbox.max.x + DEGENERATE_EPS) {
    return null;
  }
  // Y slab.
  if (Math.abs(u.uy) > DEGENERATE_EPS) {
    const t1 = (bbox.min.y - p0y) / u.uy;
    const t2 = (bbox.max.y - p0y) / u.uy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (p0y < bbox.min.y - DEGENERATE_EPS || p0y > bbox.max.y + DEGENERATE_EPS) {
    return null;
  }
  if (tMax - tMin <= DEGENERATE_EPS) return null;
  return {
    start: { x: p0x + tMin * u.ux, y: p0y + tMin * u.uy },
    end:   { x: p0x + tMax * u.ux, y: p0y + tMax * u.uy },
  };
}
