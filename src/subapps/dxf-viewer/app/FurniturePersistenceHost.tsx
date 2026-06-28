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
import type { useLevels } from '../systems/levels';
import type { FurnitureEntity } from '../bim/types/furniture-types';
import { isFurnitureEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useFurniturePersistence } from '../hooks/data/useFurniturePersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface FurniturePersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
}

function FurniturePersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: FurniturePersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the furniture slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedFurniture: FurnitureEntity | null =
    selectedEntity && isFurnitureEntity(selectedEntity) ? selectedEntity : null;

  const furnitures = useSceneEntitiesByType<FurnitureEntity>(currentLevelId, isFurnitureEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setFurnitures(furnitures);
  }, [furnitures]);

  useFurniturePersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedFurniture,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-furniture edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const FurniturePersistenceHost = React.memo(FurniturePersistenceHostImpl);
FurniturePersistenceHost.displayName = 'FurniturePersistenceHost';
