'use client';

/**
 * ADR-422 L0 — Always-on host για thermal-space Firestore persistence.
 *
 * Mirror του `FloorFinishPersistenceHost` (ADR-419) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'thermal-space') → first-save
 *   - debounced auto-save when `primarySelectedThermalSpace.params` change
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *
 * 3D feed ΔΕΝ υπάρχει (ο θερμικός χώρος είναι 2D analytical overlay — ADR-422 L0).
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { ThermalSpaceEntity } from '../bim/types/thermal-space-types';
import { isThermalSpaceEntity } from '../types/entities';
import { useThermalSpacePersistence } from '../hooks/data/useThermalSpacePersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface ThermalSpacePersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function ThermalSpacePersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: ThermalSpacePersistenceHostProps): null {
  const { user } = useAuth();

  const primarySelected: ThermalSpaceEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isThermalSpaceEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useThermalSpacePersistence({
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
