/**
 * ADR-650 M4 — `TinSurface` → `THREE.BufferGeometry`. The SOLE place the topographic
 * surface crosses from the survey domain into the 3D scene.
 *
 * Pure: no store, no entity, no scene. That is deliberate — it keeps the door open to
 * promoting the terrain from a standalone 3D layer to a full BIM element (Revit Toposolid)
 * later without rewriting the geometry, because a converter that only knows
 * `TinSurface → BufferGeometry` does not care who owns the surface.
 *
 * The three transforms that MUST happen exactly once, and happen here:
 *   1. LOCAL → WORLD  — `TinSurface.positions` are local (world − origin, so the CDT math runs
 *      near 0,0 for ΕΓΣΑ'87 magnitudes ~1e6). `elevations` are ALREADY world Z — do not offset.
 *   2. plan-mm → three world (m, Y-up) — via `writeDxfPlanToWorld`, the same convention the
 *      grips/ghosts/snap markers use. Never re-inlined here.
 *   3. indexed → non-indexed + computed normals — a TIN is a set of PLANAR FACETS; flat
 *      shading is the truthful read of it (Revit Toposolid, Civil 3D 3D-faces). Smooth normals
 *      would round off the very breaklines the CDT was constrained to preserve.
 */

import * as THREE from 'three';
import type { TinSurface, TerrainSurfaceStyle } from '../../systems/topography/topo-types';
import type { ElevationReference } from '../../systems/topography/cut-fill';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { writeDxfPlanToWorld } from '../viewport/coordinate-transforms';
import { writeTerrainRampColor, writeTerrainCutFillColor } from './terrain-elevation-ramp';

/**
 * ADR-650 M6/M10b — the per-build inputs the converter needs but must NOT read from a store: the
 * converter stays pure (a store import here would drag the survey/geo stores into every 3D unit
 * test and break the «promote to Toposolid without a geometry rewrite» property). Both are resolved
 * by the impure caller (`TerrainSceneLayer`) and passed IN.
 */
export interface TinShadingOptions {
  /** The volume reference (design level / proposed ground). Required by the `cutfill` style. */
  readonly reference?: ElevationReference | null;
  /**
   * ADR-650 M10b — the active WORLD (ΕΓΣΑ) → building-DISPLAY projector. Seats the terrain UNDER
   * the building in 3D (mirror of the 2D contour re-projection). Omitted/identity → the mesh keeps
   * rendering in ΕΓΣΑ world exactly as before (backward compatible). The cut/fill COLOURS are never
   * projected — they compare Z against the reference in WORLD coords (see `buildCutFillColors`).
   */
  readonly projector?: WorldToDisplayProjector | null;
}

/**
 * Build the terrain mesh geometry, or `null` when there is nothing to draw (no triangles,
 * or a surface carrying non-finite coordinates).
 *
 * The `null` on non-finite is load-bearing, not defensive noise: a single NaN vertex makes the
 * mesh's `Box3` NaN, and a NaN bounding box poisons frustum culling / camera fit into blanking
 * the WHOLE 3D scene (ADR-537). Refusing to build is strictly better than blanking the model.
 */
export function tinToBufferGeometry(
  tin: TinSurface,
  style: TerrainSurfaceStyle,
  options?: TinShadingOptions,
): THREE.BufferGeometry | null {
  if (tin.triangles.length === 0) return null;

  const positions = buildPositions(tin, options?.projector ?? null);
  if (!positions) return null;

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const colors = buildStyleColors(tin, style, options?.reference ?? null);
  if (colors) {
    indexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  indexed.setIndex(new THREE.BufferAttribute(buildIndices(tin), 1));

  // Facet the surface: every triangle gets its own 3 vertices → per-face normals.
  const faceted = indexed.toNonIndexed();
  indexed.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

/** Vertex XYZ in three-world metres, or `null` if any coordinate is non-finite. */
function buildPositions(tin: TinSurface, projector: WorldToDisplayProjector | null): Float32Array | null {
  const count = tin.positions.length;
  const out = new Float32Array(count * 3);
  const project = projector && !projector.isIdentity ? projector : null; // fast path when unset/identity

  for (let i = 0; i < count; i++) {
    const local = tin.positions[i]!;
    const worldXMm = local[0] + tin.origin.x; // TIN-LOCAL → ΕΓΣΑ WORLD (planimetric only)
    const worldYMm = local[1] + tin.origin.y;
    const elevMm = tin.elevations[i] ?? 0; // already WORLD Z — geo-ref is planar, never offsets Z

    if (!Number.isFinite(worldXMm) || !Number.isFinite(worldYMm) || !Number.isFinite(elevMm)) {
      return null;
    }
    // ADR-650 M10b: ΕΓΣΑ WORLD → building-DISPLAY so the hill seats under the building (mirror 2D).
    const plan = project ? project.project(worldXMm, worldYMm) : null;
    writeDxfPlanToWorld(out, i * 3, plan ? plan.x : worldXMm, plan ? plan.y : worldYMm, elevMm);
  }
  return out;
}

/** Triangle vertex indices, flattened. Uint32 — a survey TIN routinely exceeds 65 535 vertices. */
function buildIndices(tin: TinSurface): Uint32Array {
  const out = new Uint32Array(tin.triangles.length * 3);
  for (let t = 0; t < tin.triangles.length; t++) {
    const tri = tin.triangles[t]!;
    out[t * 3] = tri[0];
    out[t * 3 + 1] = tri[1];
    out[t * 3 + 2] = tri[2];
  }
  return out;
}

/** Per-vertex colours for the analysis styles, or `null` for `shaded` (one flat earth material). */
function buildStyleColors(
  tin: TinSurface,
  style: TerrainSurfaceStyle,
  reference: ElevationReference | null,
): Float32Array | null {
  if (style === 'hypsometric') return buildElevationColors(tin);
  if (style === 'cutfill' && reference) return buildCutFillColors(tin, reference);
  return null; // `shaded`, or `cutfill` with no reference yet — the earth material carries it
}

/**
 * Per-vertex hypsometric colour, normalised over the surface's OWN vertical range
 * (`bounds.minZ..maxZ`, world mm). A perfectly flat surface has zero range → every vertex
 * takes the ramp's low tone rather than dividing by zero.
 */
function buildElevationColors(tin: TinSurface): Float32Array {
  const count = tin.positions.length;
  const out = new Float32Array(count * 3);
  const span = tin.bounds.maxZ - tin.bounds.minZ;

  for (let i = 0; i < count; i++) {
    const elevMm = tin.elevations[i] ?? 0;
    const t = span > 0 ? (elevMm - tin.bounds.minZ) / span : 0;
    writeTerrainRampColor(out, i * 3, t);
  }
  return out;
}

/**
 * ADR-650 M6 — per-vertex CUT/FILL colour (Civil 3D «Cut/Fill analysis»): red where the ground
 * stands above the reference (excavate), blue where it lies below (fill), pale on the zero line.
 *
 * Normalised SYMMETRICALLY over the largest |Δz| on the surface, so the zero line always lands
 * on the ramp's midpoint. Normalising over `min..max` instead — the hypsometric way — would put
 * the pale band wherever the extremes happened to fall, and an all-cut site would show a
 * "balance line" that does not exist. A vertex the reference cannot answer for keeps the neutral
 * mid-tone: unknown ground is not zero-cut ground (the volume table skips it too).
 */
function buildCutFillColors(tin: TinSurface, reference: ElevationReference): Float32Array {
  const count = tin.positions.length;
  const out = new Float32Array(count * 3);
  const deltas = new Array<number | null>(count);

  let maxAbs = 0;
  for (let i = 0; i < count; i++) {
    const local = tin.positions[i]!;
    const targetZ = reference.zAtMm(local[0] + tin.origin.x, local[1] + tin.origin.y);
    const dz = targetZ === null ? null : (tin.elevations[i] ?? 0) - targetZ;
    deltas[i] = dz;
    if (dz !== null && Number.isFinite(dz)) maxAbs = Math.max(maxAbs, Math.abs(dz));
  }

  for (let i = 0; i < count; i++) {
    const dz = deltas[i];
    const t = dz === null || maxAbs === 0 ? 0.5 : 0.5 + (dz / maxAbs) * 0.5;
    writeTerrainCutFillColor(out, i * 3, t);
  }
  return out;
}
