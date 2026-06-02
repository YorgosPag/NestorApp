'use client';
// 🏢 ADR-363 Phase 1E — Wall re-trim effect helper
// Extracted from useSpecialTools.ts to keep that file ≤500 LOC (Google SRP).

import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { isWallEntity } from '../../types/entities';
import { computeWallTrims, applyTrimPatches } from '../../bim/walls/wall-trims';
import type { LevelsHookReturn } from '../../systems/levels';

/**
 * ADR-363 Phase 1E — Re-trim all walls after a grip commit settles (200 ms).
 * Only runs when ≥2 walls exist and at least one bevel is needed.
 */
export function useWallRetrimEffect(levelManager: LevelsHookReturn): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = EventBus.on('bim:wall-params-updated', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const levelId = levelManager.currentLevelId;
        if (!levelId) return;
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;
        const allWalls = scene.entities.filter(isWallEntity);
        if (allWalls.length < 2) return;
        const trims = computeWallTrims(allWalls);
        if (trims.size === 0) return;
        const patched = applyTrimPatches(scene.entities, trims);
        levelManager.setLevelScene(levelId, { ...scene, entities: patched });
      }, 200);
    });
    return () => {
      cleanup();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [levelManager]);
}
