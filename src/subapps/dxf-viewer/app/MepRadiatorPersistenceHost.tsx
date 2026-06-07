'use client';

/**
 * ADR-408 Εύρος Β #1 — Always-on host for heating radiator Firestore persistence.
 *
 * Mirrors `MepManifoldPersistenceHost` but for point-based heating radiators —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-radiator') → first-save
 *   - debounced auto-save when `primarySelectedRadiator.params` change
 *   - subscribes to Firestore + diff-merges incoming radiator docs into the scene
 *   - feeds the 3D entity store (`setRadiators`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { MepRadiatorEntity } from '../bim/types/mep-radiator-types';
import { isMepRadiatorEntity } from '../types/entities';
import { useMepRadiatorPersistence } from '../hooks/data/useMepRadiatorPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepRadiatorPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
}

export function MepRadiatorPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: MepRadiatorPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedRadiator: MepRadiatorEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepRadiatorEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const radiators = currentScene?.entities.filter(isMepRadiatorEntity) ?? [];
    useBim3DEntitiesStore.getState().setRadiators(radiators);
  }, [currentScene]);

  useMepRadiatorPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedRadiator,
  });

  return null;
}
