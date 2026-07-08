'use client';

/**
 * ADR-603 Φ1 — «type always wins» re-resolution hook factory (SSoT).
 *
 * Every BIM family-typed entity (wall / slab / roof / opening / …) wired the
 * SAME `use{X}TypeReresolution` hook: subscribe to the `BimFamilyType` store
 * `version` counter and, on every bump (a type edit OR a late type load landing
 * after the entity docs already mapped to scene entities), re-run resolution
 * over the active scene's typed entities so their cached type-governed params
 * re-flow from the live type. The four hooks were byte-identical except the pure
 * `reresolveScene{X}` SSoT they delegate to — this factory keeps that ONE
 * config-point and shares the reactive plumbing.
 *
 * Idiom (unchanged): read the scene from the level manager, diff-merge via the
 * pure `reresolveScene` SSoT, and write back only on an actual change (`next !==
 * scene`). Locally dirty entities are skipped by the pure fn (local edits win);
 * untyped entities are untouched (legacy fast-path = ZERO regression).
 *
 * Precedent «shared primitive + per-instance binding»:
 *   @see ../../bim/family-types/... createBimEntityPersistenceHook (ADR-594)
 * @see docs/centralized-systems/reference/adrs/ADR-603-generic-family-type-framework.md
 */

import { useEffect, type RefObject } from 'react';

import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import type { SceneModel } from '../../types/scene';

/**
 * Pure per-entity re-resolution SSoT: re-flow type-governed params over a scene,
 * skipping `dirtyIds`. MUST return the SAME reference when nothing changed so the
 * hook can no-op the scene write (identity guard).
 */
export type ReresolveSceneFn = (scene: SceneModel, dirtyIds: Set<string>) => SceneModel;

/**
 * Build a `use{X}TypeReresolution` hook bound to one entity's pure re-resolution
 * SSoT. Assign the result to a `use`-prefixed const so the returned function is a
 * valid React hook (it calls `useEffect`).
 *
 * @param reresolveScene The entity's pure `reresolveScene{X}` SSoT.
 */
export function createTypeReresolutionHook(
  reresolveScene: ReresolveSceneFn,
): (levelManager: LevelSceneWriter, dirtyIdsRef: RefObject<Set<string>>) => void {
  return function useTypeReresolution(
    levelManager: LevelSceneWriter,
    dirtyIdsRef: RefObject<Set<string>>,
  ): void {
    useEffect(() => {
      const reresolveActiveScene = () => {
        const levelId = levelManager.currentLevelId;
        if (!levelId) return;
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;
        const next = reresolveScene(scene, dirtyIdsRef.current ?? new Set());
        if (next !== scene) levelManager.setLevelScene(levelId, next, 'system-reconcile');
      };

      // subscribeWithSelector: fire only when `version` actually changes.
      return useBimFamilyTypeStore.subscribe((s) => s.version, reresolveActiveScene);
    }, [levelManager, dirtyIdsRef]);
  };
}
