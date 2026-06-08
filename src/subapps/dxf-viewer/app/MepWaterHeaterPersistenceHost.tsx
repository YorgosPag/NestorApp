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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { MepWaterHeaterEntity } from '../bim/types/mep-water-heater-types';
import { isMepWaterHeaterEntity } from '../types/entities';
import { useMepWaterHeaterPersistence } from '../hooks/data/useMepWaterHeaterPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepWaterHeaterPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

export function MepWaterHeaterPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepWaterHeaterPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedWaterHeater: MepWaterHeaterEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepWaterHeaterEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const waterHeaters = currentScene?.entities.filter(isMepWaterHeaterEntity) ?? [];
    useBim3DEntitiesStore.getState().setWaterHeaters(waterHeaters);
  }, [currentScene]);

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
