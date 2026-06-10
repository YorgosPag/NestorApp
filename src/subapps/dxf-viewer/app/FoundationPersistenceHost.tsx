'use client';

/**
 * ADR-436 — Always-on host για Foundation persistence (renders `null`).
 *
 * Mounted στο `DxfViewerTopBar`. Δύο responsibilities:
 *   1. **3D push** (Slice 1): όποτε αλλάζει το `currentScene`, σπρώχνει τα
 *      `FoundationEntity` στο `Bim3DEntitiesStore` (→ `BimSceneLayer.syncFoundations`).
 *   2. **Firestore persistence** (Slice 1-persist, mirror `ColumnPersistenceHost`):
 *      - listens για `drawing:entity-created` (tool: 'foundation') → first-save
 *      - debounced auto-save όταν `primarySelectedFoundation.params` αλλάξουν
 *      - subscribes σε Firestore + diff-merges incoming foundation docs στο scene
 *      - delete μέσω `bim:foundation-delete-requested`
 *
 * **ΧΩΡΙΣ buildingId / BOQ** — η θεμελίωση είναι structural substructure
 * (BOQ/ATOE = Slice 4), όπως ακριβώς η κολώνα.
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { FoundationEntity } from '../bim/types/foundation-types';
import { isFoundationEntity } from '../types/entities';
import { useFoundationPersistence } from '../hooks/data/useFoundationPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface FoundationPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly floorId?: string;
}

export function FoundationPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: FoundationPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedFoundation: FoundationEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isFoundationEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const foundations = currentScene?.entities.filter(isFoundationEntity) ?? [];
    useBim3DEntitiesStore.getState().setFoundations(foundations);
  }, [currentScene]);

  useFoundationPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedFoundation,
  });

  return null;
}
