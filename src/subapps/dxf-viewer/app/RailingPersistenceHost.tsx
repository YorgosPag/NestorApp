'use client';

/**
 * ADR-407 — Always-on host for railing Firestore persistence.
 *
 * Mirrors `MepFixturePersistenceHost` but for path-based railings — renders
 * `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'railing') → first-save
 *   - debounced auto-save when `primarySelectedRailing.params` change
 *   - subscribes to Firestore + diff-merges incoming railing docs into the scene
 *   - feeds the 3D entity store (`setRailings`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { RailingEntity } from '../bim/types/railing-types';
import { isRailingEntity } from '../types/entities';
import { useRailingPersistence } from '../hooks/data/useRailingPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface RailingPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function RailingPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: RailingPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedRailing: RailingEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isRailingEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const railings = currentScene?.entities.filter(isRailingEntity) ?? [];
    useBim3DEntitiesStore.getState().setRailings(railings);
  }, [currentScene]);

  useRailingPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedRailing,
  });

  return null;
}
