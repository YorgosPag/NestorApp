'use client';

/**
 * ADR-511 — Always-on host για wall-covering Firestore persistence.
 *
 * Mirror του `FloorFinishPersistenceHost` (ADR-419) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'wall-covering') → first-save
 *   - debounced auto-save όταν αλλάζουν τα `params` του επιλεγμένου covering
 *   - subscribes στο Firestore + diff-merges incoming docs στο scene
 *
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant. (Το 3D feed
 * προστίθεται στο Slice D — wall-covering-to-three.)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { WallCoveringEntity } from '../bim/types/wall-covering-types';
import { isWallCoveringEntity } from '../types/entities';
import { useWallCoveringPersistence } from '../hooks/data/useWallCoveringPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface WallCoveringPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function WallCoveringPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: WallCoveringPersistenceHostProps): null {
  const { user } = useAuth();

  const primarySelected: WallCoveringEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isWallCoveringEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useWallCoveringPersistence({
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
