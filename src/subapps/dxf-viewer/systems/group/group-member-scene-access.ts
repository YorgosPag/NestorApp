/**
 * ADR-575 §enter-group — MEMBER-AWARE scene access (SSoT, pure).
 *
 * In-place group editing (Revit «Edit Group» / Figma enter-group / Cinema 4D null):
 * while the user is INSIDE a group, its members are edited individually but STILL
 * live inside the {@link GroupEntity} container — they are NOT lifted to the top of
 * the scene. So an id the hit-test returns (a member's own id, present in the
 * converted scene via the active-group conditional tagging) resolves in the RAW
 * SceneModel only by looking INSIDE each group's `members`.
 *
 * This module is the ONE place that resolves + immutably writes back «an id that may
 * be a top-level entity OR a member of a group container». Every command surface that
 * must edit an entered member (the grip scene-manager adapter today; the modify-tool
 * adapters on touch) delegates here instead of re-implementing the descent — so the
 * member writeback semantics (new members array → new container ref → scene
 * subscription + persist serializer see the change) live in ONE spot (N.0.2).
 *
 * Always-on fallback is safe: a member id is individually addressable ONLY while its
 * group is active (own id in the converted scene), so the descent is exercised solely
 * during in-place edit; a plain top-level edit matches at depth 0 and never recurses.
 *
 * Pure — no React, no store reads. `AnySceneEntity === Entity`, so the grip adapter's
 * `AnySceneEntity` arrays pass through unchanged.
 */

import type { Entity } from '../../types/entities';
import { isGroupEntity } from '../../types/entities';

/**
 * Resolve an id to its {@link Entity}, whether it is a TOP-LEVEL entity or a (possibly
 * nested) member of a GROUP container. Returns `null` when the id is absent. Reads the
 * RAW SceneModel entities (a GROUP survives only pre-expansion). Recurses into nested
 * groups so groups-of-groups still resolve.
 */
export function findEntityOrGroupMember(
  entities: readonly Entity[] | undefined,
  targetId: string | null | undefined,
): Entity | null {
  if (!entities || entities.length === 0 || !targetId) return null;
  for (const entity of entities) {
    if (entity.id === targetId) return entity;
    if (isGroupEntity(entity) && entity.members.length > 0) {
      const found = findEntityOrGroupMember(entity.members, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Immutably apply `updater` to the entity with id `targetId`, whether it is top-level
 * or a (nested) group member, writing the result back into its owning container. Returns
 * a NEW top-level array only when something changed (a changed member yields a new
 * `members` array + a new GroupEntity ref, cascading up); otherwise the ORIGINAL array
 * reference (so a no-match update is a cheap no-op and downstream identity guards hold).
 *
 * A `targetId` that matches a GROUP container's own id updates the CONTAINER (no descent)
 * — whole-group ops (move/rotate the group) keep working through this same primitive.
 */
export function updateEntityOrGroupMember(
  entities: readonly Entity[],
  targetId: string,
  updater: (entity: Entity) => Entity,
): Entity[] {
  let changed = false;
  const next = entities.map((entity) => {
    if (entity.id === targetId) {
      changed = true;
      return updater(entity);
    }
    if (isGroupEntity(entity) && entity.members.length > 0) {
      const nextMembers = updateEntityOrGroupMember(entity.members, targetId, updater);
      if (nextMembers !== entity.members) {
        changed = true;
        return { ...entity, members: nextMembers };
      }
    }
    return entity;
  });
  return changed ? next : (entities as Entity[]);
}

/**
 * Batch member-aware map: for EACH entity (top-level or nested member) whose id has a
 * patch in `patches`, apply it. Same immutable-writeback + unchanged-ref-preservation
 * contract as {@link updateEntityOrGroupMember}. Used by the grip adapter's multi-grip
 * `updateEntities` so a several-vertex move inside an entered group commits in one pass.
 */
export function updateEntitiesOrGroupMembers(
  entities: readonly Entity[],
  patches: ReadonlyMap<string, (entity: Entity) => Entity>,
): Entity[] {
  if (patches.size === 0) return entities as Entity[];
  let changed = false;
  const next = entities.map((entity) => {
    const patch = patches.get(entity.id);
    if (patch) {
      changed = true;
      return patch(entity);
    }
    if (isGroupEntity(entity) && entity.members.length > 0) {
      const nextMembers = updateEntitiesOrGroupMembers(entity.members, patches);
      if (nextMembers !== entity.members) {
        changed = true;
        return { ...entity, members: nextMembers };
      }
    }
    return entity;
  });
  return changed ? next : (entities as Entity[]);
}
