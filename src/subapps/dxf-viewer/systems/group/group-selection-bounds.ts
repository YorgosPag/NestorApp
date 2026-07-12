/**
 * ADR-575 — GROUP selection affordance bounds (SSoT, pure).
 *
 * Computes the combined 2D bounding box + centre + member count of a selected
 * {@link GroupEntity}, so the group-selection overlay (dashed box + «Ομάδα · N»
 * label) and the status-bar indicator read the SAME geometry from ONE place.
 *
 * FULL reuse — zero new bbox math:
 *   - {@link expandGroupEntity} flattens nested GROUP/ARRAY members (ADR-575 SSoT)
 *   - {@link calculateCombinedEntityBounds} unions each member's AABB (ADR-394 SSoT,
 *     already covers every DXF + BIM entity type)
 *
 * The centre is the box midpoint (Revit/C4D group gizmo origin); the count is the
 * number of TOP-LEVEL members the user grouped (not the flattened leaf count), so
 * the label reads «Ομάδα · N αντικείμενα» with N = what was selected at group time.
 */

import type { GroupEntity, Entity } from '../../types/entities';
import { isGroupEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/scene';
import { expandGroupEntity } from './group-expander';
import { calculateCombinedEntityBounds } from '../selection/shared/selection-duplicate-utils';

export interface GroupSelectionBounds {
  /** Combined AABB minimum corner (world). */
  readonly min: Point2D;
  /** Combined AABB maximum corner (world). */
  readonly max: Point2D;
  /** Box centre (world) — the group gizmo origin. */
  readonly center: Point2D;
  /** Number of top-level members the user grouped (label «Ομάδα · N»). */
  readonly memberCount: number;
}

/**
 * SSoT core — union a container's already-expanded leaf primitives into a
 * {@link GroupSelectionBounds} (AABB + centre + member count), or `null` when no
 * leaf yields bounds. The ONE place the box-union + centre math lives, shared by
 * every composite container (GROUP via {@link computeGroupSelectionBounds}, BLOCK via
 * `computeBlockSelectionBounds`, ADR-640) — the SOLE differences per container are
 * the expansion function and the `memberCount` source, supplied by the caller. Pure —
 * zero new bbox math (delegates to the ADR-394 `calculateCombinedEntityBounds` SSoT).
 */
export function computeContainerBounds(
  leaves: readonly Entity[],
  memberCount: number,
): GroupSelectionBounds | null {
  const bounds = calculateCombinedEntityBounds(leaves as unknown as AnySceneEntity[]);
  if (!bounds) return null;
  return {
    min: bounds.min,
    max: bounds.max,
    center: {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
    },
    memberCount,
  };
}

/**
 * Combined bounds + centre + member count for a selected GROUP container, or
 * `null` when no member yields bounds (degenerate/empty group).
 */
export function computeGroupSelectionBounds(group: GroupEntity): GroupSelectionBounds | null {
  const members = group.members;
  if (!Array.isArray(members) || members.length === 0) return null;

  // Flatten nested GROUP/ARRAY members via the render/snap expansion SSoT so the
  // box hugs every leaf primitive, then union their AABBs via the shared core.
  return computeContainerBounds(expandGroupEntity(group), members.length);
}

/**
 * SSoT — collect the GROUP containers of a scene keyed by id. The ONE derivation of
 * «which ids are groups» reused by every leaf that needs it: the grip registry (emit
 * the whole-group gizmo + suppress per-member grips) and the canvas interactive overlay
 * (paint the whole group on hover/selection). Pure — no React. Reads the ORIGINAL scene
 * entities (a GROUP container survives only pre-expansion; the converted DxfScene holds
 * just its tagged members).
 */
export function collectGroupEntities(
  entities: readonly Entity[] | undefined,
): Map<string, GroupEntity> {
  const map = new Map<string, GroupEntity>();
  if (!entities) return map;
  for (const entity of entities) {
    if (isGroupEntity(entity)) map.set(entity.id, entity);
  }
  return map;
}

/**
 * SSoT — «σε ποια ομάδα ανήκει ένα entity id». Every expanded GROUP member carries
 * the container's `id` (see {@link expandGroupEntity}), and the container itself IS
 * that id, so an id resolves to its owning {@link GroupEntity} by a direct lookup.
 *
 * The ONE source of truth reused by BOTH the hover overlay and the selection overlay
 * (a hovered/selected member id → highlight/select the WHOLE group), and by the
 * enter-group input path (double-click a member → resolve its container to enter).
 * Pure — no React. Returns `null` when the id is a plain (non-grouped) entity.
 */
export function resolveGroupContainingEntity(
  entities: readonly Entity[] | undefined,
  entityId: string | null | undefined,
): GroupEntity | null {
  if (!entities || entities.length === 0 || !entityId) return null;
  for (const entity of entities) {
    if (entity.id === entityId && isGroupEntity(entity)) return entity;
  }
  return null;
}

/**
 * Resolve the selected GROUP containers from a scene + selection set. A GROUP is
 * selected via its container id (every expanded member carries `group.id`), so a
 * single selected id can resolve to a whole group. Pure — no React.
 */
export function resolveSelectedGroups(
  entities: readonly Entity[] | undefined,
  selectedIds: readonly string[],
): GroupEntity[] {
  if (!entities || entities.length === 0 || selectedIds.length === 0) return [];
  const selected = new Set(selectedIds);
  const groups: GroupEntity[] = [];
  for (const entity of entities) {
    if (entity.type === 'group' && selected.has(entity.id)) {
      groups.push(entity as GroupEntity);
    }
  }
  return groups;
}
