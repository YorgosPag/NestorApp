'use client';

/**
 * ADR-363 Phase 5 — Always-on host για Beam Firestore persistence.
 *
 * Mirrors `ColumnPersistenceHost` αλλά για beams — renders `null`.
 * Mounted στο `DxfViewerTopBar` ώστε το hook lifecycle να τρέχει ενώ ο
 * viewer είναι ενεργός:
 *   - listens για `drawing:entity-created` (tool: 'beam') → first-save
 *   - debounced auto-save όταν `primarySelectedBeam.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming beam docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { BeamEntity } from '../bim/types/beam-types';
import { isBeamEntity } from '../types/entities';
import { useBeamPersistence } from '../hooks/data/useBeamPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface BeamPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function BeamPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: BeamPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedBeam: BeamEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isBeamEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const beams = currentScene?.entities.filter(isBeamEntity) ?? [];
    useBim3DEntitiesStore.getState().setBeams(beams);
  }, [currentScene]);

  useBeamPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedBeam,
  });

  return null;
}
