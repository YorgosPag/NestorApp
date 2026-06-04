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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { SlabEntity } from '../bim/types/slab-types';
import { isSlabEntity } from '../types/entities';
import { useSlabPersistence } from '../hooks/data/useSlabPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
import { EditSlabTypeDialog } from '../ui/ribbon/components/EditSlabTypeDialog';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface SlabPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function SlabPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: SlabPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedSlab: SlabEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isSlabEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const slabs = currentScene?.entities.filter(isSlabEntity) ?? [];
    useBim3DEntitiesStore.getState().setSlabs(slabs);
  }, [currentScene]);

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
