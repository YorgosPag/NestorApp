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
 * The emit loop + vertex/edge math live in the shared polygon-outline SSoT
 * (`bim/grips/polygon-outline-grip-core`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see bim/grips/polygon-outline-grip-core.ts — shared emit + edit SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepUnderfloorGripKind } from '../../hooks/grip-types';
import type { MepUnderfloorEntity, MepUnderfloorParams } from '../types/mep-underfloor-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import { buildUnderfloorConnectors } from './mep-underfloor-geometry';
import {
  buildPolygonOutlineGrips,
  applyPolygonOutlineGripDrag,
} from '../grips/polygon-outline-grip-core';

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
  return buildPolygonOutlineGrips(entity.id, verts, 'mep-underfloor');
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
  // `withVerts` re-derives `connectors` after every footprint edit, so both the
  // move and insert branches stay coincident with the polygon (SSoT delegation).
  return applyPolygonOutlineGripDrag(
    gripKind,
    'mep-underfloor',
    input,
    (p) => p.footprint.vertices,
    (p, vertices) => recomputeConnectors({ ...p, footprint: { vertices } }),
  );
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
