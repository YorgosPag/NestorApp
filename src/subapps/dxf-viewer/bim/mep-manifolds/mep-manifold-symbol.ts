/**
 * Plumbing manifold 2D symbol SSoT (ADR-408 Φ12).
 *
 * Single source of truth for the *vector* symbol of a manifold (συλλέκτης),
 * shared by the 2D renderer and the placement ghost. Pure + geometry-driven: it
 * reads the already-computed (rotated) footprint and emits the bar outline plus
 * one inlet stub (−X short end) and N outlet stubs along the +Y front edge — the
 * architectural convention for a distribution manifold, distinct from a panel's
 * breaker rows or a fixture's luminaire "X".
 *
 * ADR-408 Φ14 — a `'drainage-collector'` kind (φρεάτιο) additionally emits a
 * **grating** pattern (parallel bars inside the footprint), the Revit/CIBSE catch
 * basin convention, so a drain reads as a φρεάτιο at a glance instead of a bar.
 *
 * All coordinates are in world canvas units (same space as the footprint), so
 * the renderer just strokes them after applying its transform. Connector world
 * positions are derived separately by `connectorWorldPosition`; this module only
 * draws the visual symbol and keeps the stub count in sync with `outletCount`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  MepManifoldGeometry,
  MepManifoldKind,
  MepManifoldParams,
} from '../types/mep-manifold-types';
import { clampOutletCount } from './mep-manifold-geometry';
import { isDrainageCollectorKind } from '../types/mep-manifold-types';
import { mmToSceneUnits } from '../../utils/scene-units';

/** A polyline of world-space points (canvas units). */
export type ManifoldStroke = readonly Point3D[];

export interface ManifoldSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Stub strokes — inlet (first) + one per outlet. */
  readonly strokes: readonly ManifoldStroke[];
  /**
   * ADR-408 Φ14 — grating bars for a drainage collector (φρεάτιο), drawn with a
   * thinner line than the stubs. `undefined` for a water manifold.
   */
  readonly gratingStrokes?: readonly ManifoldStroke[];
}

/** Number of parallel grating bars drawn inside a drainage collector footprint. */
const GRATING_BAR_COUNT = 6;

/** Fractional inset of each grating bar from the short (−Y/+Y) edges. */
const GRATING_INSET = 0.15;

/**
 * ADR-408 Φ12/Φ14 — the equipment palette for a manifold kind, the SINGLE source
 * shared by the 2D renderer, the 2D placement ghost, and the 3D placement ghost so
 * all three read identically (a water manifold = cyan-teal equipment; a drainage
 * collector = brown, the CIBSE sanitary convention). `fillRgb` is the `r, g, b`
 * triple so each caller composes its own translucency (renderer 0.18, ghost 0.30).
 */
export interface ManifoldPalette {
  /** Outline / symbol stroke colour (`#rrggbb`). */
  readonly strokeHex: string;
  /** Fill colour as an `r, g, b` triple for `rgba(<rgb>, <alpha>)`. */
  readonly fillRgb: string;
}

const MANIFOLD_PALETTE_WATER: ManifoldPalette = { strokeHex: '#0891b2', fillRgb: '8, 145, 178' };
const MANIFOLD_PALETTE_DRAINAGE: ManifoldPalette = { strokeHex: '#b45309', fillRgb: '180, 83, 9' };

/** Resolve the equipment palette for a manifold kind (SSoT for 2D + 3D + ghosts). */
export function resolveManifoldPalette(kind: MepManifoldKind): ManifoldPalette {
  return isDrainageCollectorKind(kind) ? MANIFOLD_PALETTE_DRAINAGE : MANIFOLD_PALETTE_WATER;
}

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * ADR-408 Φ14 — `GRATING_BAR_COUNT` parallel bars across the footprint (the
 * φρεάτιο grating). Each bar runs the short dimension (bottom edge `v0→v1` to top
 * edge `v3→v2`), distributed along the width, inset from the short edges so it
 * stays inside the outline. Rotation-aware for free (the verts are already
 * rotated into world space).
 */
export function buildDrainageGratingStrokes(
  v0: Point3D,
  v1: Point3D,
  v2: Point3D,
  v3: Point3D,
): ManifoldStroke[] {
  const bars: ManifoldStroke[] = [];
  for (let i = 0; i < GRATING_BAR_COUNT; i++) {
    const frac = (i + 1) / (GRATING_BAR_COUNT + 1);
    const bottom = lerp(v0, v1, frac); // point along the −Y edge (across width)
    const top = lerp(v3, v2, frac); // matching point along the +Y edge
    bars.push([lerp(bottom, top, GRATING_INSET), lerp(bottom, top, 1 - GRATING_INSET)]);
  }
  return bars;
}

/**
 * Build the manifold symbol geometry from params + computed geometry.
 * Rectangular bar → an inlet stub off the −X short edge and `outletCount` stubs
 * off the +Y front edge, all rotation-aware because the footprint is rotated.
 */
export function buildMepManifoldSymbol(
  params: MepManifoldParams,
  geometry: MepManifoldGeometry,
): ManifoldSymbolGeometry {
  const outline = geometry.footprint.vertices;
  if (outline.length !== 4) {
    return { outline, strokes: [] };
  }

  // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl) — rotated to world.
  const [v0, v1, v2, v3] = outline;
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const stubLen = Math.max(params.length * s * 0.6, 40 * s);
  const strokes: ManifoldStroke[] = [];

  // Inlet stub: from the midpoint of the −X edge (v0→v3), pointing outward −X.
  const inletRoot = lerp(v0, v3, 0.5);
  const inletDir = unit(v0.x - v1.x, v0.y - v1.y); // −X local (world-rotated)
  strokes.push([
    inletRoot,
    { x: inletRoot.x + inletDir.x * stubLen, y: inletRoot.y + inletDir.y * stubLen, z: 0 },
  ]);

  // Outlet stubs: along the +Y front edge (v3→v2), pointing outward +Y.
  const outletDir = unit(v3.x - v0.x, v3.y - v0.y); // +Y local (world-rotated)
  const count = clampOutletCount(params.outletCount);
  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / (count + 1);
    const root = lerp(v3, v2, frac);
    strokes.push([
      root,
      { x: root.x + outletDir.x * stubLen, y: root.y + outletDir.y * stubLen, z: 0 },
    ]);
  }

  // ADR-408 Φ14 — a drainage collector (φρεάτιο) adds the grating pattern; the
  // stubs above still mark the connector positions (N inlets + 1 outlet).
  if (isDrainageCollectorKind(params.kind)) {
    return { outline, strokes, gratingStrokes: buildDrainageGratingStrokes(v0, v1, v2, v3) };
  }

  return { outline, strokes };
}
