'use client';

/**
 * ADR-417 — Always-on host για roof Firestore persistence.
 *
 * Mirrors `RailingPersistenceHost` (ADR-407) αλλά για footprint-based roofs —
 * renders `null`. Mounted σε `DxfViewerTopBar` ώστε το hook lifecycle τρέχει
 * όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'roof') → first-save
 *   - debounced auto-save when `primarySelectedRoof.params` change
 *   - subscribes to Firestore + diff-merges incoming roof docs στο scene
 *   - feeds the 3D entity store (`setRoofs`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { RoofEntity } from '../bim/types/roof-types';
import { isRoofEntity } from '../types/entities';
import { useRoofPersistence } from '../hooks/data/useRoofPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface RoofPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

export function RoofPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: RoofPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedRoof: RoofEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isRoofEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const roofs = currentScene?.entities.filter(isRoofEntity) ?? [];
    useBim3DEntitiesStore.getState().setRoofs(roofs);
  }, [currentScene]);

  useRoofPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedRoof,
  });

  return null;
}
