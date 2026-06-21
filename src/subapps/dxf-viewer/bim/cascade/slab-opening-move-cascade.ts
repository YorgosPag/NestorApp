/**
 * Slab-Opening Move Cascade — ADR-049 (mirror of `wall-opening-coordinator`).
 *
 * Slab-openings store their footprint as an INDEPENDENT world polygon
 * (`SlabOpeningParams.outline`), unlike wall-openings whose world geometry is
 * derived from the host wall. So when a slab moves, its hosted slab-openings must
 * be TRANSLATED by the same delta (not recomputed against the host).
 *
 * Previously this lived as a selection-expansion (`expandSelectionForMove`) wired
 * ONLY into the Move Tool — so a direct drag or keyboard nudge of a slab left its
 * openings behind. This module moves the cascade INSIDE the Move commands (mirror
 * of `cascadeHostedOpeningsForWalls` / `reframeBeamsAndEmit`), so EVERY gesture
 * (tool / drag / nudge / grip) carries the openings for free — the Revit principle
 * that associative reactions live in the transaction, not the UI gesture.
 *
 * Undo/redo symmetry: the translation is delta-invertible, so undo applies the
 * reverse delta — no per-opening snapshot needed.
 *
 * @see bim/walls/wall-opening-coordinator.ts — the wall-opening twin (recompute)
 * @see bim/cascade/bim-cascade-resolver.ts — `findHostedSlabOpenings` (slabId scan)
 * @see docs/centralized-systems/reference/adrs/ADR-049-unified-move-tool-dxf-overlays.md
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { findHostedSlabOpenings, partitionBimHosts } from './bim-cascade-resolver';
import { calculateBimMovedGeometry } from '../utils/bim-move-geometry';

/**
 * Minimal scene-manager surface the cascade needs. `getEntities` is optional
 * (real adapters implement it; lightweight test mocks without it → no-op).
 */
type CascadeSceneManager = Pick<ISceneManager, 'getEntity' | 'updateEntities'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * Translate every slab-opening hosted on a slab in `movedIds` by `delta`, in a
 * single batch `updateEntities` commit. Returns the moved slab-opening entities
 * so the caller can include them in the `bim:entities-moved` emit (persistence +
 * organism). No-op (`[]`) when: no slab in `movedIds`, no hosted slab-openings,
 * or the scene manager does not expose `getEntities`.
 *
 * Openings already present in `movedIds` are excluded (they ride the main batch)
 * → never double-moved.
 *
 * Call AFTER the slab move has landed in the scene (so `getEntity(openingId)`
 * reads the current opening params for the delta-apply).
 */
export function cascadeMovedSlabOpenings(
  movedIds: readonly string[],
  delta: Point2D,
  sceneManager: CascadeSceneManager,
): SceneEntity[] {
  if (movedIds.length === 0) return [];
  const all = sceneManager.getEntities?.();
  if (!all) return [];
  const entities = all as unknown as readonly Entity[];

  const { slabIds } = partitionBimHosts(movedIds, entities);
  if (slabIds.size === 0) return [];

  const exclude = new Set(movedIds);
  const openingIds = findHostedSlabOpenings(slabIds, entities, exclude);
  if (openingIds.length === 0) return [];

  const patches = new Map<string, Partial<SceneEntity>>();
  const moved: SceneEntity[] = [];
  for (const openingId of openingIds) {
    const raw = sceneManager.getEntity(openingId);
    if (!raw) continue;
    const patch = calculateBimMovedGeometry(raw as unknown as Entity, delta);
    if (!patch) continue;
    patches.set(openingId, patch);
    moved.push({ ...raw, ...patch } as SceneEntity);
  }

  if (patches.size > 0) sceneManager.updateEntities(patches);
  return moved;
}
