/**
 * ADR-362 Round 23 — live associative-dimension follow during ROTATE / SCALE /
 * MIRROR / STRETCH (extends the Round 21 Move + grip live-follow).
 *
 * Pure SSoT that builds the `movingEntities: Map<id, liveEntity>` the live-follow
 * paint (`paintAssociatedDimensionGhosts`) consumes — by applying the EXISTING
 * per-type transform SSoT to each host entity:
 *
 *   - rotate  → `rotateEntity`            (utils/rotation-math)
 *   - mirror  → `mirrorEntity`            (utils/mirror-math)
 *   - scale   → `scaleEntity`             (systems/scale/scale-entity-transform)
 *   - stretch → `translateEntityByAnchor` + `applyVertexDisplacement`
 *               (systems/stretch/stretch-entity-transform)
 *
 * The SAME math the entity ghost (`useRotationPreview`/`useMirrorPreview`/
 * `useScalePreview`/`useStretchPreview`) and the command commit run — so the dim
 * ghost and the entity ghost can never diverge, and the live preview is exactly
 * what the release commits (preview ≡ commit). No new geometry, no new renderer.
 *
 * No React, no canvas, no store reads — the caller derives the live transform
 * params (pivot/angle, axis, factor, delta) from props/stores and hands them in,
 * keeping this unit-testable with plain fixtures.
 *
 * @see hooks/dimensions/useDimAssociationGhostPreview.ts — derives params + paints
 * @see systems/dimensions/dim-association-ghost-paint.ts — generic paint consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { MirrorAxis } from '../../utils/mirror-math';
import type { VertexRef } from '../stretch/stretch-vertex-classifier';
import type { WorldVector } from '../stretch/stretch-entity-transform';
import { rotateEntity } from '../../utils/rotation-math';
import { mirrorEntity } from '../../utils/mirror-math';
import { scaleEntity } from '../scale/scale-entity-transform';
import {
  translateEntityByAnchor,
  applyVertexDisplacement,
} from '../stretch/stretch-entity-transform';

/**
 * The active transform whose host geometry the associated dims should follow.
 * Discriminated so each branch carries exactly the params its SSoT needs.
 */
export type DimFollowTransform =
  | { readonly kind: 'rotate'; readonly entityIds: readonly string[]; readonly pivot: Point2D; readonly angleDeg: number }
  | { readonly kind: 'mirror'; readonly entityIds: readonly string[]; readonly axis: MirrorAxis }
  | { readonly kind: 'scale'; readonly entityIds: readonly string[]; readonly base: Point2D; readonly sx: number; readonly sy: number }
  | {
      readonly kind: 'stretch';
      readonly capturedEntities: readonly string[];
      readonly capturedVertices: readonly VertexRef[];
      readonly delta: WorldVector;
    };

type GetEntity = (id: string) => SceneEntity | undefined;

/** Merge a partial update onto the original entity; null when the update is empty. */
function mergePartial(orig: SceneEntity, partial: Partial<Entity> | Partial<SceneEntity>): SceneEntity | null {
  if (!partial || Object.keys(partial).length === 0) return null;
  return { ...(orig as object), ...(partial as object) } as SceneEntity;
}

/** Apply a whole-entity transform (rotate/mirror/scale) to a list of host ids. */
function buildWholeEntityHosts(
  entityIds: readonly string[],
  getEntity: GetEntity,
  transform: (orig: SceneEntity) => Partial<Entity> | Partial<SceneEntity>,
): Map<string, SceneEntity> {
  const moving = new Map<string, SceneEntity>();
  for (const id of entityIds) {
    const orig = getEntity(id);
    if (!orig) continue;
    const live = mergePartial(orig, transform(orig));
    if (live) moving.set(id, live);
  }
  return moving;
}

/** Group captured vertex refs by their owning entity id (per-vertex stretch). */
function groupRefsByEntity(refs: readonly VertexRef[]): Map<string, VertexRef[]> {
  const byEntity = new Map<string, VertexRef[]>();
  for (const r of refs) {
    const list = byEntity.get(r.entityId);
    if (list) list.push(r);
    else byEntity.set(r.entityId, [r]);
  }
  return byEntity;
}

/** Stretch hosts: anchor entities (rigid) + per-vertex captured entities. */
function buildStretchHosts(
  capturedEntities: readonly string[],
  capturedVertices: readonly VertexRef[],
  delta: WorldVector,
  getEntity: GetEntity,
): Map<string, SceneEntity> {
  const moving = new Map<string, SceneEntity>();

  // Anchor entities → whole-entity rigid translation (same as the stretch ghost).
  for (const id of capturedEntities) {
    const orig = getEntity(id);
    if (!orig) continue;
    const live = mergePartial(orig, translateEntityByAnchor(orig as unknown as Entity, delta));
    if (live) moving.set(id, live);
  }

  // Per-vertex entities → partial deformation via the same SSoT the command uses.
  for (const [id, refs] of groupRefsByEntity(capturedVertices)) {
    const orig = getEntity(id);
    if (!orig) continue;
    const res = applyVertexDisplacement(orig as unknown as Entity, refs, delta);
    if (res.kind === 'noop') continue;
    const live = res.kind === 'replace' ? (res.entity as SceneEntity) : mergePartial(orig, res.updates);
    if (live) moving.set(id, live);
  }

  return moving;
}

/**
 * Build the live (transformed) host geometry for the active transform, reusing
 * the per-type math SSoT. The dim paint filters this map to the dims that
 * actually reference a moving host, so passing the full selection is fine.
 */
export function buildTransformedHosts(
  transform: DimFollowTransform,
  getEntity: GetEntity,
): Map<string, SceneEntity> {
  switch (transform.kind) {
    case 'rotate':
      return buildWholeEntityHosts(transform.entityIds, getEntity, (orig) =>
        rotateEntity(orig as unknown as Entity, transform.pivot, transform.angleDeg),
      );
    case 'mirror':
      return buildWholeEntityHosts(transform.entityIds, getEntity, (orig) =>
        mirrorEntity(orig as unknown as Entity, transform.axis),
      );
    case 'scale':
      return buildWholeEntityHosts(transform.entityIds, getEntity, (orig) =>
        scaleEntity(orig as unknown as Entity, transform.base, transform.sx, transform.sy),
      );
    case 'stretch':
      return buildStretchHosts(
        transform.capturedEntities,
        transform.capturedVertices,
        transform.delta,
        getEntity,
      );
    default: {
      const _exhaustive: never = transform;
      void _exhaustive;
      return new Map();
    }
  }
}
