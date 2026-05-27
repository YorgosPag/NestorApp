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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { StairEntity } from '../bim/types/stair-types';
import { isStairEntity } from '../types/entities';
import { useStairPersistence } from '../bim/hooks/use-stair-persistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
import { useBimPersistenceStateStore } from '../bim/persistence/bim-persistence-state-store';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface StairPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function StairPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
}: StairPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedStair: StairEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isStairEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const stairs = (currentScene?.entities.filter(isStairEntity) ?? []) as readonly StairEntity[];
    useBim3DEntitiesStore.getState().setStairs(stairs);
  }, [currentScene]);

  const stairPersistence = useStairPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
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
