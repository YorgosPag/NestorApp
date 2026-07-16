/**
 * SSoT for polygon-outline parametric grips (N.0.2 centralization).
 *
 * Five BIM entities edit a closed polygon the exact same way — `slab`, `slab-opening`,
 * `roof`, `floor-finish` and `mep-underfloor` — via two grip families:
 *
 *   - `${on}-vertex-N`        → translate outline vertex N (XY only, z preserved).
 *   - `${on}-edge-midpoint-N` → insert a fresh vertex at edge `[N, N+1]` midpoint + delta.
 *
 * Before this module each `*-grips.ts` carried its OWN byte-identical copy of the grip
 * emit loop plus `moveOutlineVertex` / `insertVertexOnEdge` / `removeVertex` / `cloneVertex`
 * — the exact `BaseEntityRenderer.finalizeRender()`-class duplication N.0.2 warns about
 * (jscpd CHECK 3.28: 15 clone pairs across the 4 outline files, +floor-finish).
 *
 * The list-level helpers here work on a bare `Point3D[]` so they are **container-agnostic**:
 * each caller supplies its own container (`outline.vertices` vs `footprint.vertices`) and its
 * own post-process (roof keeps `edges` in lockstep, mep-underfloor re-derives `connectors`).
 * All helpers return `null` to signal a no-op so the caller can keep `originalParams`
 * referentially unchanged (the commit-merge short-circuit every consumer relies on).
 *
 * @see bim/slabs/slab-grips.ts — the original pattern these mirror
 * @see docs/centralized-systems/reference/adrs/ADR-584-jscpd-clone-ratchet.md — CHECK 3.28
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { GripInfo } from '../../hooks/grip-types';
import type { EntityGripKind, GripKindByEntity } from '../../hooks/grip-kinds';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { constrainDeltaToDominantAxis } from './ortho-delta';
import { parseGripKindIndex } from '../../systems/grip/grip-kind-index';

/** Structural clone of an outline vertex — preserves the optional `z` exactly. */
export function cloneOutlineVertex(v: Point3D): Point3D {
  return v.z !== undefined ? { x: v.x, y: v.y, z: v.z } : { x: v.x, y: v.y };
}

/**
 * The fresh vertex inserted at the midpoint of edge `[a, b]`, offset by `delta`.
 * `z` is carried through only when either endpoint has one (averaged), matching the
 * per-file originals byte-for-byte.
 */
export function outlineEdgeInsertedVertex(a: Point3D, b: Point3D, delta: Point2D): Point3D {
  return {
    x: (a.x + b.x) / 2 + delta.x,
    y: (a.y + b.y) / 2 + delta.y,
    ...(a.z !== undefined || b.z !== undefined
      ? { z: ((a.z ?? 0) + (b.z ?? 0)) / 2 }
      : {}),
  };
}

/**
 * `${on}-vertex-${i}` / `${on}-edge-midpoint-${i}` are BY CONSTRUCTION members of
 * `GripKindByEntity[K]` for every polygon-outline entity (each `*GripKind` union is
 * literally those two template-literal families). TS cannot prove the template ↔ union
 * link across a generic `K`, so this ONE SSoT assertion mirrors `gripKindOf`'s internal
 * `as GripKindByEntity[K]` (grip-kinds.ts) — the same declared-not-enforced seam.
 */
function outlineGripKind<K extends keyof GripKindByEntity & string>(
  on: K,
  kind: `${K}-${string}`,
): EntityGripKind {
  return { on, kind } as EntityGripKind;
}

/**
 * Emit the `2N` outline grips (N vertex + N edge-midpoint) in stable index order.
 * `on` is the entity discriminator and doubles as the grip-kind prefix (`'slab'` →
 * `'slab-vertex-i'` / `'slab-edge-midpoint-i'`). Positions come straight from `verts`,
 * so the caller owns the degenerate/managed guards and the vertex source.
 */
export function buildPolygonOutlineGrips<K extends keyof GripKindByEntity & string>(
  entityId: string,
  verts: readonly Point2D[],
  on: K,
): GripInfo[] {
  const grips: GripInfo[] = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    grips.push({
      entityId,
      gripIndex: i,
      type: 'vertex',
      position: { x: v.x, y: v.y },
      movesEntity: false,
      gripKind: outlineGripKind(on, `${on}-vertex-${i}`),
    });
  }
  const offset = verts.length;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    grips.push({
      entityId,
      gripIndex: offset + i,
      type: 'midpoint',
      position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      movesEntity: false,
      edgeVertexIndices: [i, (i + 1) % verts.length],
      gripKind: outlineGripKind(on, `${on}-edge-midpoint-${i}`),
    });
  }
  return grips;
}

/**
 * Move vertex `index` by `delta`, cloning the rest. Returns `null` for a no-op —
 * out-of-range index OR zero delta — so the caller keeps `originalParams` unchanged.
 */
export function moveOutlineVertexInList(
  verts: readonly Point3D[],
  index: number,
  delta: Point2D,
): Point3D[] | null {
  if (index >= verts.length) return null;
  if (delta.x === 0 && delta.y === 0) return null;
  return verts.map((v, i) => (i === index ? translatePoint(v, delta) : cloneOutlineVertex(v)));
}

/**
 * Insert a fresh vertex right after edge `edgeIndex` (splitting it). Returns `null`
 * when `edgeIndex` is out of range. Does NOT gate on zero delta — inserting at the
 * exact midpoint is a legitimate edit (matches the per-file originals).
 */
export function insertOutlineVertexInList(
  verts: readonly Point3D[],
  edgeIndex: number,
  delta: Point2D,
): Point3D[] | null {
  if (edgeIndex >= verts.length) return null;
  const inserted = outlineEdgeInsertedVertex(
    verts[edgeIndex],
    verts[(edgeIndex + 1) % verts.length],
    delta,
  );
  const next: Point3D[] = [];
  for (let i = 0; i < verts.length; i++) {
    next.push(cloneOutlineVertex(verts[i]));
    if (i === edgeIndex) next.push(inserted);
  }
  return next;
}

/**
 * Remove vertex `vertexIndex`. Returns `null` when the guard trips — fewer than the
 * minimum-triangle 4th vertex (`length <= 3`) or an out-of-range index — so the caller
 * keeps `originalParams` unchanged. Entities with parallel arrays (roof `edges`) filter
 * their sibling array at the SAME index after a non-null result.
 */
export function removeOutlineVertexInList(
  verts: readonly Point3D[],
  vertexIndex: number,
): Point3D[] | null {
  if (verts.length <= 3) return null;
  if (vertexIndex < 0 || vertexIndex >= verts.length) return null;
  return verts.filter((_, i) => i !== vertexIndex);
}

/** The `input` shape every `apply*GripDrag` receives (params + delta + Ortho flag). */
export interface PolygonOutlineDragInput<P> {
  readonly originalParams: P;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

/**
 * The full `apply*GripDrag` dispatch, shared by every polygon-outline entity:
 * Ortho-quantize the delta, then route `${on}-vertex-N` → move and
 * `${on}-edge-midpoint-N` → insert. A no-op (out-of-range index or null helper
 * result) returns `originalParams` referentially unchanged so the commit-merge
 * short-circuits. Container access is injected:
 *
 *   - `getVerts`  reads the entity's vertex array (`outline` vs `footprint`).
 *   - `withVerts` writes a new array back into a fresh params object — and is the
 *     seam for per-entity post-process (mep-underfloor re-derives `connectors` here).
 *   - `insertOverride` (optional) replaces the default insert for entities whose
 *     insert must touch a parallel array (roof keeps `edges` in lockstep).
 */
export function applyPolygonOutlineGripDrag<P>(
  gripKind: string,
  on: string,
  input: PolygonOutlineDragInput<P>,
  getVerts: (params: P) => readonly Point3D[],
  withVerts: (params: P, verts: Point3D[]) => P,
  insertOverride?: (params: P, edgeIndex: number, delta: Point2D) => P,
): P {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  const verts = getVerts(input.originalParams);
  if (gripKind.startsWith(`${on}-vertex-`)) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    const next = moveOutlineVertexInList(verts, idx, delta);
    return next ? withVerts(input.originalParams, next) : input.originalParams;
  }
  if (gripKind.startsWith(`${on}-edge-midpoint-`)) {
    const idx = parseGripKindIndex(gripKind);
    if (idx === null) return input.originalParams;
    if (insertOverride) return insertOverride(input.originalParams, idx, delta);
    const next = insertOutlineVertexInList(verts, idx, delta);
    return next ? withVerts(input.originalParams, next) : input.originalParams;
  }
  return input.originalParams;
}
