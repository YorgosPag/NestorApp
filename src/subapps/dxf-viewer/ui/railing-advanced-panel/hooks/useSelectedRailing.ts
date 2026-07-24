'use client';

/**
 * ADR-407 Φ9 — Resolve currently selected `RailingEntity` from the
 * orchestrator-level primary selection ID + scene model. Mirrors
 * `useSelectedWall` (ADR-363 Phase 1D) / `useSelectedStair` (ADR-358).
 * Pure derivation — no extra subscriptions (Google-level SSoT, ADR-040
 * micro-leaf rule).
 *
 * Returns `null` when no entity selected, the selected entity is not a
 * railing, or the scene is unavailable.
 */

import { useMemo } from 'react';
import { isRailingEntity } from '../../../types/entities';
import type { RailingEntity } from '../../../bim/types/railing-types';
import type { SceneModel } from '../../../types/scene';

export function useSelectedRailing(
  primarySelectedId: string | null,
  scene: SceneModel | null,
): RailingEntity | null {
  return useMemo(() => {
    if (!primarySelectedId || !scene) return null;
    const entity = scene.entities.find((e) => e.id === primarySelectedId);
    if (!entity || !isRailingEntity(entity)) return null;
    return entity;
  }, [primarySelectedId, scene]);
}
