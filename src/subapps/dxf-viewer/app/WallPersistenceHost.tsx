'use client';

/**
 * ADR-363 Phase 1B — Always-on host for the Wall Firestore persistence hook.
 *
 * Mirrors `StairAdvancedPanelHost` but renders `null` — Phase 1B has no
 * floating wall properties panel (the contextual ribbon tab is the only UI
 * surface). The host is mounted in `DxfViewerContent` purely so the hook
 * lifecycle runs while the DXF viewer is active:
 *
 *   - listens for `drawing:entity-created` (tool: 'wall') → first-save
 *   - debounced auto-save when `primarySelectedWall.params` change
 *   - subscribes to Firestore + diff-merges incoming wall docs into scene
 *
 * Phase 1.5 will swap this stub for a real `WallAdvancedPanel` (DNA editor,
 * grips, multi-flight, ...) mounted side-by-side with the ribbon tab.
 *
 * Zero high-frequency subscriptions in this host — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { WallEntity } from '../bim/types/wall-types';
import { isWallEntity } from '../types/entities';
import { useWallPersistence } from '../hooks/data/useWallPersistence';
import { useWallSplitPersistence } from '../hooks/data/useWallSplitPersistence';
import { useBimFamilyTypes } from '../bim/family-types/useBimFamilyTypes';
import { useFamilyTypeBoqRefeed } from '../hooks/data/useFamilyTypeBoqRefeed';
import { WallCascadeDeleteDialog } from '../ui/dialogs/WallCascadeDeleteDialog';
import { EditWallTypeDialog } from '../ui/ribbon/components/EditWallTypeDialog';
import { BimFamilyTypeDeleteDialog } from '../ui/dialogs/BimFamilyTypeDeleteDialog';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
import { useBimPersistenceStateStore } from '../bim/persistence/bim-persistence-state-store';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface WallPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function WallPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: WallPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  // ADR-412 — load the company's BIM family types into the resolution store so
  // typed walls resolve their type-governed params at scene-sync time («type
  // always wins»). Sole writer of `bim-family-type-store`. Untyped walls never
  // need this (legacy fast-path), so a missing catalog is harmless.
  useBimFamilyTypes({
    companyId: user?.companyId ?? null,
    userId: user?.uid ?? null,
    projectId,
  });

  // ADR-412 Φ5 — when a wall family type is edited (UpdateWallFamilyTypeCommand
  // emits `bim:family-type-changed`), re-feed BOQ for every instance across all
  // floors of the building. Geometry re-flows for free (useWallTypeReresolution
  // on the active floor + docToEntity on load elsewhere); only the BOQ
  // aggregate cache needs an eager fan-out, which lives here (host has context).
  useFamilyTypeBoqRefeed({
    companyId: user?.companyId ?? null,
    projectId,
    buildingId,
  });

  const primarySelectedWall: WallEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isWallEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  const wallPersistence = useWallPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedWall,
  });

  // ADR-358/363 follow-up 2026-05-27 — single-instance persistence: ο
  // WallPropertiesTab διαβάζει τα saveState/saveNow από εδώ αντί να καλέσει
  // ξανά το useWallPersistence (αποφυγή 2 instances → 2× audit events,
  // διπλά Firestore subscriptions, διπλά soft-lock acquire/release).
  React.useEffect(() => {
    useBimPersistenceStateStore.getState().setWall(wallPersistence);
    return () => {
      useBimPersistenceStateStore.getState().setWall(null);
    };
  }, [wallPersistence]);

  React.useEffect(() => {
    const walls = currentScene?.entities.filter(isWallEntity) ?? [];
    useBim3DEntitiesStore.getState().setWalls(walls);
  }, [currentScene]);

  useWallSplitPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
  });

  return (
    <>
      <WallCascadeDeleteDialog />
      <EditWallTypeDialog />
      <BimFamilyTypeDeleteDialog />
    </>
  );
}
