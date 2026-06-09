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
import {
  isPlumbingFixtureKind,
  resolvePlumbingFixtureDrawer,
} from './plumbing-fixture-spec';
import { isSocketKind, socketDrawer } from './socket-symbol-spec';
import { isDataOutletKind, dataOutletDrawer } from './data-outlet-symbol-spec';
import { isAirTerminalKind, airTerminalDrawer } from './air-terminal-symbol-spec';
import { isAhuKind, ahuDrawer } from './ahu-symbol-spec';
import { isSprinklerKind, sprinklerDrawer } from './sprinkler-symbol-spec';
import { isFireRiserKind, fireRiserDrawer } from './fire-riser-symbol-spec';
import { isGasMeterKind, gasMeterDrawer } from './gas-meter-symbol-spec';
import { isGasCookerKind, gasCookerDrawer } from './gas-cooker-symbol-spec';

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

  // ADR-408 Φ14 / Δρόμος B — plumbing fixture (sanitary terminal WC/basin/… OR
  // appliance washing-machine/…): reuse the shared per-family drawer SSoT
  // (`resolvePlumbingFixtureDrawer`), rotation/scale-aware for free. Zero duplicated
  // geometry.
  if (isPlumbingFixtureKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: resolvePlumbingFixtureDrawer(params.kind)(outline) };
  }

  // ADR-430 — a socket (πρίζα) draws the round receptacle glyph (face + two contact
  // pins) via the socket SSoT drawer, rotation/scale-aware for free.
  if (isSocketKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: socketDrawer(outline) };
  }

  // ADR-431 — a data outlet (RJ45) draws the downward-triangle telecom glyph via the
  // data-outlet SSoT drawer, rotation/scale-aware for free.
  if (isDataOutletKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: dataOutletDrawer(outline) };
  }

  // ADR-432 — HVAC: a supply-air terminal draws the concentric-square ceiling-diffuser
  // glyph; an AHU draws the fan + airflow-chevron unit glyph. Both rotation/scale-aware.
  if (isAirTerminalKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: airTerminalDrawer(outline) };
  }
  if (isAhuKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: ahuDrawer(outline) };
  }

  // ADR-433 — Fire protection: a sprinkler head draws the round head + deflector cross;
  // a fire riser draws the riser-pipe circle + fire-cross + control-valve bow-tie. Both
  // rotation/scale-aware via the shared normalized-coord helpers.
  if (isSprinklerKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: sprinklerDrawer(outline) };
  }
  if (isFireRiserKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: fireRiserDrawer(outline) };
  }

  // ADR-434 — Gas: a gas meter draws the dial + gauge-needle metering glyph; a gas cooker
  // draws the four-burner hob glyph. Both rotation/scale-aware via the shared helpers.
  if (isGasMeterKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: gasMeterDrawer(outline) };
  }
  if (isGasCookerKind(params.kind) && outline.length >= 4) {
    return { outline, strokes: gasCookerDrawer(outline) };
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
