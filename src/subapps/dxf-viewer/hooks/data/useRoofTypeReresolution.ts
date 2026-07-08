'use client';

/**
 * ADR-417 §10 #3 «type always wins» — roof re-resolution on family-type catalog
 * change (roof analogue of `useSlabTypeReresolution`).
 *
 * Subscribes to the `BimFamilyType` store `version` counter and, on every bump
 * (a type edit OR a late type load that lands after the roof docs already mapped
 * to scene entities), re-runs resolution over the active scene's typed roofs so
 * their cached type-governed params (`thickness`/`dna`/`material`) re-flow from
 * the live type — which activates the per-layer 3D roof rendering and keeps every
 * placed roof of a type in sync when the type is edited.
 *
 * Locally dirty roofs are skipped (local edits win); untyped roofs are untouched
 * (legacy fast-path = ZERO regression).
 *
 * @see ./roof-persistence-helpers.ts — reresolveSceneRoofs (pure SSoT)
 * @see ./useSlabTypeReresolution.ts — the slab sibling
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import { useEffect, type RefObject } from 'react';

import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { reresolveSceneRoofs } from './roof-persistence-helpers';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';


/**
 * Wire family-type re-resolution into the roof scene-sync path.
 *
 * @param levelManager Active level scene accessor (same instance the
 *   persistence hook uses).
 * @param dirtyIdsRef  Roof ids with un-persisted local edits (skipped during
 *   re-resolution so local edits always win).
 */
export function useRoofTypeReresolution(
  levelManager: LevelSceneWriter,
  dirtyIdsRef: RefObject<Set<string>>,
): void {
  useEffect(() => {
    const reresolveScene = () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const next = reresolveSceneRoofs(scene, dirtyIdsRef.current ?? new Set());
      if (next !== scene) levelManager.setLevelScene(levelId, next, 'system-reconcile');
    };

    // subscribeWithSelector: fire only when `version` actually changes.
    return useBimFamilyTypeStore.subscribe((s) => s.version, reresolveScene);
  }, [levelManager, dirtyIdsRef]);
}
