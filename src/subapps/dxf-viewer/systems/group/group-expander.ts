/**
 * ADR-575 SSoT — GROUP entity expansion (render + snap), mirror of
 * systems/array/array-expander.ts.
 *
 * Expands a {@link GroupEntity} into its constituent member entities. A GROUP is
 * an IDENTITY container (members already hold absolute coordinates), so expansion
 * is a 1:1 pass — no transform math. Every returned item carries the parent
 * GROUP's `id` so hit-testing/selection resolve to the container on click (the
 * exact ArrayEntity mechanism).
 *
 * Recursively flattens NESTED containers so groups-of-groups and grouped arrays
 * still render/snap: a member GROUP is expanded in place, a member ARRAY is
 * expanded via the array SSoT. Pure — no React, no canvas, no side effects.
 *
 * Used by:
 *   - useDxfSceneConversion  → render group members in canvas
 *   - useGlobalSnapSceneSync → snap candidates for group members
 */

import type { GroupEntity, Entity } from '../../types/entities';
import { isGroupEntity, isArrayEntity } from '../../types/entities';
import { expandArrayEntity } from '../array/array-expander';
import type { PathParams } from '../array/types';

/** Expand a single member, recursing into nested GROUP/ARRAY containers. */
function expandMember(member: Entity, allEntities?: readonly Entity[]): Entity[] {
  if (isGroupEntity(member)) return expandGroupEntity(member, allEntities);
  if (isArrayEntity(member)) {
    const pathEnt = member.arrayKind === 'path' && member.params.kind === 'path' && allEntities
      ? allEntities.find((e) => e.id === (member.params as PathParams).pathEntityId)
      : undefined;
    return expandArrayEntity(member, pathEnt);
  }
  return [member];
}

/**
 * Expand a GROUP into rendered/snap-candidate items, each re-tagged with the
 * GROUP's `id` (so a click on ANY member selects the whole group — Figma/Revit
 * semantics). `allEntities` is the scene list, used only to resolve a nested path
 * array's external path entity.
 */
export function expandGroupEntity(group: GroupEntity, allEntities?: readonly Entity[]): Entity[] {
  if (!group.members || group.members.length === 0) return [];
  const result: Entity[] = [];
  for (const member of group.members) {
    for (const item of expandMember(member, allEntities)) {
      result.push({ ...item, id: group.id });
    }
  }
  return result;
}
