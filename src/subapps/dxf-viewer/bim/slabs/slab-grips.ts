/**
 * ADR-363 Phase 3.5 + 3.6 — Slab parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/walls/opening-grips.ts` (ADR-363 Phase 2.5) and exposes two
 * grip families described in ADR-363 §6 Phase 3.5 / 3.6:
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
 * SSoT:
 *   - Geometry math via `computeSlabGeometry()` (called by
 *     `UpdateSlabParamsCommand` at commit time — this module returns ONLY
 *     new `SlabParams`).
 *   - Grip wire-up via the unified grip system (`SlabRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.5 / 3.6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, SlabGripKind } from '../../hooks/useGripMovement';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta';
import type { Point3D } from '../types/bim-base';
import type { SlabEntity, SlabParams } from '../types/slab-types';
import type { Entity } from '../../types/entities';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';

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
      slabGripKind: `slab-vertex-${i}`,
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
      slabGripKind: `slab-edge-midpoint-${i}`,
    });
  }
  return grips;
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
 * Pure transform: slab grip kind + drag input → new `SlabParams`. Geometry is
 * NOT recomputed here — the caller (`UpdateSlabParamsCommand.execute`) calls
 * `computeSlabGeometry()` so the math SSoT stays in one place and command
 * merging preserves the original delta semantics.
 *
 * For `slab-vertex-N` the numeric index `N` is parsed from the discriminator
 * suffix; an out-of-range index yields `originalParams` unchanged so the
 * caller can short-circuit the commit (no-op). For `slab-edge-midpoint-N`
 * a fresh vertex is inserted at `midpoint(verts[N], verts[(N+1) mod len]) +
 * delta`, splitting that edge.
 */
export function applySlabGripDrag(
  gripKind: SlabGripKind,
  input: Readonly<SlabGripDragInput>,
): SlabParams {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  if (gripKind.startsWith('slab-vertex-')) {
    const idx = parseInt(gripKind.slice('slab-vertex-'.length), 10);
    if (!Number.isFinite(idx) || idx < 0) return input.originalParams;
    return moveOutlineVertex(input.originalParams, delta, idx);
  }
  if (gripKind.startsWith('slab-edge-midpoint-')) {
    const idx = parseInt(gripKind.slice('slab-edge-midpoint-'.length), 10);
    if (!Number.isFinite(idx) || idx < 0) return input.originalParams;
    return insertVertexOnEdge(input.originalParams, delta, idx);
  }
  return input.originalParams;
}


function moveOutlineVertex(
  originalParams: SlabParams,
  delta: Point2D,
  index: number,
): SlabParams {
  const verts = originalParams.outline.vertices;
  if (index >= verts.length) return originalParams;
  if (delta.x === 0 && delta.y === 0) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index ? translateVertex(v, delta) : cloneVertex(v),
  );
  return {
    ...originalParams,
    outline: { vertices: next },
  };
}

function insertVertexOnEdge(
  originalParams: SlabParams,
  delta: Point2D,
  edgeIndex: number,
): SlabParams {
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
 * ADR-363 Phase 3.8 — Remove a vertex from the slab outline by index.
 * Guard: returns `originalParams` unchanged when `vertices.length <= 3`
 * (minimum triangle) or when `index` is out of range. Callers MUST check
 * the return value identity to detect no-ops.
 */
export function removeVertexFromSlab(
  originalParams: SlabParams,
  vertexIndex: number,
): SlabParams {
  const verts = originalParams.outline.vertices;
  if (verts.length <= 3) return originalParams;
  if (vertexIndex < 0 || vertexIndex >= verts.length) return originalParams;
  return {
    ...originalParams,
    outline: { vertices: verts.filter((_, i) => i !== vertexIndex) },
  };
}

function translateVertex(v: Point3D, delta: Point2D): Point3D {
  return v.z !== undefined
    ? { x: v.x + delta.x, y: v.y + delta.y, z: v.z }
    : { x: v.x + delta.x, y: v.y + delta.y };
}

function cloneVertex(v: Point3D): Point3D {
  return v.z !== undefined ? { x: v.x, y: v.y, z: v.z } : { x: v.x, y: v.y };
}
