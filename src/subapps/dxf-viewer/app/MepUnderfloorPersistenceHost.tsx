'use client';

/**
 * ADR-408 Εύρος Β #3 — Always-on host for underfloor heating Firestore persistence.
 *
 * Mirrors `MepBoilerPersistenceHost` but for area-based underfloor heating loops —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-underfloor') → first-save
 *   - debounced auto-save when `primarySelectedUnderfloor.params` change
 *   - subscribes to Firestore + diff-merges incoming underfloor docs into the scene
 *   - feeds the 3D entity store (`setUnderfloors`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { MepUnderfloorEntity } from '../bim/types/mep-underfloor-types';
import { isMepUnderfloorEntity } from '../types/entities';
import { useMepUnderfloorPersistence } from '../hooks/data/useMepUnderfloorPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepUnderfloorPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
}

export function MepUnderfloorPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: MepUnderfloorPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedUnderfloor: MepUnderfloorEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepUnderfloorEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const underfloors = currentScene?.entities.filter(isMepUnderfloorEntity) ?? [];
    useBim3DEntitiesStore.getState().setUnderfloors(underfloors);
  }, [currentScene]);

  useMepUnderfloorPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedUnderfloor,
  });

  return null;
}
