/**
 * BIM Cascade Resolver — SSoT για host→hosted entity discovery
 *
 * ADR-363 Phase 7A — Multi-Element Selection & Bulk Edit.
 *
 * Centralises the "find children" sweep that was previously inlined inside
 * `useSmartDelete` (wall → opening orphan detection). Reusable from delete +
 * move + (Phase 7B) mirror/rotate/copy.
 *
 * Pure function — no React, no store reads, no IO. Takes the current scene
 * snapshot and returns id-only Sets so callers can build their own update
 * batches without re-iterating the scene.
 *
 * Cascade semantics (decided in Q1 Giorgio 2026-05-19):
 *
 *   DELETE — both host→hosted relationships orphan their children:
 *     wall   → opening       (opening.params.wallId references a deleted wall)
 *     slab   → slab-opening  (slab-opening.params.slabId references a deleted slab)
 *
 *   MOVE — only the relationships whose child has INDEPENDENT world coords:
 *     slab   → slab-opening  (slab-opening.outline is its own polygon in world mm)
 *
 *   Walls do NOT cascade for move: openings derive their world geometry from
 *   `wall.params.start + offsetFromStart × axisDir`, so moving the wall
 *   automatically carries the opening through `computeOpeningGeometry()`.
 *
 * @see ADR-363 §Phase 7
 * @see ADR-294 SSoT Ratchet — registry module `bim-cascade-resolver` (Tier 3)
 */
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene-types';
import {
  isOpeningEntity,
  isSlabOpeningEntity,
  isWallEntity,
  isSlabEntity,
} from '../../types/entities';

// ─── Building blocks ────────────────────────────────────────────────────────

/**
 * Finds opening ids that would be orphaned by deleting the given wall ids.
 * "Orphaned" = opening.params.wallId references one of the deleted walls AND
 * the opening is not already in the deletion set.
 */
export function findHostedOpenings(
  wallIds: ReadonlySet<string>,
  entities: readonly Entity[],
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  if (wallIds.size === 0) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (!isOpeningEntity(e)) continue;
    if (exclude.has(e.id)) continue;
    if (wallIds.has(e.params.wallId)) out.push(e.id);
  }
  return out;
}

/**
 * Finds slab-opening ids that would be orphaned by deleting the given slab ids,
 * OR that share independent world coords with the slabs being moved.
 */
export function findHostedSlabOpenings(
  slabIds: ReadonlySet<string>,
  entities: readonly Entity[],
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  if (slabIds.size === 0) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (!isSlabOpeningEntity(e)) continue;
    if (exclude.has(e.id)) continue;
    if (slabIds.has(e.params.slabId)) out.push(e.id);
  }
  return out;
}

// ─── Composition helpers ────────────────────────────────────────────────────

/**
 * Partitions a selection by ADR-363 host kind, returning sets of wall ids and
 * slab ids present in the selection. Used internally + by callers that need
 * to drive cascade-specific UX (e.g. "Διαγραφή και των N ανοιγμάτων;" prompt).
 */
export function partitionBimHosts(
  selectedIds: readonly string[],
  entities: readonly Entity[],
): { wallIds: Set<string>; slabIds: Set<string> } {
  const idSet = new Set(selectedIds);
  const wallIds = new Set<string>();
  const slabIds = new Set<string>();
  for (const e of entities) {
    if (!idSet.has(e.id)) continue;
    if (isWallEntity(e)) wallIds.add(e.id);
    else if (isSlabEntity(e)) slabIds.add(e.id);
  }
  return { wallIds, slabIds };
}

/**
 * Expands a selection with delete-time cascade (wall→opening + slab→slab-opening).
 * The returned array is the original ids in their original order followed by
 * the newly discovered orphan ids, deduplicated.
 *
 * Callers MUST prompt the user before executing the delete (cascade-delete
 * dialog) — this resolver does not enforce UX, only computes the set.
 */
export function expandSelectionForDelete(
  selectedIds: readonly string[],
  scene: Pick<SceneModel, 'entities'>,
): { ids: string[]; orphanedOpeningIds: string[]; orphanedSlabOpeningIds: string[] } {
  const { wallIds, slabIds } = partitionBimHosts(selectedIds, scene.entities);
  const selectionSet = new Set(selectedIds);
  const orphanedOpeningIds = findHostedOpenings(wallIds, scene.entities, selectionSet);
  const orphanedSlabOpeningIds = findHostedSlabOpenings(slabIds, scene.entities, selectionSet);
  return {
    ids: [...selectedIds, ...orphanedOpeningIds, ...orphanedSlabOpeningIds],
    orphanedOpeningIds,
    orphanedSlabOpeningIds,
  };
}

/**
 * Expands a selection with move-time cascade (slab→slab-opening only).
 * Wall openings are excluded — their world geometry is derived from the host
 * wall, so the wall move already carries them.
 */
export function expandSelectionForMove(
  selectedIds: readonly string[],
  scene: Pick<SceneModel, 'entities'>,
): { ids: string[]; cascadedSlabOpeningIds: string[] } {
  const { slabIds } = partitionBimHosts(selectedIds, scene.entities);
  const selectionSet = new Set(selectedIds);
  const cascadedSlabOpeningIds = findHostedSlabOpenings(slabIds, scene.entities, selectionSet);
  return {
    ids: [...selectedIds, ...cascadedSlabOpeningIds],
    cascadedSlabOpeningIds,
  };
}
