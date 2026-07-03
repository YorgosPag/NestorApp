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
import type { useLevels } from '../systems/levels';
import type { WallEntity } from '../bim/types/wall-types';
import { isWallEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useWallPersistence } from '../hooks/data/useWallPersistence';
import { useWallSplitPersistence } from '../hooks/data/useWallSplitPersistence';
import { useWallMergePersistence } from '../hooks/data/useWallMergePersistence';
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
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function WallPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: WallPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the wall slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

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

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedWall: WallEntity | null =
    selectedEntity && isWallEntity(selectedEntity) ? selectedEntity : null;

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

  const walls = useSceneEntitiesByType<WallEntity>(currentLevelId, isWallEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setWalls(walls);
  }, [walls]);

  useWallSplitPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
  });

  // ADR-566 — Wall merge persistence (inverse of split): delete A+B, save merged.
  useWallMergePersistence({
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

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-wall edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const WallPersistenceHost = React.memo(WallPersistenceHostImpl);
WallPersistenceHost.displayName = 'WallPersistenceHost';
