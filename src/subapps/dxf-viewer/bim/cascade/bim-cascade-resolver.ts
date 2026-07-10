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
 *   Walls do NOT add openings to the move SET here: openings derive their world
 *   geometry from `wall.params.start + offsetFromStart × axisDir`. The move /
 *   rotate / mirror commands recompute them against the transformed wall via the
 *   ADR-363 §5.4 cascade (`cascadeHostedOpeningsForWalls`, same offsetFromStart)
 *   — see bim/walls/wall-opening-coordinator.ts.
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
  isColumnEntity,
  isStairEntity,
} from '../../types/entities';
import {
  attachSideReferencesAny,
  type AttachBindingParams,
  type EntityAttachSide,
} from '../entities/entity-attach-detach';

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

/**
 * Finds auto («well») slab-opening ids that would be orphaned by deleting the
 * given stair ids (ADR-632 Φ4). "Orphaned" = `slab-opening.params.autoStairId`
 * references one of the deleted stairs AND the opening is not already in the
 * deletion set. Mirror of {@link findHostedSlabOpenings}, but keyed on the
 * derived `autoStairId` marker (the stair→stairwell-opening soft link) instead
 * of the `slabId` host FK — a stair delete must sweep the auto openings it owns.
 */
export function findHostedStairwellOpenings(
  stairIds: ReadonlySet<string>,
  entities: readonly Entity[],
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  if (stairIds.size === 0) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (!isSlabOpeningEntity(e)) continue;
    if (exclude.has(e.id)) continue;
    const autoStairId = e.params.autoStairId;
    if (autoStairId && stairIds.has(autoStairId)) out.push(e.id);
  }
  return out;
}

/** Any BIM entity whose vertical extent can attach to a structural host (ADR-401). */
function isAttachableEntity(e: Entity): boolean {
  return isWallEntity(e) || isColumnEntity(e) || isStairEntity(e);
}

/**
 * ADR-401 — SSoT reverse lookup: every attachable entity (wall | column | stair)
 * whose `side` is `attached` and whose attach-id list references any host in
 * `hostIds`. ONE loop over the scene driven by the `attachSideReferencesAny`
 * primitive (entity-attach-detach.ts); the per-entity wrappers below differ only
 * by their `guard` (which entity type) and `side`. Empty host set → `[]` (O(1)).
 *
 * Call AFTER the host removal lands: the affected entities remain in the scene
 * (only their host is gone), so the reverse lookup still resolves them.
 *
 * @param guard restricts the sweep to one entity kind; omit for any attachable.
 */
export function findEntitiesAttachedToHosts(
  hostIds: ReadonlySet<string>,
  entities: readonly Entity[],
  side: EntityAttachSide,
  guard: (e: Entity) => boolean = isAttachableEntity,
): string[] {
  if (hostIds.size === 0) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (!guard(e)) continue;
    const params = (e as { params?: AttachBindingParams }).params;
    if (params && attachSideReferencesAny(params, side, hostIds)) out.push(e.id);
  }
  return out;
}

/**
 * Finds `attached` wall ids whose top attach list references any host in
 * `hostIds` (ADR-401 Phase C — host-deletion warning reverse lookup). Thin
 * wrapper over {@link findEntitiesAttachedToHosts} (wall guard, top side).
 */
export function findAttachedWalls(
  hostIds: ReadonlySet<string>,
  entities: readonly Entity[],
): string[] {
  return findEntitiesAttachedToHosts(hostIds, entities, 'top', isWallEntity);
}

/**
 * Finds `attached` column ids whose top / base attach list references any host in
 * `hostIds` (ADR-401 — host-deletion **detach** reverse lookup for columns),
 * partitioned by side so the caller can run a `DetachColumnsCommand` per affected
 * side. Thin wrapper over {@link findEntitiesAttachedToHosts} (column guard).
 */
export function findAttachedColumns(
  hostIds: ReadonlySet<string>,
  entities: readonly Entity[],
): { topIds: string[]; baseIds: string[] } {
  return {
    topIds: findEntitiesAttachedToHosts(hostIds, entities, 'top', isColumnEntity),
    baseIds: findEntitiesAttachedToHosts(hostIds, entities, 'base', isColumnEntity),
  };
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

// ADR-049 — `expandSelectionForMove` (slab→slab-opening selection expansion) was
// removed: the Move commands now self-cascade slab-openings inside execute/undo/redo
// via `cascadeMovedSlabOpenings` (bim/cascade/slab-opening-move-cascade.ts), so EVERY
// move gesture carries them — not just the Move Tool that called this expansion.
