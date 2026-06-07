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
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId' | 'levels'
>;

export interface OpeningPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  /** ADR-420 — stable building-storey scope key forwarded to useOpeningPersistence. */
  readonly floorId?: string;
}

export function OpeningPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: OpeningPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedOpening: OpeningEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isOpeningEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  // ADR-363 Bug 2 — push opening entities στο Bim3DEntitiesStore ώστε ο 3D
  // viewer να ενσωματώσει wall cutouts (THREE.Shape.holes per-segment).
  // Mirror του SlabOpeningPersistenceHost pattern. CHECK 6B/6C compliant —
  // low-freq (user-triggered scene changes).
  React.useEffect(() => {
    const openings = (currentScene?.entities.filter(isOpeningEntity) ?? []) as readonly OpeningEntity[];
    useBim3DEntitiesStore.getState().setOpenings(openings);
  }, [currentScene]);

  useOpeningPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedOpening,
  });

  return null;
}
