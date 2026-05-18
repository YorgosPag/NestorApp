'use client';

/**
 * ADR-363 Phase 3.7 — Always-on host για Slab-Opening Firestore persistence.
 *
 * Mirrors `SlabPersistenceHost` αλλά για slab-opening entities — renders
 * `null`. Mounted στο `DxfViewerTopBar` ώστε το hook lifecycle να τρέχει
 * όσο ο viewer είναι ενεργός:
 *   - listens για `drawing:entity-created` (tool: 'slab-opening') → first-save
 *   - debounced auto-save όταν `primarySelectedSlabOpening.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10 §11.Q3
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { SlabOpeningEntity } from '../bim/types/slab-opening-types';
import { isSlabOpeningEntity } from '../types/entities';
import { useSlabOpeningPersistence } from '../hooks/data/useSlabOpeningPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface SlabOpeningPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
}

export function SlabOpeningPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
}: SlabOpeningPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedSlabOpening: SlabOpeningEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isSlabOpeningEntity(e)) return null;
    return e as unknown as SlabOpeningEntity;
  }, [primarySelectedId, currentScene]);

  useSlabOpeningPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedSlabOpening,
  });

  return null;
}
