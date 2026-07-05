/**
 * ADR-408 Εύρος Β #3 — Underfloor heating loop parametric grip handlers.
 *
 * Pure functions (zero React / DOM / Firestore / canvas deps). Pattern mirrors
 * `bim/floor-finishes/floor-finish-grips.ts` (ADR-419) and `bim/slabs/slab-grips.ts`
 * (ADR-363 Phase 3.5 / 3.6):
 *
 *   - `mep-underfloor-vertex-N`        → translate footprint vertex N (XY only,
 *                                         z preserved). Mirrors floor-finish-vertex.
 *   - `mep-underfloor-edge-midpoint-N` → insert new vertex at edge [N, N+1]
 *                                         midpoint + delta. Mirrors floor-finish-edge-midpoint.
 *
 * Rectilinear constraint: when `input.rectilinear` is true the delta is
 * quantized to the dominant world axis (Ortho / Shift-constrained).
 *
 * After a footprint edit the params' `connectors` are re-derived via
 * `buildUnderfloorConnectors` so the loop-entry connectors follow the polygon.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepUnderfloorGripKind } from '../../hooks/grip-types';
import type { Point3D } from '../types/bim-base';
import type { MepUnderfloorEntity, MepUnderfloorParams } from '../types/mep-underfloor-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import { buildUnderfloorConnectors } from './mep-underfloor-geometry';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta'; // ORTHO/F8 SSoT
import { parseGripKindIndex } from '../../systems/grip/grip-kind-index';

// ─── Grip position computation ────────────────────────────────────────────────

/**
 * Compute the parametric grip positions for a `MepUnderfloorEntity`. For a
 * polygon with `N` vertices returns `2N` grips in stable index order:
 *
 *   - indices `[0, N)`   → `mep-underfloor-vertex-i` at vertex `i`
 *   - indices `[N, 2N)`  → `mep-underfloor-edge-midpoint-(i-N)` at midpoint
 *                           of edge `[i-N, ((i-N)+1) mod N]`
 */
export function getMepUnderfloorGrips(entity: Readonly<MepUnderfloorEntity>): GripInfo[] {
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
      mepUnderfloorGripKind: `mep-underfloor-vertex-${i}`,
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
      mepUnderfloorGripKind: `mep-underfloor-edge-midpoint-${i}`,
    });
  }
  return grips;
}

// ─── Drag input ───────────────────────────────────────────────────────────────

export interface MepUnderfloorGripDragInput {
  readonly originalParams: MepUnderfloorParams;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

// ─── Drag transform ───────────────────────────────────────────────────────────

/**
 * Pure transform: underfloor grip kind + drag input → new `MepUnderfloorParams`.
 * Geometry and connectors are NOT recomputed here — the caller
 * (`UpdateMepUnderfloorParamsCommand`) calls `computeMepUnderfloorGeometry()` +
 * `buildUnderfloorConnectors()` (SSoT). Returns `originalParams` unchanged on
 * out-of-range index (no-op signal to caller).
 */
export function applyMepUnderfloorGripDrag(
  gripKind: MepUnderfloorGripKind,
  input: Readonly<MepUnderfloorGripDragInput>,
): MepUnderfloorParams {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;

  if (gripKind.startsWith('mep-underfloor-vertex-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return moveFootprintVertex(input.originalParams, delta, idx);
  }
  if (gripKind.startsWith('mep-underfloor-edge-midpoint-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return insertVertexOnEdge(input.originalParams, delta, idx);
  }
  return input.originalParams;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function moveFootprintVertex(
  originalParams: MepUnderfloorParams,
  delta: Point2D,
  index: number,
): MepUnderfloorParams {
  const verts = originalParams.footprint.vertices;
  if (index >= verts.length) return originalParams;
  if (delta.x === 0 && delta.y === 0) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index ? translateVertex(v, delta) : cloneVertex(v),
  );
  const updatedParams = { ...originalParams, footprint: { vertices: next } };
  return recomputeConnectors(updatedParams);
}

function insertVertexOnEdge(
  originalParams: MepUnderfloorParams,
  delta: Point2D,
  edgeIndex: number,
): MepUnderfloorParams {
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
  const updatedParams = { ...originalParams, footprint: { vertices: next } };
  return recomputeConnectors(updatedParams);
}

function translateVertex(v: Point3D, delta: Point2D): Point3D {
  return { x: v.x + delta.x, y: v.y + delta.y, ...(v.z !== undefined ? { z: v.z } : {}) };
}

function cloneVertex(v: Point3D): Point3D {
  return { x: v.x, y: v.y, ...(v.z !== undefined ? { z: v.z } : {}) };
}

/**
 * Re-derive `connectors` from the updated footprint so the loop-entry connectors
 * stay coincident with the polygon edge as the user edits the boundary.
 * Pure SSoT delegation to `buildUnderfloorConnectors`.
 */
function recomputeConnectors(params: MepUnderfloorParams): MepUnderfloorParams {
  const connectors = buildUnderfloorConnectors(params);
  return { ...params, connectors };
}
