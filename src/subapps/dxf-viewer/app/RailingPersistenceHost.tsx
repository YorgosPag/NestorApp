'use client';

/**
 * ADR-407 — Always-on host for railing Firestore persistence.
 *
 * Mirrors `MepFixturePersistenceHost` but for path-based railings — renders
 * `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'railing') → first-save
 *   - debounced auto-save when `primarySelectedRailing.params` change
 *   - subscribes to Firestore + diff-merges incoming railing docs into the scene
 *   - feeds the 3D entity store (`setRailings`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { RailingEntity } from '../bim/types/railing-types';
import { isRailingEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useRailingPersistence } from '../hooks/data/useRailingPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface RailingPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function RailingPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: RailingPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the railing slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedRailing: RailingEntity | null =
    selectedEntity && isRailingEntity(selectedEntity) ? selectedEntity : null;

  const railings = useSceneEntitiesByType<RailingEntity>(currentLevelId, isRailingEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setRailings(railings);
  }, [railings]);

  useRailingPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedRailing,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized parent does; with it, a non-railing edit (which leaves
 * `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. Scene reactivity arrives through leaf selectors.
 * Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const RailingPersistenceHost = React.memo(RailingPersistenceHostImpl);
RailingPersistenceHost.displayName = 'RailingPersistenceHost';
