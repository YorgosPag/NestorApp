'use client';
// 🏢 ADR-363 Phase 1E — Wall re-trim effect helper
// Extracted from useSpecialTools.ts to keep that file ≤500 LOC (Google SRP).

import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { recomputeWallTrims } from '../../bim/walls/add-wall-to-scene';
import type { LevelsHookReturn } from '../../systems/levels';

/**
 * ADR-363 Phase 1E / 1L-J — Re-trim all walls after a grip commit or an explicit
 * join-override change settles (200 ms debounce). Delegates to the SSoT
 * `recomputeWallTrims` (strip → recompute → apply → persist-changed) so a wall
 * that flips to `butt`/`disallow` correctly CLEARS its stale miter, and patched
 * neighbours persist. `LevelsHookReturn` structurally satisfies `WallSceneAccessor`.
 */
export function useWallRetrimEffect(levelManager: LevelsHookReturn): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = EventBus.on('bim:wall-params-updated', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => recomputeWallTrims(levelManager), 200);
    });
    return () => {
      cleanup();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [levelManager]);
}
