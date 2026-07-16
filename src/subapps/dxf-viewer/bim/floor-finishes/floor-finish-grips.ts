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
 * The emit loop + vertex/edge/remove math live in the shared polygon-outline SSoT
 * (`bim/grips/polygon-outline-grip-core`) — this file owns only the floor-finish
 * `footprint.vertices` container.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md §4
 * @see bim/grips/polygon-outline-grip-core.ts — shared emit + edit SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, FloorFinishGripKind } from '../../hooks/grip-types';
import type { FloorFinishEntity, FloorFinishParams } from '../types/floor-finish-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import {
  buildPolygonOutlineGrips,
  applyPolygonOutlineGripDrag,
  removeOutlineVertexInList,
} from '../grips/polygon-outline-grip-core';

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
  return buildPolygonOutlineGrips(entity.id, verts, 'floor-finish');
}

// ─── Drag input ───────────────────────────────────────────────────────────────

export interface FloorFinishGripDragInput {
  readonly originalParams: FloorFinishParams;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

// ─── Drag transform ───────────────────────────────────────────────────────────

/**
 * Pure transform: floor-finish grip kind + drag input → new `FloorFinishParams`
 * (`floor-finish-vertex-N` → move, `floor-finish-edge-midpoint-N` → insert), via the
 * shared polygon-outline dispatch. Geometry is NOT recomputed here — the caller
 * (`UpdateFloorFinishParamsCommand`) calls `computeFloorFinishGeometry()` (SSoT).
 * No-op → `originalParams` unchanged (commit-merge short-circuit).
 */
export function applyFloorFinishGripDrag(
  gripKind: FloorFinishGripKind,
  input: Readonly<FloorFinishGripDragInput>,
): FloorFinishParams {
  return applyPolygonOutlineGripDrag(
    gripKind,
    'floor-finish',
    input,
    (p) => p.footprint.vertices,
    (p, vertices) => ({ ...p, footprint: { vertices } }),
  );
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
  const next = removeOutlineVertexInList(originalParams.footprint.vertices, vertexIndex);
  return next ? { ...originalParams, footprint: { vertices: next } } : originalParams;
}
