'use client';

/**
 * ADR-436 — Always-on host για Foundation persistence (renders `null`).
 *
 * Mounted στο `DxfViewerTopBar`. Δύο responsibilities:
 *   1. **3D push** (Slice 1): όποτε αλλάζει το scene, σπρώχνει τα
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
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { FoundationEntity } from '../bim/types/foundation-types';
import { isFoundationEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useFoundationPersistence } from '../hooks/data/useFoundationPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface FoundationPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly floorId?: string;
}

function FoundationPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: FoundationPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the foundation slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedFoundation: FoundationEntity | null =
    selectedEntity && isFoundationEntity(selectedEntity) ? selectedEntity : null;

  const foundations = useSceneEntitiesByType<FoundationEntity>(currentLevelId, isFoundationEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setFoundations(foundations);
  }, [foundations]);

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

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-foundation edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const FoundationPersistenceHost = React.memo(FoundationPersistenceHostImpl);
FoundationPersistenceHost.displayName = 'FoundationPersistenceHost';
