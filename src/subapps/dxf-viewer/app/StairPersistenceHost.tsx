'use client';

/**
 * ADR-358 Phase 8 follow-up (2026-05-27) — Always-on host για Stair Firestore
 * persistence + 3D bridge.
 *
 * Mirror του `SlabPersistenceHost` / `WallPersistenceHost` pattern. Mount-once
 * στο `DxfViewerTopBar` ώστε το `useStairPersistence` lifecycle να τρέχει σε
 * όλη τη διάρκεια του viewer:
 *   - listener για `drawing:entity-created` (tool: 'stair') → first-save
 *   - debounced auto-save όταν αλλάξουν τα `primarySelectedStair.params`
 *   - Firestore subscribe + diff-merge των stair docs στο active scene
 *   - 3D bridge: push stair entities στο `Bim3DEntitiesStore`
 *
 * Παλιά (ADR-358 Phase 8 σε `StairAdvancedPanelHost`, gated `{false && ...}` /
 * sidebar `StairPropertiesTab`) το persistence ήταν selection-driven — μόλις
 * σχεδίαζες σκάλα ΧΩΡΙΣ να την επιλέξεις, η σκάλα δεν έφτανε ποτέ στο
 * `floorplan_stairs`. Το fix κάνει το persistence always-on, mirror των άλλων
 * έξι BIM hosts (Wall/Slab/Column/Beam/Opening/SlabOpening).
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { StairEntity } from '../bim/types/stair-types';
import { isStairEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useStairPersistence } from '../bim/hooks/use-stair-persistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
import { useBimPersistenceStateStore } from '../bim/persistence/bim-persistence-state-store';

export interface StairPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-395 Phase 2 (G1) — BOQ auto-feed scope. */
  readonly buildingId?: string;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId?: string;
}

function StairPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: StairPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the stair slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedStair: StairEntity | null =
    selectedEntity && isStairEntity(selectedEntity) ? selectedEntity : null;

  const stairs = useSceneEntitiesByType<StairEntity>(currentLevelId, isStairEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setStairs(stairs);
  }, [stairs]);

  const stairPersistence = useStairPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedStair,
  });

  // ADR-358/363 follow-up 2026-05-27 — single-instance persistence: ο
  // StairPropertiesTab διαβάζει τα saveState/saveNow από εδώ αντί να καλέσει
  // ξανά το useStairPersistence (αποφυγή 2 instances → 2× audit events,
  // διπλά Firestore subscriptions, διπλά soft-lock acquire/release).
  React.useEffect(() => {
    useBimPersistenceStateStore.getState().setStair(stairPersistence);
    return () => {
      useBimPersistenceStateStore.getState().setStair(null);
    };
  }, [stairPersistence]);

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized parent does; with it, a non-stair edit (which leaves
 * `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. Scene reactivity arrives through leaf selectors.
 * Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const StairPersistenceHost = React.memo(StairPersistenceHostImpl);
StairPersistenceHost.displayName = 'StairPersistenceHost';
