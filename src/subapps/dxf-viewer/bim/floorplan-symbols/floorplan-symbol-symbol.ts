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
 * NORMALIZED footprint coordinates `(u, v) ∈ [0,1]²` via the shared
 * `symbol-vector-helpers` (rotation/scale-aware, zero trig).
 *
 * ADR-408 Φ14: the five SANITARY drawers were lifted to the canonical
 * `sanitary-symbol-spec.ts` SSoT (now shared with the connectable sanitary
 * `mep-fixture`); this module imports them so there is ZERO duplicated geometry.
 * Kitchen/furniture drawers remain local (no second consumer).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  FloorplanSymbolGeometry,
  FloorplanSymbolKind,
  FloorplanSymbolParams,
} from '../types/floorplan-symbol-types';
import { SANITARY_DRAWERS } from '../sanitary/sanitary-symbol-spec';
import {
  ellipse,
  line,
  rect,
  type FootprintBasis,
  type SymbolStroke,
} from './symbol-vector-helpers';

// Back-compat re-export: `SymbolStroke` now lives in the shared helpers module.
export type { SymbolStroke };

export interface FloorplanSymbolSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Decorative inner strokes identifying the symbol kind. */
  readonly strokes: readonly SymbolStroke[];
}

// ─── Per-kind drawers (each pure: footprint → identifying strokes) ─────────────

const DRAWERS: Readonly<Record<FloorplanSymbolKind, (fp: FootprintBasis) => SymbolStroke[]>> = {
  // ── Sanitary — canonical SSoT in sanitary-symbol-spec.ts (shared with mep-fixture) ──
  ...SANITARY_DRAWERS,
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
