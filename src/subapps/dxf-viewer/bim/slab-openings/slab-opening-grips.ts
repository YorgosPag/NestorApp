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
 * SSoT:
 *   - Geometry math via `computeSlabOpeningGeometry()` (called by
 *     `UpdateSlabOpeningParamsCommand` at commit time — this module returns
 *     ONLY new `SlabOpeningParams`).
 *   - Grip wire-up via the unified grip system (`SlabOpeningRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.7a
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, SlabOpeningGripKind } from '../../hooks/useGripMovement';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { parseGripKindIndex } from '../../systems/grip/grip-kind-index';
import type { Point3D } from '../types/bim-base';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../types/slab-opening-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import { isManagedOpeningParams } from '../stairs/managed-slab-opening-lock';

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
  const grips: GripInfo[] = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    grips.push({
      entityId: entity.id,
      gripIndex: i,
      type: 'vertex',
      position: { x: v.x, y: v.y },
      movesEntity: false,
      gripKind: { on: 'slab-opening', kind: `slab-opening-vertex-${i}` },
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
      gripKind: { on: 'slab-opening', kind: `slab-opening-edge-midpoint-${i}` },
    });
  }
  return grips;
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
 * Pure transform: slab-opening grip kind + drag input → new `SlabOpeningParams`.
 * Geometry δεν recomputed εδώ — caller (`UpdateSlabOpeningParamsCommand.execute`)
 * καλεί `computeSlabOpeningGeometry()` ώστε math SSoT μένει σε ένα σημείο
 * και command merging preserves το original delta semantics.
 *
 * Για `slab-opening-vertex-N` ο numeric index `N` parsed από το discriminator
 * suffix· out-of-range index γυρνά `originalParams` αναλλοίωτο ώστε ο caller
 * να short-circuit το commit (no-op). Για `slab-opening-edge-midpoint-N`
 * φρέσκο vertex εισάγεται στο `midpoint(verts[N], verts[(N+1) mod len]) +
 * delta`, splitting την edge.
 */
export function applySlabOpeningGripDrag(
  gripKind: SlabOpeningGripKind,
  input: Readonly<SlabOpeningGripDragInput>,
): SlabOpeningParams {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  if (gripKind.startsWith('slab-opening-vertex-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return moveOutlineVertex(input.originalParams, delta, idx);
  }
  if (gripKind.startsWith('slab-opening-edge-midpoint-')) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    return insertVertexOnEdge(input.originalParams, delta, idx);
  }
  return input.originalParams;
}


function moveOutlineVertex(
  originalParams: SlabOpeningParams,
  delta: Point2D,
  index: number,
): SlabOpeningParams {
  const verts = originalParams.outline.vertices;
  if (index >= verts.length) return originalParams;
  if (delta.x === 0 && delta.y === 0) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index ? translatePoint(v, delta) : cloneVertex(v),
  );
  return {
    ...originalParams,
    outline: { vertices: next },
  };
}

function insertVertexOnEdge(
  originalParams: SlabOpeningParams,
  delta: Point2D,
  edgeIndex: number,
): SlabOpeningParams {
  const verts = originalParams.outline.vertices;
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
  return {
    ...originalParams,
    outline: { vertices: next },
  };
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
  const verts = originalParams.outline.vertices;
  if (verts.length <= 3) return originalParams;
  if (vertexIndex < 0 || vertexIndex >= verts.length) return originalParams;
  return {
    ...originalParams,
    outline: { vertices: verts.filter((_, i) => i !== vertexIndex) },
  };
}

function cloneVertex(v: Point3D): Point3D {
  return v.z !== undefined ? { x: v.x, y: v.y, z: v.z } : { x: v.x, y: v.y };
}
