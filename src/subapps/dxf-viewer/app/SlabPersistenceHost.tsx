'use client';

/**
 * ADR-363 Phase 3 — Always-on host για Slab Firestore persistence.
 *
 * Mirrors `OpeningPersistenceHost` αλλά για slabs — renders `null`.
 * Mounted στο `DxfViewerTopBar` ώστε το hook lifecycle να τρέχει ενώ ο
 * viewer είναι ενεργός:
 *   - listens για `drawing:entity-created` (tool: 'slab') → first-save
 *   - debounced auto-save όταν `primarySelectedSlab.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming slab docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { SlabEntity } from '../bim/types/slab-types';
import { isSlabEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useSlabPersistence } from '../hooks/data/useSlabPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
import { EditSlabTypeDialog } from '../ui/ribbon/components/EditSlabTypeDialog';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface SlabPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function SlabPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: SlabPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the slab slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedSlab: SlabEntity | null =
    selectedEntity && isSlabEntity(selectedEntity) ? selectedEntity : null;

  const slabs = useSceneEntitiesByType<SlabEntity>(currentLevelId, isSlabEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setSlabs(slabs);
  }, [slabs]);

  useSlabPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedSlab,
  });

  // ADR-412 — always-on «Edit Slab Type» dialog (opened via the slab contextual
  // ribbon «Edit type…» button → `openEditSlabType`). Renders only when open.
  return <EditSlabTypeDialog />;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-slab edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const SlabPersistenceHost = React.memo(SlabPersistenceHostImpl);
SlabPersistenceHost.displayName = 'SlabPersistenceHost';
