/**
 * building-visibility-state — pure helpers for 3D building visibility.
 * ADR-369 Q2.3. No React, no Three.js.
 */

import type { BuildingRef } from '../../bim/utils/bim-floor-utils';

export type BuildingVisMode = 'show' | 'ghost' | 'hide';
export type BuildingPreset = 'all' | 'active' | 'none' | 'isolate';

/** Compute new visibility map for a given preset.
 *
 * 'all'     → all show
 * 'active'  → activeBuildingId show, others ghost  (soft focus — "Focus" button)
 * 'none'    → all hide
 * 'isolate' → activeBuildingId show, others hide   (hard filter)
 */
export function applyBuildingsPreset(
  buildings: readonly BuildingRef[],
  preset: BuildingPreset,
  activeBuildingId: string | null,
): Map<string, BuildingVisMode> {
  const next = new Map<string, BuildingVisMode>();
  for (const b of buildings) {
    switch (preset) {
      case 'all':
        next.set(b.id, 'show');
        break;
      case 'active':
        next.set(b.id, b.id === activeBuildingId ? 'show' : 'ghost');
        break;
      case 'none':
        next.set(b.id, 'hide');
        break;
      case 'isolate':
        next.set(b.id, b.id === activeBuildingId ? 'show' : 'hide');
        break;
    }
  }
  return next;
}
