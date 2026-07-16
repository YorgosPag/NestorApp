/**
 * ADR-363 Phase 3.5 + 3.6 — Slab parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Exposes two grip
 * families described in ADR-363 §6 Phase 3.5 / 3.6:
 *
 *   - `slab-vertex-N`        → translate polygon outline vertex N (XY only,
 *                              z preserved). Phase 3.5.
 *   - `slab-edge-midpoint-N` → insert a new vertex at edge `[N, N+1]`
 *                              midpoint + delta. Phase 3.6. Index `N`
 *                              wraps modulo `vertices.length` so the closing
 *                              edge (last → first) is reachable.
 *
 * Rectilinear constraint (Phase 3.6): when `input.rectilinear` is true the
 * caller's `delta` is quantized to the dominant world axis before mutation
 * (`|dx| ≥ |dy|` → keep dx, dy=0; otherwise keep dy, dx=0). Mirrors AutoCAD
 * "Ortho" + Revit Shift-constrained vertex drag.
 *
 * The emit loop + vertex/edge/remove math live in the shared polygon-outline SSoT
 * (`bim/grips/polygon-outline-grip-core`) — this file owns only the slab-specific
 * container (`outline.vertices`), guards and geometry re-compute wiring.
 *
 * SSoT:
 *   - Geometry math via `computeSlabGeometry()` (called by
 *     `UpdateSlabParamsCommand` at commit time — this module returns ONLY
 *     new `SlabParams`).
 *   - Grip wire-up via the unified grip system (`SlabRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.5 / 3.6
 * @see bim/grips/polygon-outline-grip-core.ts — shared emit + edit SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, SlabGripKind } from '../../hooks/useGripMovement';
import type { SlabEntity, SlabParams } from '../types/slab-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import {
  buildPolygonOutlineGrips,
  applyPolygonOutlineGripDrag,
  removeOutlineVertexInList,
} from '../grips/polygon-outline-grip-core';

// ─── Grip position computation (ADR-363 §6 Phase 3.5 / 3.6) ──────────────────

/**
 * Compute the parametric grip positions for a `SlabEntity`. For a polygon
 * with `N` vertices returns `2N` grips in stable index order:
 *
 *   - indices `[0, N)`     → `slab-vertex-i` at vertex `i`
 *   - indices `[N, 2N)`    → `slab-edge-midpoint-(i - N)` at the midpoint of
 *                            edge `[i - N, ((i - N) + 1) mod N]`
 *
 * Returns an empty array when the polygon is degenerate (<3 vertices).
 */
export function getSlabGrips(entity: Readonly<SlabEntity>): GripInfo[] {
  // Degenerate polygon (<3 κορυφές) → μηδέν grips. Guard στο RAW outline, ΟΧΙ στα enriched
  // characteristic key-points (που μπορεί να πυκνώσουν/ανακατασκευάσουν ένα εκφυλισμένο outline).
  if (entity.params.outline.vertices.length < 3) return [];
  const verts = getBimEntityKeyPoints2D(entity as Entity);
  if (verts.length < 3) return [];
  return buildPolygonOutlineGrips(entity.id, verts, 'slab');
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface SlabGripDragInput {
  /** Original params at drag start (preserves outline / kind / thickness). */
  readonly originalParams: SlabParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /**
   * Phase 3.6 — when true, quantize `delta` to the dominant world axis
   * (orthogonal constraint). Surfaced via Shift modifier at commit time.
   */
  readonly rectilinear?: boolean;
}

/**
 * Pure transform: slab grip kind + drag input → new `SlabParams` (`slab-vertex-N`
 * → move, `slab-edge-midpoint-N` → insert), via the shared polygon-outline dispatch.
 * Geometry is NOT recomputed here — the caller (`UpdateSlabParamsCommand.execute`)
 * calls `computeSlabGeometry()` so the math SSoT stays in one place. A no-op returns
 * `originalParams` referentially unchanged for the commit-merge short-circuit.
 */
export function applySlabGripDrag(
  gripKind: SlabGripKind,
  input: Readonly<SlabGripDragInput>,
): SlabParams {
  return applyPolygonOutlineGripDrag(
    gripKind,
    'slab',
    input,
    (p) => p.outline.vertices,
    (p, vertices) => ({ ...p, outline: { vertices } }),
  );
}

/**
 * ADR-363 Phase 3.8 — Remove a vertex from the slab outline by index.
 * Guard: returns `originalParams` unchanged when `vertices.length <= 3`
 * (minimum triangle) or when `index` is out of range. Callers MUST check
 * the return value identity to detect a no-op.
 */
export function removeVertexFromSlab(
  originalParams: SlabParams,
  vertexIndex: number,
): SlabParams {
  const next = removeOutlineVertexInList(originalParams.outline.vertices, vertexIndex);
  return next ? { ...originalParams, outline: { vertices: next } } : originalParams;
}
