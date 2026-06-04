'use client';

/**
 * ADR-412 «type always wins» — slab re-resolution on family-type catalog change
 * (slab analogue of `useWallTypeReresolution`).
 *
 * Subscribes to the `BimFamilyType` store `version` counter and, on every bump
 * (a type edit OR a late type load that lands after the slab docs already mapped
 * to scene entities), re-runs resolution over the active scene's typed slabs so
 * their cached type-governed params (`thickness`/`dna`) re-flow from the live
 * type — which is exactly what activates the per-layer 3D slab rendering.
 *
 * Locally dirty slabs are skipped (local edits win); untyped slabs are untouched
 * (legacy fast-path = ZERO regression).
 *
 * @see ./slab-persistence-helpers.ts — reresolveSceneSlabs (pure SSoT)
 * @see ./useWallTypeReresolution.ts — the wall sibling
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 */

import { useEffect, type RefObject } from 'react';

import type { SceneModel } from '../../types/entities';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { reresolveSceneSlabs } from './slab-persistence-helpers';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

/**
 * Wire family-type re-resolution into the slab scene-sync path.
 *
 * @param levelManager Active level scene accessor (same instance the
 *   persistence hook uses).
 * @param dirtyIdsRef  Slab ids with un-persisted local edits (skipped during
 *   re-resolution so local edits always win).
 */
export function useSlabTypeReresolution(
  levelManager: LevelManagerLike,
  dirtyIdsRef: RefObject<Set<string>>,
): void {
  useEffect(() => {
    const reresolveScene = () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const next = reresolveSceneSlabs(scene, dirtyIdsRef.current ?? new Set());
      if (next !== scene) levelManager.setLevelScene(levelId, next);
    };

    // subscribeWithSelector: fire only when `version` actually changes.
    return useBimFamilyTypeStore.subscribe((s) => s.version, reresolveScene);
  }, [levelManager, dirtyIdsRef]);
}
