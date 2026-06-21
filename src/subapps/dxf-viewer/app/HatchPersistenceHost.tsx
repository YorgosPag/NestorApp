'use client';

/**
 * ADR-507 — Always-on host για hatch Firestore persistence.
 *
 * Mirrors `FloorFinishPersistenceHost` (ADR-419) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:complete` (tool: 'hatch') → first-save
 *   - debounced auto-save when the selected hatch payload changes
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *
 * Σε αντίθεση με το floor-finish ΔΕΝ τροφοδοτεί 3D entity store — η γραμμοσκίαση
 * είναι 2D-only fill (Revit Filled-Region = view annotation).
 *
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { HatchEntity } from '../types/entities';
import { isHatchEntity } from '../types/entities';
import { useHatchPersistence } from '../hooks/data/useHatchPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface HatchPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function HatchPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: HatchPersistenceHostProps): null {
  const { user } = useAuth();

  const primarySelected: HatchEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isHatchEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useHatchPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelected,
  });

  return null;
}
