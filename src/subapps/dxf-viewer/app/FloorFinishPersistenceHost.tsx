'use client';

/**
 * ADR-419 — Always-on host για floor-finish Firestore persistence.
 *
 * Mirrors `RoofPersistenceHost` (ADR-417) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'floor-finish') → first-save
 *   - debounced auto-save when `primarySelectedFloorFinish.params` change
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *   - feeds the 3D entity store (`setFloorFinishes`)
 *
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { FloorFinishEntity } from '../bim/types/floor-finish-types';
import { isFloorFinishEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useFloorFinishPersistence } from '../hooks/data/useFloorFinishPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface FloorFinishPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function FloorFinishPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: FloorFinishPersistenceHostProps): null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the floor-finish slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelected: FloorFinishEntity | null =
    selectedEntity && isFloorFinishEntity(selectedEntity) ? selectedEntity : null;

  const floorFinishes = useSceneEntitiesByType<FloorFinishEntity>(
    currentLevelId,
    isFloorFinishEntity,
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setFloorFinishes(floorFinishes);
  }, [floorFinishes]);

  useFloorFinishPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelected,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host bails when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-floor-finish edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop.
 */
export const FloorFinishPersistenceHost = React.memo(FloorFinishPersistenceHostImpl);
FloorFinishPersistenceHost.displayName = 'FloorFinishPersistenceHost';
