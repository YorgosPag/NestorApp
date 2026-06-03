'use client';

/**
 * ADR-412 «type always wins» — wall re-resolution on family-type catalog change.
 *
 * Extracted from `useWallPersistence` (N.7.1 file size). Subscribes to the
 * `BimFamilyType` store `version` counter and, on every bump (a type edit OR a
 * late type load that lands after the wall docs already mapped to scene
 * entities), re-runs resolution over the active scene's typed walls so their
 * cached type-governed params re-flow from the live type.
 *
 * Reactive idiom mirrors the Firestore subscribe in `useWallPersistence`: read
 * the scene from the level manager, diff-merge via the pure
 * `reresolveSceneWalls` SSoT, and write back only on an actual change. Locally
 * dirty walls are skipped (local edits win); untyped walls are untouched
 * (legacy fast-path = ZERO regression).
 *
 * @see ./wall-persistence-helpers.ts — reresolveSceneWalls (pure SSoT)
 * @see ../../bim/family-types/resolve-effective-params.ts
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 */

import { useEffect, type RefObject } from 'react';

import type { SceneModel } from '../../types/entities';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { reresolveSceneWalls } from './wall-persistence-helpers';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

/**
 * Wire family-type re-resolution into the wall scene-sync path.
 *
 * @param levelManager Active level scene accessor (same instance the
 *   persistence hook uses).
 * @param dirtyIdsRef  Wall ids with un-persisted local edits (skipped during
 *   re-resolution so local edits always win).
 */
export function useWallTypeReresolution(
  levelManager: LevelManagerLike,
  dirtyIdsRef: RefObject<Set<string>>,
): void {
  useEffect(() => {
    const reresolveScene = () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const next = reresolveSceneWalls(scene, dirtyIdsRef.current ?? new Set());
      if (next !== scene) levelManager.setLevelScene(levelId, next);
    };

    // subscribeWithSelector: fire only when `version` actually changes.
    return useBimFamilyTypeStore.subscribe((s) => s.version, reresolveScene);
  }, [levelManager, dirtyIdsRef]);
}
