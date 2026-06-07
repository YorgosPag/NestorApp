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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { ElectricalPanelEntity } from '../bim/types/electrical-panel-types';
import { isElectricalPanelEntity } from '../types/entities';
import { useElectricalPanelPersistence } from '../hooks/data/useElectricalPanelPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface ElectricalPanelPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
}

export function ElectricalPanelPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: ElectricalPanelPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedPanel: ElectricalPanelEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isElectricalPanelEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const panels = currentScene?.entities.filter(isElectricalPanelEntity) ?? [];
    useBim3DEntitiesStore.getState().setPanels(panels);
  }, [currentScene]);

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
