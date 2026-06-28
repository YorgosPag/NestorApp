'use client';

/**
 * ADR-408 DHW — Always-on host for domestic hot water heater Firestore persistence.
 *
 * Mirrors `MepBoilerPersistenceHost` but for point-based domestic hot water heaters
 * (θερμοσίφωνας) — renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle
 * runs while the viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-water-heater') → first-save
 *   - debounced auto-save when `primarySelectedWaterHeater.params` change
 *   - subscribes to Firestore + diff-merges incoming water heater docs into the scene
 *   - feeds the 3D entity store (`setWaterHeaters`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { MepWaterHeaterEntity } from '../bim/types/mep-water-heater-types';
import { isMepWaterHeaterEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useMepWaterHeaterPersistence } from '../hooks/data/useMepWaterHeaterPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepWaterHeaterPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

function MepWaterHeaterPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepWaterHeaterPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the water-heater slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedWaterHeater: MepWaterHeaterEntity | null =
    selectedEntity && isMepWaterHeaterEntity(selectedEntity) ? selectedEntity : null;

  const waterHeaters = useSceneEntitiesByType<MepWaterHeaterEntity>(
    currentLevelId,
    isMepWaterHeaterEntity,
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setWaterHeaters(waterHeaters);
  }, [waterHeaters]);

  useMepWaterHeaterPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedWaterHeater,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-water-heater edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const MepWaterHeaterPersistenceHost = React.memo(MepWaterHeaterPersistenceHostImpl);
MepWaterHeaterPersistenceHost.displayName = 'MepWaterHeaterPersistenceHost';
