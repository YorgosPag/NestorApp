'use client';

/**
 * ADR-408 Φ3 — Always-on host for electrical panel Firestore persistence.
 *
 * Mirrors `MepFixturePersistenceHost` but for point-based electrical panels —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while
 * the viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'electrical-panel') → first-save
 *   - debounced auto-save when `primarySelectedPanel.params` change
 *   - subscribes to Firestore + diff-merges incoming panel docs into the scene
 *   - feeds the 3D entity store (`setPanels`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { ElectricalPanelEntity } from '../bim/types/electrical-panel-types';
import { isElectricalPanelEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useElectricalPanelPersistence } from '../hooks/data/useElectricalPanelPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface ElectricalPanelPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
}

function ElectricalPanelPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: ElectricalPanelPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the panel slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedPanel: ElectricalPanelEntity | null =
    selectedEntity && isElectricalPanelEntity(selectedEntity) ? selectedEntity : null;

  const panels = useSceneEntitiesByType<ElectricalPanelEntity>(
    currentLevelId,
    isElectricalPanelEntity,
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setPanels(panels);
  }, [panels]);

  useElectricalPanelPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedPanel,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-panel edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const ElectricalPanelPersistenceHost = React.memo(ElectricalPanelPersistenceHostImpl);
ElectricalPanelPersistenceHost.displayName = 'ElectricalPanelPersistenceHost';
