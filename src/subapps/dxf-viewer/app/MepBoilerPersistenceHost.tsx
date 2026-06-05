'use client';

/**
 * ADR-408 Εύρος Β #2 — Always-on host for heating boiler Firestore persistence.
 *
 * Mirrors `MepRadiatorPersistenceHost` but for point-based heating boilers —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-boiler') → first-save
 *   - debounced auto-save when `primarySelectedBoiler.params` change
 *   - subscribes to Firestore + diff-merges incoming boiler docs into the scene
 *   - feeds the 3D entity store (`setBoilers`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { MepBoilerEntity } from '../bim/types/mep-boiler-types';
import { isMepBoilerEntity } from '../types/entities';
import { useMepBoilerPersistence } from '../hooks/data/useMepBoilerPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepBoilerPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function MepBoilerPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
}: MepBoilerPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedBoiler: MepBoilerEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepBoilerEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const boilers = currentScene?.entities.filter(isMepBoilerEntity) ?? [];
    useBim3DEntitiesStore.getState().setBoilers(boilers);
  }, [currentScene]);

  useMepBoilerPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedBoiler,
  });

  return null;
}
