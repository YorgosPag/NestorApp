'use client';

/**
 * ADR-437 — Always-on host για space-separator Firestore persistence.
 *
 * Mirror του `ThermalSpacePersistenceHost` (ADR-422 L0) — renders `null`. Mounted
 * σε `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'space-separator') → first-save
 *   - debounced auto-save when `primarySelected.params` change
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *
 * 3D feed ΔΕΝ υπάρχει (ο διαχωριστής = IfcVirtualElement, σωστά αόρατος σε 3D).
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { SpaceSeparatorEntity } from '../bim/types/space-separator-types';
import { isSpaceSeparatorEntity } from '../types/entities';
import { useSpaceSeparatorPersistence } from '../hooks/data/useSpaceSeparatorPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface SpaceSeparatorPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function SpaceSeparatorPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: SpaceSeparatorPersistenceHostProps): null {
  const { user } = useAuth();

  const primarySelected: SpaceSeparatorEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isSpaceSeparatorEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useSpaceSeparatorPersistence({
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
