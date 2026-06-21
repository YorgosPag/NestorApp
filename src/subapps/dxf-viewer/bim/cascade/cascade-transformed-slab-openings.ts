/**
 * Slab-Opening Transform Cascade — transform-AGNOSTIC SSoT
 * (ADR-049 / ADR-507 §8, in-command, every transform).
 *
 * Slab-openings store their footprint as an INDEPENDENT world polygon
 * (`SlabOpeningParams.outline`), unlike wall-openings whose world geometry is derived
 * from the host wall. So when a slab is TRANSFORMED, its hosted slab-openings must have
 * the SAME transform applied to their footprint (translate for move, rotate around the
 * pivot for rotate, scale for scale…), not be recomputed against the host.
 *
 * This is the generic engine behind BOTH:
 *   - the MOVE cascade (`cascadeMovedSlabOpenings`, a thin delta wrapper), and
 *   - the in-place TRANSFORM spine (`SnapshotTransformCommand`, rotate/scale/mirror),
 * so a slab's openings follow it under EVERY transform and EVERY gesture (the old gap:
 * rotate/scale of a slab left its openings behind — only move carried them).
 *
 * The caller supplies `computePatch(opening)` = "apply my transform to this opening and
 * return its geometry patch" (the delta-move geometry for move, `computeUpdates` for the
 * transform spine — both already handle `slab-opening`). The transformed openings are
 * applied in one batch and returned for the `bim:entities-moved` emit. `snapshots`
 * carries each opening's PRE-transform state for snapshot-symmetric undo (the spine
 * restores from it; the move wrapper ignores it — move re-runs with the reverse delta).
 *
 * @see bim/cascade/bim-cascade-resolver.ts — `partitionBimHosts` / `findHostedSlabOpenings`
 * @see bim/cascade/slab-opening-move-cascade.ts — the MOVE (delta) wrapper
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts — the transform-spine consumer
 * @see docs/centralized-systems/reference/adrs/ADR-049-unified-move-tool-dxf-overlays.md
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import { findHostedSlabOpenings, partitionBimHosts } from './bim-cascade-resolver';
import { deepClone } from '../../utils/clone-utils';

/**
 * Minimal scene-manager surface. `getEntities` is optional (real adapters implement it;
 * lightweight test mocks without it → no-op).
 */
export type SlabOpeningCascadeSceneManager = Pick<ISceneManager, 'getEntity' | 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * Outcome of a slab-opening cascade: the transformed opening entities for the
 * `bim:entities-moved` emit, and their PRE-transform snapshots for snapshot-symmetric undo.
 */
export interface SlabOpeningCascadeResult {
  readonly moved: SceneEntity[];
  readonly snapshots: SceneEntity[];
}

/**
 * Transform every slab-opening hosted on a slab in `movedIds` via `computePatch`, in a
 * single batch `updateEntities` commit. Returns the transformed opening entities (for the
 * emit) AND their pre-transform snapshots (for snapshot-symmetric undo). No-op
 * (`{moved:[], snapshots:[]}`) when: no slab in `movedIds`, no hosted slab-openings, or
 * the scene manager does not expose `getEntities`.
 *
 * Openings already present in `movedIds` are excluded (they ride the main batch) → never
 * double-transformed.
 */
export function cascadeTransformedSlabOpenings(
  movedIds: readonly string[],
  sceneManager: SlabOpeningCascadeSceneManager,
  computePatch: (opening: Entity) => Partial<SceneEntity> | null,
): SlabOpeningCascadeResult {
  if (movedIds.length === 0) return { moved: [], snapshots: [] };
  const all = sceneManager.getEntities?.();
  if (!all) return { moved: [], snapshots: [] };
  const entities = all as unknown as readonly Entity[];

  const { slabIds } = partitionBimHosts(movedIds, entities);
  if (slabIds.size === 0) return { moved: [], snapshots: [] };

  const exclude = new Set(movedIds);
  const openingIds = findHostedSlabOpenings(slabIds, entities, exclude);
  if (openingIds.length === 0) return { moved: [], snapshots: [] };

  const patches = new Map<string, Partial<SceneEntity>>();
  const moved: SceneEntity[] = [];
  const snapshots: SceneEntity[] = [];
  for (const openingId of openingIds) {
    const raw = sceneManager.getEntity(openingId);
    if (!raw) continue;
    const patch = computePatch(raw as unknown as Entity);
    if (!patch) continue;
    patches.set(openingId, patch);
    moved.push({ ...raw, ...patch } as SceneEntity);
    snapshots.push(deepClone(raw));
  }

  if (patches.size > 0) sceneManager.updateEntities(patches);
  return { moved, snapshots };
}
