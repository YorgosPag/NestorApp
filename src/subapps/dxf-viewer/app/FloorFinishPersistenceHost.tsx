'use client';

/**
 * ADR-419 — Always-on host για floor-finish Firestore persistence.
 *
 * Mirrors `RoofPersistenceHost` (ADR-417) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'floor-finish') → first-save
 *   - debounced auto-save when `primarySelectedFloorFinish.params` change
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *   - feeds the 3D entity store (`setFloorFinishes`)
 *
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { FloorFinishEntity } from '../bim/types/floor-finish-types';
import { isFloorFinishEntity } from '../types/entities';
import { useFloorFinishPersistence } from '../hooks/data/useFloorFinishPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface FloorFinishPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function FloorFinishPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: FloorFinishPersistenceHostProps): null {
  const { user } = useAuth();

  const primarySelected: FloorFinishEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isFloorFinishEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const floorFinishes = currentScene?.entities.filter(isFloorFinishEntity) ?? [];
    useBim3DEntitiesStore.getState().setFloorFinishes(floorFinishes);
  }, [currentScene]);

  useFloorFinishPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelected,
  });

  return null;
}
