'use client';

/**
 * ADR-408 Εύρος Β #2 — Always-on host for heating boiler Firestore persistence.
 *
 * Mirrors `MepRadiatorPersistenceHost` but for point-based heating boilers —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-boiler') → first-save
 *   - debounced auto-save when `primarySelectedBoiler.params` change
 *   - subscribes to Firestore + diff-merges incoming boiler docs into the scene
 *   - feeds the 3D entity store (`setBoilers`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { MepBoilerEntity } from '../bim/types/mep-boiler-types';
import { isMepBoilerEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useMepBoilerPersistence } from '../hooks/data/useMepBoilerPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepBoilerPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

function MepBoilerPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepBoilerPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the boiler slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedBoiler: MepBoilerEntity | null =
    selectedEntity && isMepBoilerEntity(selectedEntity) ? selectedEntity : null;

  const boilers = useSceneEntitiesByType<MepBoilerEntity>(currentLevelId, isMepBoilerEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setBoilers(boilers);
  }, [boilers]);

  useMepBoilerPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedBoiler,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-boiler edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const MepBoilerPersistenceHost = React.memo(MepBoilerPersistenceHostImpl);
MepBoilerPersistenceHost.displayName = 'MepBoilerPersistenceHost';
