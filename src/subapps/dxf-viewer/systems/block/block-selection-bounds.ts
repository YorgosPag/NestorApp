/**
 * ADR-640 — BLOCK selection affordance bounds (SSoT, pure), mirror of
 * systems/group/group-selection-bounds.ts (ADR-575).
 *
 * A kept DXF INSERT is a first-class {@link BlockEntity} container (ADR-640) — the
 * exact selection/hover/gizmo role a {@link GroupEntity} plays (ADR-575), so it shares
 * the SAME affordance stack: a dashed box hugging every member + a «Μπλοκ «name» · N»
 * pill, ONE whole-block gizmo (per-member grips suppressed), and a status-bar readout.
 *
 * FULL reuse — zero new bbox math:
 *   - {@link expandBlockInstance} re-materialises the block's local members in WORLD
 *     space (ADR-640 SSoT, the SAME transform the legacy explode path used) and re-tags
 *     each with `block.id`, mirroring `expandGroupEntity`.
 *   - {@link computeContainerBounds} unions the leaves' AABBs + centre (the shared
 *     container-bounds core, itself delegating to the ADR-394 union SSoT).
 *
 * The member count is `block.entities.length` — the number of primitives the INSERT
 * expands to — so the label reads «Μπλοκ «name» · N αντικείμενα» with N = member count.
 */

import type { BlockEntity, Entity } from '../../types/entities';
import { isBlockEntity } from '../../types/entities';
import { expandBlockInstance } from './block-expander';
import {
  computeContainerBounds,
  type GroupSelectionBounds,
} from '../group/group-selection-bounds';

/**
 * Combined bounds + centre + member count for a selected BLOCK container, or `null`
 * when the block is empty. Mirror of {@link computeGroupSelectionBounds}: the box hugs
 * every placed member (world space) via the shared container-bounds core; the count is
 * `block.entities.length` (the label «Μπλοκ «name» · N»).
 */
export function computeBlockSelectionBounds(block: BlockEntity): GroupSelectionBounds | null {
  const members = block.entities;
  if (!Array.isArray(members) || members.length === 0) return null;
  return computeContainerBounds(expandBlockInstance(block), members.length);
}

/**
 * SSoT — collect the BLOCK containers of a scene keyed by id (mirror
 * `collectGroupEntities`). The ONE derivation of «which ids are blocks» reused by the
 * grip registry (emit the whole-block gizmo + suppress per-member grips) and the canvas
 * interactive overlay (paint the whole block on hover/selection). Pure — no React.
 * Reads the ORIGINAL scene entities (a BLOCK container survives only pre-expansion; the
 * converted DxfScene holds just its tagged members).
 */
export function collectBlockEntities(
  entities: readonly Entity[] | undefined,
): Map<string, BlockEntity> {
  const map = new Map<string, BlockEntity>();
  if (!entities) return map;
  for (const entity of entities) {
    if (isBlockEntity(entity)) map.set(entity.id, entity);
  }
  return map;
}

/**
 * Resolve the selected BLOCK containers from a scene + selection set (mirror
 * `resolveSelectedGroups`). A BLOCK is selected via its container id (every expanded
 * member carries `block.id`), so a single selected id can resolve to a whole block.
 * Pure — no React.
 */
export function resolveSelectedBlocks(
  entities: readonly Entity[] | undefined,
  selectedIds: readonly string[],
): BlockEntity[] {
  if (!entities || entities.length === 0 || selectedIds.length === 0) return [];
  const selected = new Set(selectedIds);
  const blocks: BlockEntity[] = [];
  for (const entity of entities) {
    if (entity.type === 'block' && selected.has(entity.id)) {
      blocks.push(entity as BlockEntity);
    }
  }
  return blocks;
}
