'use client';

/**
 * ADR-408 Φ8 — Always-on host for MEP segment Firestore persistence.
 *
 * Mirrors `ElectricalPanelPersistenceHost` but for linear MEP segments
 * (duct/pipe) — renders `null`. Mounted in `DxfViewerTopBar` so the hook
 * lifecycle runs while the viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-segment') → first-save
 *   - auto-save on `bim:mep-segment-params-updated`
 *   - subscribes to Firestore + diff-merges incoming segment docs into the scene
 *   - feeds the 3D entity store (`setMepSegments`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { isMepSegmentEntity } from '../types/entities';
import { useMepSegmentPersistence } from '../hooks/data/useMepSegmentPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepSegmentPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function MepSegmentPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
}: MepSegmentPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedSegment = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepSegmentEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const segments = currentScene?.entities.filter(isMepSegmentEntity) ?? [];
    useBim3DEntitiesStore.getState().setMepSegments(segments);
  }, [currentScene]);

  useMepSegmentPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedSegment,
  });

  return null;
}
