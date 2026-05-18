'use client';

/**
 * ADR-363 Phase 1D — Resolve currently selected `WallEntity` from the
 * orchestrator-level primary selection ID + scene model. Mirrors
 * `useSelectedStair` (ADR-358 Phase 7b2a). Pure derivation — no extra
 * subscriptions (Google-level SSoT, ADR-040 micro-leaf rule).
 *
 * Returns `null` when no entity selected, the selected entity is not a
 * wall, or the scene is unavailable.
 */

import { useMemo } from 'react';
import { isWallEntity } from '../../../types/entities';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { SceneModel } from '../../../types/scene';

export function useSelectedWall(
  primarySelectedId: string | null,
  scene: SceneModel | null,
): WallEntity | null {
  return useMemo(() => {
    if (!primarySelectedId || !scene) return null;
    const entity = scene.entities.find((e) => e.id === primarySelectedId);
    if (!entity || !isWallEntity(entity)) return null;
    return entity;
  }, [primarySelectedId, scene]);
}
