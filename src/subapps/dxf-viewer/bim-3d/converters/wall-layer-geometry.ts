/**
 * Wall per-layer 3D split (ADR-413) — multi-layer DNA wall → one sub-solid per
 * layer (Revit "Compound Structure" / IFC `IfcMaterialLayerSet`).
 *
 * A wall with `params.dna.layers.length > 1` is no longer one mono-material box:
 * each DNA layer (exterior plaster → core → interior plaster) becomes its OWN
 * thickness-slab between two boundaries offset ACROSS the wall thickness, so it
 * can carry its own material/texture (plaster vs concrete vs brick).
 *
 * Composition with the existing along-length split:
 *   1. `computeWallOpeningPieces` already cuts the wall ALONG its length into
 *      `WallOpeningPiece`s (jambs / sill / header / profile pieces), each a plan
 *      quad `[outer@a, outer@b, inner@b, inner@a]` + per-boundary z range.
 *   2. Here we cut each such piece ACROSS its thickness into N layer sub-quads,
 *      interpolating the piece's outer edge → inner edge by cumulative-thickness
 *      fractions. The per-boundary z values (`zBot*`, `zTop*`, slope) are shared
 *      by every layer → sloped tops/bases survive untouched.
 *
 * Boundary orientation: `wall.geometry.outerEdge = offset(axis, +sign)`,
 * `innerEdge = offset(axis, −sign)` (see `wall-geometry.ts` `offsetAxisToEdges`).
 * The piece quad puts the outer face at indices [0,1] (Ao, Bo) and the inner face
 * at [2,3] (Bi, Ai). DNA layers are ordered exterior→core→interior, so layer 0
 * (exterior) sits at the OUTER face (fraction 0) and the last (interior) at the
 * INNER face (fraction 1). This matches the 2D cross-section reading direction.
 *
 * Pure geometry helper — no THREE materials, no store reads. Each fn ≤40 lines.
 *
 * @see wall-opening-pieces.ts — the along-length `WallOpeningPiece` source
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import type { Point3D } from '../../bim/types/bim-base';
import type { WallDna, WallDnaLayer } from '../../bim/types/wall-dna-types';
import { buildupBoundaryFractions } from '../../bim/types/layered-buildup';
import type { WallOpeningPiece } from './wall-opening-pieces';

/** One layer's share of a `WallOpeningPiece`: its own quad + the source piece z range + identity. */
export interface WallLayerPiece {
  /** The source along-length piece (z range, slope flags, topFollowsProfile) — shared by all layers. */
  readonly piece: WallOpeningPiece;
  /** This layer's thickness sub-quad `[outer@a, outer@b, inner@b, inner@a]`. */
  readonly quad: readonly [Point3D, Point3D, Point3D, Point3D];
  /** DNA materialId of this layer (→ `getMaterial3D`). */
  readonly materialId: string;
  /** Stable layer id (DNA layer id) for `userData` tagging. */
  readonly layerId: string;
}

/** True when the wall should render as a per-layer group (>1 DNA layer with positive thickness). */
export function isMultiLayerWall(dna: WallDna | undefined): dna is WallDna {
  return !!dna && dna.layers.length > 1 && dna.totalThickness > 1e-6;
}

/** Linear interpolation of a plan point (z carried as 0 — pieces are 2D footprints). */
function lerpPt(p: Point3D, q: Point3D, t: number): Point3D {
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: 0 };
}

/**
 * Cumulative thickness fractions [0..1] at each layer boundary, measured from the
 * OUTER face. `[0, f1, f2, …, 1]` (length = layers.length + 1). Uses
 * `totalThickness` as the SSoT denominator (matches `WallParams.thickness`).
 *
 * Thin wall-typed wrapper over the entity-agnostic SSoT
 * `buildupBoundaryFractions` (shared with slabs — `layered-buildup.ts`).
 */
export function layerBoundaryFractions(dna: WallDna): number[] {
  return buildupBoundaryFractions(dna);
}

/**
 * Split ONE along-length piece across its thickness into per-layer sub-quads.
 *
 * The piece quad is `[Ao, Bo, Bi, Ai]`. Outer→inner along boundary `a` is the
 * segment `Ao→Ai`; along boundary `b` it is `Bo→Bi`. Layer i (fraction `f0..f1`)
 * gets `[lerp(Ao,Ai,f0), lerp(Bo,Bi,f0), lerp(Bo,Bi,f1), lerp(Ao,Ai,f1)]`,
 * preserving the `[outer@a, outer@b, inner@b, inner@a]` winding for `buildShape`.
 */
export function splitPieceByLayers(piece: WallOpeningPiece, dna: WallDna): WallLayerPiece[] {
  const [Ao, Bo, Bi, Ai] = piece.quad;
  const fracs = layerBoundaryFractions(dna);
  const out: WallLayerPiece[] = [];
  for (let i = 0; i < dna.layers.length; i++) {
    const layer: WallDnaLayer = dna.layers[i];
    const f0 = fracs[i];
    const f1 = fracs[i + 1];
    if (f1 - f0 < 1e-9) continue; // zero-thickness layer → skip
    const quad: [Point3D, Point3D, Point3D, Point3D] = [
      lerpPt(Ao, Ai, f0),
      lerpPt(Bo, Bi, f0),
      lerpPt(Bo, Bi, f1),
      lerpPt(Ao, Ai, f1),
    ];
    out.push({ piece, quad, materialId: layer.materialId, layerId: layer.id });
  }
  return out;
}
