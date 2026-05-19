/**
 * ADR-363 Phase 4.5e-B — Wall material hatch patterns (pure SSoT module).
 *
 * 4 industry-convention plan-view families for walls:
 *   - `'rc'`               → dot grid @150mm spacing (reuses column RC pattern).
 *   - `'masonry'`          → horizontal brick rows @80mm (reuses column masonry).
 *   - `'aerated-concrete'` → diagonal cross-hatch @45°+135°, spacing 150mm
 *                            (standard Ytong/aircrete hatch in AutoCAD ANSI37-ish).
 *   - `'gypsum'`           → single diagonal @45°, spacing 80mm (lightweight board).
 *
 * Clip: WallRenderer clips to the outer+inner edge polygon before drawing.
 * Guards: DNA-bearing walls skip hatch (per-layer DNA rendering handles materials).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 4.5e-B
 */

import type { BoundingBox3D } from '../types/bim-base';
import {
  computeHatchPlan,
  type HatchPlan,
  type HatchLineSegment,
  HATCH_STROKE_RGBA,
  RC_DOT_RADIUS_PX,
} from '../columns/column-hatch-patterns';

export type { HatchPlan, HatchLineSegment };
export { HATCH_STROKE_RGBA, RC_DOT_RADIUS_PX };

// ─── Material taxonomy ───────────────────────────────────────────────────────

export type WallMaterialKey = 'rc' | 'masonry' | 'aerated-concrete' | 'gypsum';

const KNOWN_WALL_KEYS: ReadonlyArray<WallMaterialKey> = [
  'rc', 'masonry', 'aerated-concrete', 'gypsum',
];

/** Case-insensitive lookup με RC fallback (most common structural wall). */
export function resolveWallMaterialKey(raw: string | undefined): WallMaterialKey {
  if (!raw) return 'rc';
  const lower = raw.toLowerCase();
  return (KNOWN_WALL_KEYS as readonly string[]).includes(lower)
    ? (lower as WallMaterialKey)
    : 'rc';
}

// ─── Hatch constants ─────────────────────────────────────────────────────────

export const WALL_HATCH_LINE_WIDTH_PX: Readonly<Record<WallMaterialKey, number>> = {
  'rc':               0.5,
  'masonry':          0.5,
  'aerated-concrete': 0.5,
  'gypsum':           0.4,
};

/** Perpendicular spacing (mm) between diagonal hatch lines. */
const DIAGONAL_SPACING_MM: Readonly<Record<'aerated-concrete' | 'gypsum', number>> = {
  'aerated-concrete': 150,
  'gypsum':            80,
};

// ─── Plan computation ────────────────────────────────────────────────────────

/** Compute `HatchPlan` for a wall body bbox + material. */
export function computeWallHatchPlan(
  bbox: BoundingBox3D,
  key: WallMaterialKey,
): HatchPlan {
  if (key === 'rc') return computeHatchPlan(bbox, 'rc');
  if (key === 'masonry') return computeHatchPlan(bbox, 'masonry');
  if (key === 'aerated-concrete') {
    const s = DIAGONAL_SPACING_MM['aerated-concrete'];
    return {
      lines: [
        ...buildDiagonalLines(bbox, s, +1),
        ...buildDiagonalLines(bbox, s, -1),
      ],
      dots: [],
      arcs: [],
    };
  }
  // gypsum — single diagonal
  return {
    lines: buildDiagonalLines(bbox, DIAGONAL_SPACING_MM['gypsum'], +1),
    dots: [],
    arcs: [],
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const MAX_LINES = 500;

/**
 * Diagonal hatch lines within bbox.
 * direction +1 → y = x + c (SW→NE), -1 → y = -x + c (NW→SE).
 * Perpendicular spacing = `spacingMm`.
 */
function buildDiagonalLines(
  bbox: BoundingBox3D,
  spacingMm: number,
  direction: 1 | -1,
): readonly HatchLineSegment[] {
  const lines: HatchLineSegment[] = [];
  const step = spacingMm * Math.SQRT2;
  const { min, max } = bbox;

  if (direction === 1) {
    const cMin = min.y - max.x;
    const cMax = max.y - min.x;
    for (let c = Math.ceil(cMin / step) * step; c <= cMax; c += step) {
      const x0 = Math.max(min.x, min.y - c);
      const x1 = Math.min(max.x, max.y - c);
      if (x1 > x0) {
        lines.push({ start: { x: x0, y: x0 + c }, end: { x: x1, y: x1 + c } });
        if (lines.length >= MAX_LINES) return lines;
      }
    }
  } else {
    const cMin = min.x + min.y;
    const cMax = max.x + max.y;
    for (let c = Math.ceil(cMin / step) * step; c <= cMax; c += step) {
      const x0 = Math.max(min.x, c - max.y);
      const x1 = Math.min(max.x, c - min.y);
      if (x1 > x0) {
        lines.push({ start: { x: x0, y: c - x0 }, end: { x: x1, y: c - x1 } });
        if (lines.length >= MAX_LINES) return lines;
      }
    }
  }
  return lines;
}
