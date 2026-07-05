/**
 * GROUP geometry (SSoT, pure) — «Ομαδοποίηση»: wrap N selected entities into ONE
 * composite {@link GroupEntity} container, and the inverse UNGROUP that breaks a
 * container back into its members. This is the container-flavour inverse of
 * «Διάλυση» (EXPLODE); JOIN is the geometry-flavour inverse (see
 * services/EntityMergeService.ts).
 *
 * Model (Revit/Figma/Cinema 4D GROUP — in-place, IDENTITY transform):
 *   - The container is a dedicated `type: 'group'` entity (NOT the DXF `'block'`
 *     INSERT type, which carries single-point position semantics + INSERT export).
 *   - Members keep their ABSOLUTE world coordinates in `members` and are OWNED by
 *     the container: removed from the live scene, then expanded 1:1 at conversion
 *     time tagged with the group id (the ArrayEntity.hiddenSources pattern) so
 *     rendering / hit-test / selection resolve to the container for free.
 *   - UNGROUP === EXPLODE of a group → the members are restored to the scene, so
 *     `explode-entity.ts` delegates its `'group'` case to {@link ungroupGroup}
 *     (single SSoT, no duplicated unwrap logic).
 *
 * FULL SSoT reuse — zero re-implemented geometry/ids:
 *   - `generateEntityId` → systems/entity-creation/utils
 *   - `deepClone`        → utils/clone-utils
 *
 * @see core/commands/entity-commands/CreateGroupCommand.ts (undoable wrapper)
 * @see systems/explode/explode-entity.ts (UNGROUP delegates the 'group' case here)
 */

import type { Entity, GroupEntity } from '../../types/entities';
import { isGroupEntity } from '../../types/entities';
import { generateEntityId } from '../entity-creation/utils';
import { deepClone } from '../../utils/clone-utils';

export { isGroupEntity };

/** A GROUP needs at least two members (a one-entity group is a no-op). */
export const GROUP_MIN_MEMBERS = 2;

/** True when the current selection can be grouped into a single container. */
export function isGroupable(entities: readonly Entity[]): boolean {
  return entities.length >= GROUP_MIN_MEMBERS;
}

/**
 * Wrap `members` into ONE composite {@link GroupEntity} (identity transform —
 * members keep their absolute coordinates). The members are deep-cloned so the
 * container OWNS them; the caller removes the originals from the scene (done by
 * {@link CreateGroupCommand}). Inherits the nominal layer from the first member
 * so the container lands on a real layer in the Layers panel.
 */
export function createGroupEntity(members: readonly Entity[]): GroupEntity {
  const first = members[0];
  return {
    id: generateEntityId(),
    type: 'group',
    // Internal identifier / fallback name (non-i18n data field, like the JOIN
    // service's `Joined_N_entities`). The user-facing label is resolved via the
    // properties panel, not this raw value.
    name: `Group_${members.length}`,
    layerId: first.layerId,
    visible: true,
    members: members.map((m) => ({ ...deepClone(m), selected: false } as Entity)),
  } as GroupEntity;
}

/**
 * UNGROUP: return fresh-id clones of a container's members (identity transform →
 * absolute coordinates are already correct, no matrix applied). Fresh ids keep
 * the restored members independent of the container's own lifecycle, matching
 * the EXPLODE convention (every derived primitive gets a new id). Returns `null`
 * when there is nothing to unwrap so EXPLODE can no-op + hint.
 */
export function ungroupGroup(group: GroupEntity): Entity[] | null {
  if (!Array.isArray(group.members) || group.members.length === 0) return null;
  return group.members.map((child) => ({
    ...deepClone(child),
    id: generateEntityId(),
    selected: false,
  } as Entity));
}
