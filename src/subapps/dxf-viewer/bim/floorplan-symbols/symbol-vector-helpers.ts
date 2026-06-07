/**
 * Generic normalized-coordinate 2D vector helpers (ADR-415, extracted ADR-408 Φ14).
 *
 * Pure, zero-trig builders shared by every parametric plan symbol — both the
 * 2D-only floorplan symbols (`floorplan-symbol-symbol.ts`) AND the connectable
 * sanitary mep-fixtures (`sanitary-symbol-spec.ts`). Inner shapes are expressed
 * in NORMALIZED footprint coordinates `(u, v) ∈ [0,1]²` and mapped to world
 * space via the footprint's own (rotated, scaled) basis — so a symbol follows
 * rotation/scale automatically with ZERO trigonometry at the call site.
 *
 * Convention: `u = 0` → left edge, `u = 1` → right edge; `v = 0` → front edge,
 * `v = 1` → back edge (`vertices[0]` corner is the front-left).
 *
 * SSoT: this is the single home for the `(u,v)` → world mapping. Previously these
 * helpers lived inline in `floorplan-symbol-symbol.ts`; ADR-408 Φ14 lifted them so
 * the sanitary drawer SSoT can be shared by a second consumer without duplication.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { Point3D } from '../types/bim-base';

/** A polyline of world-space points (canvas units). */
export type SymbolStroke = readonly Point3D[];

/** Footprint corner vertices (already rotated/scaled world points). */
export type FootprintBasis = readonly Point3D[];

/** Map normalized `(u, v) ∈ [0,1]²` to world space via the footprint basis. */
function mapNorm(fp: FootprintBasis, u: number, v: number): Point3D {
  const [c0, c1, , c3] = fp; // c0=(-hw,-hd) c1=(hw,-hd) c2=(hw,hd) c3=(-hw,hd)
  return {
    x: c0.x + (c1.x - c0.x) * u + (c3.x - c0.x) * v,
    y: c0.y + (c1.y - c0.y) * u + (c3.y - c0.y) * v,
    z: 0,
  };
}

/** Closed rectangle (5 pts) in normalized coords. */
export function rect(fp: FootprintBasis, u0: number, v0: number, u1: number, v1: number): SymbolStroke {
  return [mapNorm(fp, u0, v0), mapNorm(fp, u1, v0), mapNorm(fp, u1, v1), mapNorm(fp, u0, v1), mapNorm(fp, u0, v0)];
}

/** Straight segment in normalized coords. */
export function line(fp: FootprintBasis, u0: number, v0: number, u1: number, v1: number): SymbolStroke {
  return [mapNorm(fp, u0, v0), mapNorm(fp, u1, v1)];
}

/** Sampled ellipse (closed) centred at `(cu, cv)`, half-extents `(ru, rv)`. */
export function ellipse(fp: FootprintBasis, cu: number, cv: number, ru: number, rv: number, seg = 28): SymbolStroke {
  const pts: Point3D[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(mapNorm(fp, cu + ru * Math.cos(a), cv + rv * Math.sin(a)));
  }
  return pts;
}
