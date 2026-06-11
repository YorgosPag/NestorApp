'use client';

/**
 * ADR-421 SLICE C «type always wins» — opening re-resolution on family-type
 * catalog change. The opening analogue of `useWallTypeReresolution`.
 *
 * Subscribes to the `BimFamilyType` store `version` counter and, on every bump
 * (a type edit OR a late type load landing after opening docs already mapped to
 * scene entities), re-runs resolution over the active scene's typed openings so
 * their cached type-governed params (kind/width/height/frame/glazing) re-flow
 * from the live type and their geometry recomputes against the host wall.
 *
 * Locally dirty openings are skipped (local edits win); untyped openings are
 * untouched (legacy fast-path = ZERO regression).
 *
 * @see ../../bim/family-types/opening-type-resolution.ts §reresolveSceneOpenings
 * @see ../../bim/family-types/resolve-effective-params.ts
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import { useEffect, type RefObject } from 'react';

import type { SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { reresolveSceneOpenings } from '../../bim/family-types/opening-type-resolution';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/**
 * Wire family-type re-resolution into the opening scene-sync path.
 *
 * @param levelManager Active level scene accessor (same instance the persistence
 *   hook uses).
 * @param dirtyIdsRef  Opening ids with un-persisted local edits (skipped during
 *   re-resolution so local edits always win).
 */
export function useOpeningTypeReresolution(
  levelManager: LevelManagerLike,
  dirtyIdsRef: RefObject<Set<string>>,
): void {
  useEffect(() => {
    const reresolveScene = () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const next = reresolveSceneOpenings(scene, dirtyIdsRef.current ?? new Set());
      if (next !== scene) levelManager.setLevelScene(levelId, next, 'system-reconcile');
    };

    // subscribeWithSelector: fire only when `version` actually changes.
    return useBimFamilyTypeStore.subscribe((s) => s.version, reresolveScene);
  }, [levelManager, dirtyIdsRef]);
}
