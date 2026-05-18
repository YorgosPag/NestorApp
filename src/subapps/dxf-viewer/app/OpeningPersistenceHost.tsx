'use client';

/**
 * ADR-363 Phase 2 — Always-on host για Opening Firestore persistence.
 *
 * Mirrors `WallPersistenceHost` but για openings — renders `null`. Mounted
 * στο `DxfViewerTopBar` so the hook lifecycle τρέχει while the viewer is
 * active:
 *   - listens for `drawing:entity-created` (tool: 'opening') → first-save
 *   - debounced auto-save όταν `primarySelectedOpening.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming opening docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { OpeningEntity } from '../bim/types/opening-types';
import { isOpeningEntity } from '../types/entities';
import { useOpeningPersistence } from '../hooks/data/useOpeningPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface OpeningPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
}

export function OpeningPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
}: OpeningPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedOpening: OpeningEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isOpeningEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useOpeningPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedOpening,
  });

  return null;
}
