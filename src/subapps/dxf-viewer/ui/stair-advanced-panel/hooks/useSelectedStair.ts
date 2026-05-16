'use client';

/**
 * ADR-358 Phase 7b2a — Resolve the currently selected `StairEntity` from
 * the orchestrator-level primary selection ID + scene model. The orchestrator
 * (`DxfViewerContent`) already subscribes to `useUniversalSelection` and
 * `useLevelManager`; this hook stays a pure derivation to avoid duplicating
 * subscriptions (Google-level SSoT, ADR-040 micro-leaf rule).
 *
 * Returns `null` when no entity is selected, the selected entity is not a
 * stair, or the scene is unavailable.
 */

import { useMemo } from 'react';
import { isStairEntity } from '../../../types/entities';
import type { StairEntity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

export function useSelectedStair(
  primarySelectedId: string | null,
  scene: SceneModel | null,
): StairEntity | null {
  return useMemo(() => {
    if (!primarySelectedId || !scene) return null;
    const entity = scene.entities.find((e) => e.id === primarySelectedId);
    if (!entity || !isStairEntity(entity)) return null;
    return entity;
  }, [primarySelectedId, scene]);
}
