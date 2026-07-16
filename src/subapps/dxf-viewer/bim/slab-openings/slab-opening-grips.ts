/**
 * ADR-363 Phase 3.7a — Slab-opening parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/slabs/slab-grips.ts` (Phase 3.5 / 3.6) and exposes two
 * grip families described in ADR-363 §6 Phase 3.7a:
 *
 *   - `slab-opening-vertex-N`        → translate polygon outline vertex N
 *                                      (XY only, z preserved).
 *   - `slab-opening-edge-midpoint-N` → insert a new vertex at edge `[N, N+1]`
 *                                      midpoint + delta. Index `N` wraps modulo
 *                                      `vertices.length` so the closing edge
 *                                      (last → first) is reachable.
 *
 * Rectilinear constraint: when `input.rectilinear` is true the caller's
 * `delta` is quantized to the dominant world axis before mutation
 * (`|dx| ≥ |dy|` → keep dx, dy=0; otherwise keep dy, dx=0). Mirrors AutoCAD
 * "Ortho" + Revit Shift-constrained vertex drag.
 *
 * The emit loop + vertex/edge/remove math live in the shared polygon-outline SSoT
 * (`bim/grips/polygon-outline-grip-core`) — this file owns only the managed-opening
 * lock guard, the `outline.vertices` container and geometry re-compute wiring.
 *
 * SSoT:
 *   - Geometry math via `computeSlabOpeningGeometry()` (called by
 *     `UpdateSlabOpeningParamsCommand` at commit time — this module returns
 *     ONLY new `SlabOpeningParams`).
 *   - Grip wire-up via the unified grip system (`SlabOpeningRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.7a
 * @see bim/grips/polygon-outline-grip-core.ts — shared emit + edit SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, SlabOpeningGripKind } from '../../hooks/useGripMovement';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../types/slab-opening-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import { isManagedOpeningParams } from '../stairs/managed-slab-opening-lock';
import {
  buildPolygonOutlineGrips,
  applyPolygonOutlineGripDrag,
  removeOutlineVertexInList,
} from '../grips/polygon-outline-grip-core';

// ─── Grip position computation (ADR-363 §6 Phase 3.7a) ───────────────────────

/**
 * Compute the parametric grip positions for a `SlabOpeningEntity`. For a
 * polygon με `N` vertices returns `2N` grips σε stable index order:
 *
 *   - indices `[0, N)`     → `slab-opening-vertex-i` στο vertex `i`
 *   - indices `[N, 2N)`    → `slab-opening-edge-midpoint-(i - N)` στο midpoint
 *                            της edge `[i - N, ((i - N) + 1) mod N]`
 *
 * Returns empty array όταν polygon degenerate (<3 vertices).
 */
export function getSlabOpeningGrips(entity: Readonly<SlabOpeningEntity>): GripInfo[] {
  // ADR-632 Φ5 — managed (engine-owned) opening = κλειδωμένο: μηδέν grip handles
  // (Revit locked/hosted family instance). Ο χρήστης κάνει Override για να το
  // επεξεργαστεί. Detached (μετά το Override) → κανονικά grips.
  if (isManagedOpeningParams(entity.params)) return [];
  const verts = getBimEntityKeyPoints2D(entity as Entity);
  if (verts.length < 3) return [];
  return buildPolygonOutlineGrips(entity.id, verts, 'slab-opening');
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface SlabOpeningGripDragInput {
  /** Original params at drag start (preserves outline / kind / slabId / metadata). */
  readonly originalParams: SlabOpeningParams;
  /** World-space delta από drag anchor προς τρέχουσα cursor position. */
  readonly delta: Point2D;
  /**
   * Όταν true, quantize `delta` στον dominant world axis (orthogonal
   * constraint). Surfaced via Shift modifier στο commit time.
   */
  readonly rectilinear?: boolean;
}

/**
 * Pure transform: slab-opening grip kind + drag input → new `SlabOpeningParams`
 * (`slab-opening-vertex-N` → move, `slab-opening-edge-midpoint-N` → insert), via the
 * shared polygon-outline dispatch. Geometry δεν recomputed εδώ — ο caller
 * (`UpdateSlabOpeningParamsCommand.execute`) καλεί `computeSlabOpeningGeometry()`.
 * No-op → `originalParams` αναλλοίωτο (commit-merge short-circuit).
 */
export function applySlabOpeningGripDrag(
  gripKind: SlabOpeningGripKind,
  input: Readonly<SlabOpeningGripDragInput>,
): SlabOpeningParams {
  return applyPolygonOutlineGripDrag(
    gripKind,
    'slab-opening',
    input,
    (p) => p.outline.vertices,
    (p, vertices) => ({ ...p, outline: { vertices } }),
  );
}

/**
 * ADR-535 Φ4 — Remove a vertex from the slab-opening outline by index. Mirror of
 * `removeVertexFromSlab` (and `removeVertexFromRoof`): guard returns
 * `originalParams` unchanged when `vertices.length <= 3` (minimum triangle) or when
 * `index` is out of range. Callers MUST check the return-value identity to detect a
 * no-op. Geometry is NOT recomputed here — the caller's `UpdateSlabOpeningParamsCommand`
 * recomputes via `computeSlabOpeningGeometry()` (math SSoT in one place).
 */
export function removeVertexFromSlabOpening(
  originalParams: SlabOpeningParams,
  vertexIndex: number,
): SlabOpeningParams {
  const next = removeOutlineVertexInList(originalParams.outline.vertices, vertexIndex);
  return next ? { ...originalParams, outline: { vertices: next } } : originalParams;
}
