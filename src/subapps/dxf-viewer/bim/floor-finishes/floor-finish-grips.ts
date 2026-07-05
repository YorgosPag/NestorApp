/**
 * ADR-419 — Floor finish parametric grip handlers.
 *
 * Pure functions (zero React / DOM / Firestore / canvas deps). Pattern mirrors
 * `bim/slabs/slab-grips.ts` (ADR-363 Phase 3.5 / 3.6):
 *
 *   - `floor-finish-vertex-N`        → translate footprint vertex N (XY only,
 *                                       z preserved). Mirrors slab-vertex.
 *   - `floor-finish-edge-midpoint-N` → insert new vertex at edge [N, N+1]
 *                                       midpoint + delta. Mirrors slab-edge-midpoint.
 *
 * Rectilinear constraint: when `input.rectilinear` is true the delta is
 * quantized to the dominant world axis (Ortho / Shift-constrained).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md §4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, FloorFinishGripKind } from '../../hooks/grip-types';
import type { Point3D } from '../types/bim-base';
import type { FloorFinishEntity, FloorFinishParams } from '../types/floor-finish-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta';
import { parseGripKindIndex } from '../../systems/grip/grip-kind-index';

// ─── Grip position computation ────────────────────────────────────────────────

/**
 * Compute the parametric grip positions for a `FloorFinishEntity`. For a
 * polygon with `N` vertices returns `2N` grips in stable index order:
 *
 *   - indices `[0, N)`   → `floor-finish-vertex-i` at vertex `i`
 *   - indices `[N, 2N)`  → `floor-finish-edge-midpoint-(i-N)` at midpoint
 *                           of edge `[i-N, ((i-N)+1) mod N]`
 */
export function getFloorFinishGrips(entity: Readonly<FloorFinishEntity>): GripInfo[] {
  const verts = getBimEntityKeyPoints2D(entity as Entity);
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
      floorFinishGripKind: `floor-finish-vertex-${i}`,
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
      floorFinishGripKind: `floor-finish-edge-midpoint-${i}`,
    });
  }
  return grips;
}

// ─── Drag input ───────────────────────────────────────────────────────────────

export interface FloorFinishGripDragInput {
  readonly originalParams: FloorFinishParams;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

// ─── Drag transform ───────────────────────────────────────────────────────────

/**
 * Pure transform: floor-finish grip kind + drag input → new `FloorFinishParams`.
 * Geometry is NOT recomputed here — the caller (`UpdateFloorFinishParamsCommand`)
 * calls `computeFloorFinishGeometry()` (SSoT). Returns `originalParams`
 * unchanged on out-of-range index (no-op signal to caller).
 */
export function applyFloorFinishGripDrag(
  gripKind: FloorFinishGripKind,
  input: Readonly<FloorFinishGripDragInput>,
): FloorFinishParams {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;

  if (gripKind.startsWith('floor-finish-vertex-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return moveFootprintVertex(input.originalParams, delta, idx);
  }
  if (gripKind.startsWith('floor-finish-edge-midpoint-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return insertVertexOnEdge(input.originalParams, delta, idx);
  }
  return input.originalParams;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function moveFootprintVertex(
  originalParams: FloorFinishParams,
  delta: Point2D,
  index: number,
): FloorFinishParams {
  const verts = originalParams.footprint.vertices;
  if (index >= verts.length) return originalParams;
  if (delta.x === 0 && delta.y === 0) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index ? translateVertex(v, delta) : cloneVertex(v),
  );
  return { ...originalParams, footprint: { vertices: next } };
}

function insertVertexOnEdge(
  originalParams: FloorFinishParams,
  delta: Point2D,
  edgeIndex: number,
): FloorFinishParams {
  const verts = originalParams.footprint.vertices;
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
  const next: Point3D[] = [];
  for (let i = 0; i < verts.length; i++) {
    next.push(cloneVertex(verts[i]));
    if (i === edgeIndex) next.push(inserted);
  }
  return { ...originalParams, footprint: { vertices: next } };
}

/**
 * ADR-535 Φ4 — Remove a vertex from the floor-finish footprint by index. Mirror of
 * `removeVertexFromSlab`: guard returns `originalParams` unchanged when
 * `vertices.length <= 3` (minimum triangle) or when `index` is out of range. Callers
 * MUST check the return-value identity to detect a no-op. Geometry is recomputed by
 * the caller's `UpdateFloorFinishParamsCommand` (math SSoT in one place).
 */
export function removeVertexFromFloorFinish(
  originalParams: FloorFinishParams,
  vertexIndex: number,
): FloorFinishParams {
  const verts = originalParams.footprint.vertices;
  if (verts.length <= 3) return originalParams;
  if (vertexIndex < 0 || vertexIndex >= verts.length) return originalParams;
  return { ...originalParams, footprint: { vertices: verts.filter((_, i) => i !== vertexIndex) } };
}

function translateVertex(v: Point3D, delta: Point2D): Point3D {
  return { x: v.x + delta.x, y: v.y + delta.y, ...(v.z !== undefined ? { z: v.z } : {}) };
}

function cloneVertex(v: Point3D): Point3D {
  return { x: v.x, y: v.y, ...(v.z !== undefined ? { z: v.z } : {}) };
}
