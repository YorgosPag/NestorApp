/**
 * MEP fixture 2D family symbol SSoT (ADR-406).
 *
 * Single source of truth for the *vector* symbol of a point-based fixture,
 * shared by the 2D renderer and any preview/ghost. Pure + geometry-driven: it
 * reads the already-computed footprint (so it is rotation-aware for free) and
 * emits the outline plus the decorative inner strokes that identify the fixture
 * type (a light fixture draws the classic diagonal cross "X" inside its body —
 * the IEC 60617 / architectural convention for a luminaire).
 *
 * All coordinates are in world canvas units (same space as the footprint), so
 * the renderer just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { Point3D } from '../types/bim-base';
import type { MepFixtureGeometry, MepFixtureParams } from '../types/mep-fixture-types';
import { buildDrainageGratingStrokes } from '../mep-manifolds/mep-manifold-symbol';
import { isSanitaryKind, SANITARY_DRAWERS } from '../sanitary/sanitary-symbol-spec';

/** A polyline of world-space points (canvas units). */
export type FixtureStroke = readonly Point3D[];

export interface FixtureSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Decorative inner strokes identifying the fixture type. */
  readonly strokes: readonly FixtureStroke[];
}

/** Centroid of the footprint vertices (canvas units). */
function footprintCenter(vertices: readonly Point3D[]): Point3D {
  let sx = 0, sy = 0;
  for (const v of vertices) { sx += v.x; sy += v.y; }
  const n = Math.max(1, vertices.length);
  return { x: sx / n, y: sy / n, z: 0 };
}

/**
 * Build the fixture symbol geometry from params + computed geometry.
 *   - floor drain (ADR-408 Φ14) → a square grating GRID: the drainage-collector
 *     `buildDrainageGratingStrokes` SSoT applied along BOTH footprint axes, so the
 *     drain reads as a σιφώνι (catch-basin grille) at a glance. Zero duplicated
 *     grating geometry.
 *   - rectangular light fixture → "X" between the 4 footprint corners
 *     (rotation-aware automatically, since the footprint is already rotated).
 *   - circular light fixture → "X" of two diameters at ±45°.
 */
export function buildFixtureSymbol(
  params: MepFixtureParams,
  geometry: MepFixtureGeometry,
): FixtureSymbolGeometry {
  const outline = geometry.footprint.vertices;

  // ADR-408 Φ14 — floor drain: the catch-basin grating grid. The 2D grating SSoT
  // draws parallel bars across one axis (bottom edge v0→v1 to top edge v3→v2); a
  // second call with the vertex order rotated (v0→v3 / v1→v2) lays the orthogonal
  // bars, yielding the grid. Rotation-aware for free (the verts are world-rotated).
  if (params.kind === 'floor-drain' && outline.length === 4) {
    const [v0, v1, v2, v3] = outline;
    return {
      outline,
      strokes: [
        ...buildDrainageGratingStrokes(v0, v1, v2, v3),
        ...buildDrainageGratingStrokes(v0, v3, v2, v1),
      ],
    };
  }

  // ADR-408 Φ14 — sanitary terminal (WC/washbasin/shower/bathtub/bidet): reuse the
  // shared SANITARY_DRAWERS SSoT (same authored 2D vectors as the legacy floorplan
  // symbol, rotation/scale-aware for free). Zero duplicated geometry.
  if (isSanitaryKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: SANITARY_DRAWERS[params.kind](outline) };
  }

  if (params.shape === 'rectangular' && outline.length === 4) {
    const [v0, v1, v2, v3] = outline;
    return {
      outline,
      strokes: [
        [v0, v2],
        [v1, v3],
      ],
    };
  }

  // Circular (or any non-quad): cross of two diameters at ±45° through centre.
  const c = footprintCenter(outline);
  const { min, max } = geometry.bbox;
  const r = Math.min(max.x - min.x, max.y - min.y) / 2;
  const d = r / Math.SQRT2; // 45° component
  return {
    outline,
    strokes: [
      [{ x: c.x - d, y: c.y - d, z: 0 }, { x: c.x + d, y: c.y + d, z: 0 }],
      [{ x: c.x - d, y: c.y + d, z: 0 }, { x: c.x + d, y: c.y - d, z: 0 }],
    ],
  };
}
