'use client';

/**
 * ADR-408 Εύρος Β #1 — Always-on host for heating radiator Firestore persistence.
 *
 * Mirrors `MepManifoldPersistenceHost` but for point-based heating radiators —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-radiator') → first-save
 *   - debounced auto-save when `primarySelectedRadiator.params` change
 *   - subscribes to Firestore + diff-merges incoming radiator docs into the scene
 *   - feeds the 3D entity store (`setRadiators`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { MepRadiatorEntity } from '../bim/types/mep-radiator-types';
import { isMepRadiatorEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useMepRadiatorPersistence } from '../hooks/data/useMepRadiatorPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface MepRadiatorPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

function MepRadiatorPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepRadiatorPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the radiator slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedRadiator: MepRadiatorEntity | null =
    selectedEntity && isMepRadiatorEntity(selectedEntity) ? selectedEntity : null;

  const radiators = useSceneEntitiesByType<MepRadiatorEntity>(currentLevelId, isMepRadiatorEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setRadiators(radiators);
  }, [radiators]);

  useMepRadiatorPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedRadiator,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-radiator edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const MepRadiatorPersistenceHost = React.memo(MepRadiatorPersistenceHostImpl);
MepRadiatorPersistenceHost.displayName = 'MepRadiatorPersistenceHost';
