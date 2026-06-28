'use client';

/**
 * ADR-422 L0 — Always-on host για thermal-space Firestore persistence.
 *
 * Mirror του `FloorFinishPersistenceHost` (ADR-419) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'thermal-space') → first-save
 *   - debounced auto-save when `primarySelectedThermalSpace.params` change
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *
 * 3D feed ΔΕΝ υπάρχει (ο θερμικός χώρος είναι 2D analytical overlay — ADR-422 L0).
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { ThermalSpaceEntity } from '../bim/types/thermal-space-types';
import { isThermalSpaceEntity } from '../types/entities';
import { useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useThermalSpacePersistence } from '../hooks/data/useThermalSpacePersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface ThermalSpacePersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function ThermalSpacePersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: ThermalSpacePersistenceHostProps): null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity
  // changes, never when an unrelated entity type is edited. No 3D feed —
  // `useSceneEntitiesByType` not needed (thermal space is a 2D analytical
  // overlay — ADR-422 L0).
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelected: ThermalSpaceEntity | null =
    selectedEntity && isThermalSpaceEntity(selectedEntity) ? selectedEntity : null;

  useThermalSpacePersistence({
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
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized parent does; with it, a non-thermal-space edit (which leaves
 * `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. Scene reactivity arrives through the leaf
 * selector (`useSceneEntityById`). Pairs with dropping `currentScene` from
 * the mount in DxfViewerTopBar.
 */
export const ThermalSpacePersistenceHost = React.memo(ThermalSpacePersistenceHostImpl);
ThermalSpacePersistenceHost.displayName = 'ThermalSpacePersistenceHost';
