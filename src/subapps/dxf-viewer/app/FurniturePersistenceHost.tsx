'use client';

/**
 * ADR-410 — Always-on host for furniture Firestore persistence.
 *
 * Mirrors `MepFixturePersistenceHost` but for mesh-based furniture — renders
 * `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'furniture') → first-save
 *   - debounced auto-save when `primarySelectedFurniture.params` change
 *   - subscribes to Firestore + diff-merges incoming furniture docs into the scene
 *   - feeds the 3D entity store (`setFurnitures`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { FurnitureEntity } from '../bim/types/furniture-types';
import { isFurnitureEntity } from '../types/entities';
import { useFurniturePersistence } from '../hooks/data/useFurniturePersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface FurniturePersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function FurniturePersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
}: FurniturePersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedFurniture: FurnitureEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isFurnitureEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const furnitures = currentScene?.entities.filter(isFurnitureEntity) ?? [];
    useBim3DEntitiesStore.getState().setFurnitures(furnitures);
  }, [currentScene]);

  useFurniturePersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedFurniture,
  });

  return null;
}
