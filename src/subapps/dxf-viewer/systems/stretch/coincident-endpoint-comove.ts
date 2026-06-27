/**
 * COINCIDENT-ENDPOINT CO-MOVE — articulated joint for selected lines (ADR-543)
 *
 * When TWO (or more) LINE entities are selected together and one endpoint of the
 * dragged line is geometrically coincident with an endpoint of another selected
 * line (their grips overlap), dragging that shared endpoint must move BOTH
 * coincident endpoints by the same delta — an articulated joint: only the common
 * endpoint moves, the other endpoint of each line stays fixed.
 *
 * This pure module is the SINGLE SSoT for the coincidence math. It is reused by:
 *   - the shared grip commit seam `commitDxfGripDragViaStretchCommand`
 *     (covers BOTH the 2D canvas and the 3D viewport — they pass through it), and
 *   - the live drag previews (2D `useGripGhostPreview`, 3D `BimGripOverlay2D`).
 *
 * Unit space: native scene/DXF units. The commit seam holds native-unit geometry
 * (the 3D delta is converted back to native units by `commitDxfGrip3D` BEFORE the
 * seam), so the coincidence tolerance needs NO unit scaling. Tolerance reuses the
 * existing `GEOMETRY_PRECISION.POINT_MATCH` SSoT (absorbs float drift from OSNAP).
 *
 * @see ADR-543 — Coincident-endpoint co-move
 * @see core/commands/entity-commands/StretchEntityCommand.ts — multi-entity vertexMoves
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { VertexRef } from './stretch-vertex-classifier';
import type { StretchVertexMove } from '../../core/commands/entity-commands/StretchEntityCommand';
import { getVertexPosition } from './stretch-vertex-classifier';
import { applyVertexDisplacement, type WorldVector } from './stretch-entity-transform';
import { squaredDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';

export interface CoincidentComoveParams {
  /** The dragged entity, native-unit geometry (from the scene manager). */
  readonly draggedEntity: Entity;
  /** The vertex refs the dragged grip resolved to (via `gripToVertexRefs`). */
  readonly draggedRefs: ReadonlyArray<VertexRef>;
  /** The full multi-select set (SSoT `SelectedEntitiesStore.getSelectedEntityIds`). */
  readonly selectedEntityIds: ReadonlyArray<string>;
  /** Native-unit entity accessor (the scene manager's `getEntity`). */
  readonly getEntity: (id: string) => Entity | undefined;
  /** Coincidence tolerance in native units. Defaults to `POINT_MATCH`. */
  readonly toleranceWorld?: number;
}

/**
 * True only when the dragged grip addresses a SINGLE line endpoint
 * (`line-start` XOR `line-end`). The midpoint grip resolves to BOTH refs
 * (`refs.length === 2`) → a whole-entity move, which must NOT articulate.
 * Non-line entities never articulate.
 */
export function isSingleLineEndpointDrag(
  entity: Entity,
  refs: ReadonlyArray<VertexRef>,
): boolean {
  if (entity.type !== 'line' || refs.length !== 1) return false;
  return refs[0].kind === 'line-start' || refs[0].kind === 'line-end';
}

const LINE_ENDPOINT_KINDS: readonly VertexRef['kind'][] = ['line-start', 'line-end'];

/**
 * For a single-endpoint line drag, return one {@link StretchVertexMove} per OTHER
 * selected LINE whose start and/or end coincides (within tolerance) with the
 * dragged endpoint. These extra moves are appended to the dragged move and fed to
 * a single `StretchEntityCommand` so the whole joint moves in one atomic undo step.
 *
 * Returns `[]` when: fewer than 2 entities selected, the drag is not a single line
 * endpoint, the anchor cannot be read, or no coincident partner exists. The dragged
 * entity itself is never included.
 */
export function collectCoincidentLinePartnerMoves(
  p: CoincidentComoveParams,
): StretchVertexMove[] {
  const out: StretchVertexMove[] = [];
  if (p.selectedEntityIds.length < 2) return out;
  if (!isSingleLineEndpointDrag(p.draggedEntity, p.draggedRefs)) return out;

  const anchor = getVertexPosition(p.draggedEntity, p.draggedRefs[0]);
  if (!anchor) return out;

  const tol2 = (p.toleranceWorld ?? GEOMETRY_PRECISION.POINT_MATCH) ** 2;
  for (const id of p.selectedEntityIds) {
    if (id === p.draggedEntity.id) continue;
    const partner = p.getEntity(id);
    if (!partner || partner.type !== 'line') continue;
    const refs = coincidentEndpointRefs(partner, id, anchor, tol2);
    if (refs.length > 0) out.push({ entityId: id, refs });
  }
  return out;
}

/** The partner line's endpoint refs that sit within `tol2` of `anchor`. */
function coincidentEndpointRefs(
  partner: Entity,
  id: string,
  anchor: Point2D,
  tol2: number,
): VertexRef[] {
  const refs: VertexRef[] = [];
  for (const kind of LINE_ENDPOINT_KINDS) {
    const ref: VertexRef = { entityId: id, kind };
    const pos = getVertexPosition(partner, ref);
    if (pos && squaredDistance(anchor, pos) <= tol2) refs.push(ref);
  }
  return refs;
}

/**
 * PHASE 2 — live preview. Returns clones of the coincident partner lines with
 * only their coincident endpoint(s) translated by `delta`, so the drag preview
 * shows BOTH lines reshaping. Reuses the `applyVertexDisplacement` SSoT so the
 * preview geometry is identical to what the commit will produce.
 */
export function buildCoincidentPartnerGhostEntities(
  p: CoincidentComoveParams & { readonly delta: WorldVector },
): Entity[] {
  const moves = collectCoincidentLinePartnerMoves(p);
  const ghosts: Entity[] = [];
  for (const move of moves) {
    const partner = p.getEntity(move.entityId);
    if (!partner) continue;
    const result = applyVertexDisplacement(partner, move.refs, p.delta);
    if (result.kind === 'update') {
      ghosts.push({ ...partner, ...result.updates } as Entity);
    } else if (result.kind === 'replace') {
      ghosts.push(result.entity as unknown as Entity);
    }
  }
  return ghosts;
}
