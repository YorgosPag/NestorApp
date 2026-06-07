'use client';

/**
 * ADR-408 Φ12 — Always-on host for plumbing manifold Firestore persistence.
 *
 * Mirrors `ElectricalPanelPersistenceHost` but for point-based plumbing manifolds —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while
 * the viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-manifold') → first-save
 *   - debounced auto-save when `primarySelectedManifold.params` change
 *   - subscribes to Firestore + diff-merges incoming manifold docs into the scene
 *   - feeds the 3D entity store (`setManifolds`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { MepManifoldEntity } from '../bim/types/mep-manifold-types';
import { isMepManifoldEntity } from '../types/entities';
import { useMepManifoldPersistence } from '../hooks/data/useMepManifoldPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepManifoldPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key forwarded from DxfViewerTopBar. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

export function MepManifoldPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepManifoldPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedManifold: MepManifoldEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepManifoldEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const manifolds = currentScene?.entities.filter(isMepManifoldEntity) ?? [];
    useBim3DEntitiesStore.getState().setManifolds(manifolds);
  }, [currentScene]);

  useMepManifoldPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedManifold,
  });

  return null;
}
