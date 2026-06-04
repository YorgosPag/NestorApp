/**
 * Floorplan symbol 2D vector drawer SSoT (ADR-415).
 *
 * Single source of truth for the *pure-vector* symbol of a floorplan symbol,
 * shared by the 2D renderer and any preview/ghost. Pure + geometry-driven: it
 * reads the already-computed footprint (so it is rotation-aware for free) and
 * emits the closed outline plus the decorative inner strokes that identify the
 * symbol kind.
 *
 * Δ1 (ADR-415): every symbol is authored by us from straight lines + sampled
 * arcs/ellipses — no third-party asset, no mesh. Inner shapes are expressed in
 * NORMALIZED footprint coordinates `(u, v) ∈ [0,1]²` and mapped to world space via
 * the footprint's own (rotated, scaled) basis — so there is ZERO trigonometry
 * here and every symbol follows rotation/scale automatically.
 *
 * Convention: `u = 0` → left edge, `u = 1` → right edge; `v = 0` → front edge,
 * `v = 1` → back edge (`vertices[0]` corner is the front-left).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  FloorplanSymbolGeometry,
  FloorplanSymbolKind,
  FloorplanSymbolParams,
} from '../types/floorplan-symbol-types';

/** A polyline of world-space points (canvas units). */
export type SymbolStroke = readonly Point3D[];

export interface FloorplanSymbolSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Decorative inner strokes identifying the symbol kind. */
  readonly strokes: readonly SymbolStroke[];
}

// ─── Normalized-coordinate helpers (rotation + scale aware, zero trig) ─────────

type FP = readonly Point3D[];

/** Map normalized `(u, v) ∈ [0,1]²` to world space via the footprint basis. */
function n(fp: FP, u: number, v: number): Point3D {
  const [c0, c1, , c3] = fp; // c0=(-hw,-hd) c1=(hw,-hd) c2=(hw,hd) c3=(-hw,hd)
  return {
    x: c0.x + (c1.x - c0.x) * u + (c3.x - c0.x) * v,
    y: c0.y + (c1.y - c0.y) * u + (c3.y - c0.y) * v,
    z: 0,
  };
}

/** Open polyline through a list of normalized points. */
function poly(fp: FP, pts: ReadonlyArray<readonly [number, number]>): SymbolStroke {
  return pts.map(([u, v]) => n(fp, u, v));
}

/** Closed rectangle (5 pts) in normalized coords. */
function rect(fp: FP, u0: number, v0: number, u1: number, v1: number): SymbolStroke {
  return [n(fp, u0, v0), n(fp, u1, v0), n(fp, u1, v1), n(fp, u0, v1), n(fp, u0, v0)];
}

/** Straight segment in normalized coords. */
function line(fp: FP, u0: number, v0: number, u1: number, v1: number): SymbolStroke {
  return [n(fp, u0, v0), n(fp, u1, v1)];
}

/** Sampled ellipse (closed) centred at `(cu, cv)`, half-extents `(ru, rv)`. */
function ellipse(fp: FP, cu: number, cv: number, ru: number, rv: number, seg = 28): SymbolStroke {
  const pts: Point3D[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(n(fp, cu + ru * Math.cos(a), cv + rv * Math.sin(a)));
  }
  return pts;
}

// ─── Per-kind drawers (each pure: footprint → identifying strokes) ─────────────

const DRAWERS: Readonly<Record<FloorplanSymbolKind, (fp: FP) => SymbolStroke[]>> = {
  // ── Sanitary ──────────────────────────────────────────────────────────────
  wc: (fp) => [rect(fp, 0.12, 0.8, 0.88, 1.0), ellipse(fp, 0.5, 0.42, 0.34, 0.36), ellipse(fp, 0.5, 0.42, 0.27, 0.29)],
  washbasin: (fp) => [ellipse(fp, 0.5, 0.45, 0.4, 0.34), ellipse(fp, 0.5, 0.45, 0.03, 0.03), ellipse(fp, 0.5, 0.88, 0.05, 0.05)],
  shower: (fp) => [line(fp, 0.02, 0.02, 0.98, 0.98), line(fp, 0.98, 0.02, 0.02, 0.98), ellipse(fp, 0.5, 0.5, 0.06, 0.06)],
  bathtub: (fp) => [rect(fp, 0.08, 0.1, 0.92, 0.9), ellipse(fp, 0.5, 0.55, 0.34, 0.3), ellipse(fp, 0.5, 0.2, 0.04, 0.04)],
  bidet: (fp) => [ellipse(fp, 0.5, 0.46, 0.36, 0.42), ellipse(fp, 0.5, 0.46, 0.2, 0.24), ellipse(fp, 0.5, 0.88, 0.04, 0.04)],
  // ── Kitchen ─────────────────────────────────────────────────────────────────
  'kitchen-sink': (fp) => [rect(fp, 0.06, 0.15, 0.46, 0.85), rect(fp, 0.54, 0.15, 0.94, 0.85), ellipse(fp, 0.5, 0.94, 0.04, 0.04)],
  stove: (fp) => [ellipse(fp, 0.3, 0.7, 0.15, 0.15), ellipse(fp, 0.7, 0.7, 0.15, 0.15), ellipse(fp, 0.3, 0.3, 0.12, 0.12), ellipse(fp, 0.7, 0.3, 0.12, 0.12)],
  fridge: (fp) => [line(fp, 0.05, 0.12, 0.95, 0.12), line(fp, 0.82, 0.04, 0.82, 0.1)],
  counter: (fp) => [line(fp, 0.0, 0.1, 1.0, 0.1)],
  // ── Furniture (pure 2D footprints) ───────────────────────────────────────────
  'bed-single': (fp) => [rect(fp, 0.12, 0.76, 0.88, 0.96), line(fp, 0.06, 0.6, 0.94, 0.6)],
  'bed-double': (fp) => [rect(fp, 0.08, 0.76, 0.47, 0.96), rect(fp, 0.53, 0.76, 0.92, 0.96), line(fp, 0.06, 0.6, 0.94, 0.6)],
  sofa: (fp) => [rect(fp, 0.0, 0.74, 1.0, 1.0), rect(fp, 0.0, 0.0, 0.14, 0.74), rect(fp, 0.86, 0.0, 1.0, 0.74), line(fp, 0.5, 0.0, 0.5, 0.74)],
  armchair: (fp) => [rect(fp, 0.0, 0.74, 1.0, 1.0), rect(fp, 0.0, 0.0, 0.2, 0.74), rect(fp, 0.8, 0.0, 1.0, 0.74)],
  'dining-table': (fp) => [rect(fp, 0.06, 0.08, 0.94, 0.92)],
  chair: (fp) => [rect(fp, 0.12, 0.1, 0.88, 0.78), rect(fp, 0.1, 0.84, 0.9, 0.98)],
  desk: (fp) => [rect(fp, 0.04, 0.06, 0.96, 0.94), rect(fp, 0.7, 0.12, 0.92, 0.88)],
};

/**
 * Build the floorplan symbol geometry (outline + identifying strokes) from params
 * + computed geometry. Dispatch by `kind` through the drawer registry. The outline
 * is always the footprint.
 */
export function buildFloorplanSymbol(
  params: FloorplanSymbolParams,
  geometry: FloorplanSymbolGeometry,
): FloorplanSymbolSymbolGeometry {
  const outline = geometry.footprint.vertices;
  const strokes = outline.length >= 4 ? DRAWERS[params.kind](outline) : [];
  return { outline, strokes };
}
