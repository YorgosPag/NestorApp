'use client';

/**
 * ADR-683 Φ3.1γ (B1) — Resolve currently selected `ImportedMeshEntity` from the
 * orchestrator-level primary selection ID + scene model. Mirrors
 * `useSelectedRailing` (ADR-407 Φ9) / `useSelectedWall` (ADR-363 Phase 1D).
 * Pure derivation — no extra subscriptions (Google-level SSoT, ADR-040
 * micro-leaf rule).
 *
 * Returns `null` when no entity selected, the selected entity is not an
 * imported mesh, or the scene is unavailable.
 */

import { useMemo } from 'react';
import { isImportedMeshEntity } from '../../../types/entities';
import type { ImportedMeshEntity } from '../../../bim/entities/imported-mesh/imported-mesh-types';
import type { SceneModel } from '../../../types/scene';

export function useSelectedImportedMesh(
  primarySelectedId: string | null,
  scene: SceneModel | null,
): ImportedMeshEntity | null {
  return useMemo(() => {
    if (!primarySelectedId || !scene) return null;
    const entity = scene.entities.find((e) => e.id === primarySelectedId);
    if (!entity || !isImportedMeshEntity(entity)) return null;
    return entity;
  }, [primarySelectedId, scene]);
}
