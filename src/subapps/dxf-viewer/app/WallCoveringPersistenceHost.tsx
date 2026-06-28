'use client';

/**
 * ADR-511 — Always-on host για wall-covering Firestore persistence.
 *
 * Mirror του `FloorFinishPersistenceHost` (ADR-419) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'wall-covering') → first-save
 *   - debounced auto-save όταν αλλάζουν τα `params` του επιλεγμένου covering
 *   - subscribes στο Firestore + diff-merges incoming docs στο scene
 *
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant. (Το 3D feed
 * προστίθεται στο Slice D — wall-covering-to-three.)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { WallCoveringEntity } from '../bim/types/wall-covering-types';
import { isWallCoveringEntity } from '../types/entities';
import { useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useWallCoveringPersistence } from '../hooks/data/useWallCoveringPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface WallCoveringPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function WallCoveringPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: WallCoveringPersistenceHostProps): null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity
  // changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelected: WallCoveringEntity | null =
    selectedEntity && isWallCoveringEntity(selectedEntity) ? selectedEntity : null;

  useWallCoveringPersistence({
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
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-wall-covering edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selector (`useSceneEntityById`), not a prop.
 */
export const WallCoveringPersistenceHost = React.memo(WallCoveringPersistenceHostImpl);
WallCoveringPersistenceHost.displayName = 'WallCoveringPersistenceHost';
