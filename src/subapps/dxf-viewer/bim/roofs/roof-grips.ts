/**
 * ADR-417 Φ1-part-2 #2 — Roof parametric grip handlers (Revit «Edit Footprint»).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/slabs/slab-grips.ts` (ADR-363 Phase 3.5 / 3.6 / 3.8) and
 * exposes two grip families:
 *
 *   - `roof-vertex-N`        → translate footprint outline vertex N (XY only,
 *                              z preserved). `edges` stays untouched (same count,
 *                              the vertex just moves).
 *   - `roof-edge-midpoint-N` → insert a new vertex at edge `[N, N+1]` midpoint
 *                              + delta, splitting that edge. Index `N` wraps
 *                              modulo `vertices.length` so the closing edge
 *                              (last → first) is reachable.
 *
 * 🔑 CRITICAL — `edges` ↔ `vertices` lockstep (≠ slab):
 *   `RoofParams.edges` is PARALLEL to `outline.vertices` (one `RoofEdgeSlope`
 *   per footprint edge). `UpdateRoofParamsCommand.validate()` hard-requires
 *   `edges.length === outline.vertices.length` — any mismatch rejects the
 *   command. Therefore every grip op keeps the two arrays in lockstep:
 *     - move vertex   → `edges` unchanged (count preserved).
 *     - insert vertex → splice a COPY of `edges[N]` at index `N+1` (the new sub-
 *                       edge inherits the split edge's slope / definesSlope /
 *                       overhang — Revit «split keeps the parent slope»).
 *     - delete vertex → filter BOTH `outline.vertices[i]` AND `edges[i]`.
 *
 * Rectilinear constraint: when `input.rectilinear` is true the caller's `delta`
 * is quantized to the dominant world axis before mutation (mirror slab Phase 3.6
 * / Revit Shift-constrained vertex drag).
 *
 * SSoT:
 *   - Geometry math via `computeRoofGeometry()` (called by
 *     `UpdateRoofParamsCommand` at commit time — this module returns ONLY new
 *     `RoofParams`). FOOTPRINT ⊥ TYPE: grips edit the footprint recipe, never
 *     the derived solid.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see bim/slabs/slab-grips.ts — το πρότυπο (clone)
 */

import type { Point2D } from '../../rendering/types/Types';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta'; // ORTHO/F8 SSoT
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { parseGripKindIndex } from '../../systems/grip/grip-kind-index';
import type { GripInfo, RoofGripKind } from '../../hooks/useGripMovement';
import type { Point3D } from '../types/bim-base';
import type { RoofEntity, RoofParams, RoofEdgeSlope } from '../types/roof-types';

// ─── Grip position computation ───────────────────────────────────────────────

/**
 * Compute the parametric grip positions for a `RoofEntity`. For a footprint
 * polygon with `N` vertices returns `2N` grips in stable index order:
 *
 *   - indices `[0, N)`   → `roof-vertex-i` at footprint vertex `i`
 *   - indices `[N, 2N)`  → `roof-edge-midpoint-(i - N)` at the midpoint of
 *                          edge `[i - N, ((i - N) + 1) mod N]`
 *
 * Returns an empty array when the polygon is degenerate (<3 vertices). Reads
 * vertices directly from `params.outline.vertices` (roof is a DIRECT entity;
 * `getBimEntityKeyPoints2D` does not handle the 'roof' type).
 */
export function getRoofGrips(entity: Readonly<RoofEntity>): GripInfo[] {
  const verts = entity.params?.outline?.vertices ?? [];
  if (verts.length < 3) return [];
  const grips: GripInfo[] = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    grips.push({
      entityId: entity.id,
      gripIndex: i,
      type: 'vertex',
      position: { x: v.x, y: v.y },
      movesEntity: false,
      gripKind: { on: 'roof', kind: `roof-vertex-${i}` },
    });
  }
  const offset = verts.length;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    grips.push({
      entityId: entity.id,
      gripIndex: offset + i,
      type: 'midpoint',
      position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      movesEntity: false,
      edgeVertexIndices: [i, (i + 1) % verts.length],
      gripKind: { on: 'roof', kind: `roof-edge-midpoint-${i}` },
    });
  }
  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface RoofGripDragInput {
  /** Original params at drag start (preserves edges / slopeUnit / thickness / dna). */
  readonly originalParams: RoofParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** When true, quantize `delta` to the dominant world axis (Shift / orthogonal). */
  readonly rectilinear?: boolean;
}

/**
 * Pure transform: roof grip kind + drag input → new `RoofParams`. Geometry is
 * NOT recomputed here — the caller (`UpdateRoofParamsCommand.execute`) calls
 * `computeRoofGeometry()` so the math SSoT stays in one place.
 *
 * For `roof-vertex-N` the numeric index `N` is parsed from the discriminator
 * suffix; an out-of-range index yields `originalParams` unchanged so the caller
 * can short-circuit the commit (no-op). For `roof-edge-midpoint-N` a fresh
 * vertex is inserted at `midpoint(verts[N], verts[(N+1) mod len]) + delta` and a
 * COPY of `edges[N]` is spliced at `N+1` so `edges` stays in lockstep.
 */
export function applyRoofGripDrag(
  gripKind: RoofGripKind,
  input: Readonly<RoofGripDragInput>,
): RoofParams {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  if (gripKind.startsWith('roof-vertex-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return moveOutlineVertex(input.originalParams, delta, idx);
  }
  if (gripKind.startsWith('roof-edge-midpoint-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return insertVertexOnEdge(input.originalParams, delta, idx);
  }
  return input.originalParams;
}

function moveOutlineVertex(
  originalParams: RoofParams,
  delta: Point2D,
  index: number,
): RoofParams {
  const verts = originalParams.outline.vertices;
  if (index >= verts.length) return originalParams;
  if (delta.x === 0 && delta.y === 0) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index ? translatePoint(v, delta) : cloneVertex(v),
  );
  // edges count is preserved — a moved vertex keeps the same edge topology.
  return {
    ...originalParams,
    outline: { vertices: next },
  };
}

function insertVertexOnEdge(
  originalParams: RoofParams,
  delta: Point2D,
  edgeIndex: number,
): RoofParams {
  const verts = originalParams.outline.vertices;
  const edges = originalParams.edges;
  if (edgeIndex >= verts.length) return originalParams;
  const a = verts[edgeIndex];
  const b = verts[(edgeIndex + 1) % verts.length];
  const inserted: Point3D = {
    x: (a.x + b.x) / 2 + delta.x,
    y: (a.y + b.y) / 2 + delta.y,
    ...(a.z !== undefined || b.z !== undefined
      ? { z: ((a.z ?? 0) + (b.z ?? 0)) / 2 }
      : {}),
  };
  const nextVerts: Point3D[] = [];
  const nextEdges: RoofEdgeSlope[] = [];
  for (let i = 0; i < verts.length; i++) {
    nextVerts.push(cloneVertex(verts[i]));
    nextEdges.push(cloneEdge(edges[i]));
    if (i === edgeIndex) {
      nextVerts.push(inserted);
      // The new sub-edge inherits the split edge's slope (Revit «split keeps
      // the parent slope»). Keeps `edges.length === vertices.length`.
      nextEdges.push(cloneEdge(edges[edgeIndex]));
    }
  }
  return {
    ...originalParams,
    outline: { vertices: nextVerts },
    edges: nextEdges,
  };
}

/**
 * Remove a vertex from the roof footprint by index. Guard: returns
 * `originalParams` unchanged when `vertices.length <= 3` (minimum triangle) or
 * when `index` is out of range. Filters BOTH `outline.vertices[index]` AND
 * `edges[index]` so the parallel arrays stay in lockstep (validate() requires
 * `edges.length === vertices.length`). Callers MUST check the return value
 * identity to detect no-ops.
 */
export function removeVertexFromRoof(
  originalParams: RoofParams,
  vertexIndex: number,
): RoofParams {
  const verts = originalParams.outline.vertices;
  if (verts.length <= 3) return originalParams;
  if (vertexIndex < 0 || vertexIndex >= verts.length) return originalParams;
  return {
    ...originalParams,
    outline: { vertices: verts.filter((_, i) => i !== vertexIndex) },
    edges: originalParams.edges.filter((_, i) => i !== vertexIndex),
  };
}

function cloneVertex(v: Point3D): Point3D {
  return v.z !== undefined ? { x: v.x, y: v.y, z: v.z } : { x: v.x, y: v.y };
}

function cloneEdge(e: RoofEdgeSlope): RoofEdgeSlope {
  return { definesSlope: e.definesSlope, slope: e.slope, overhangMm: e.overhangMm };
}
