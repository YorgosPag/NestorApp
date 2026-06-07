'use client';

/**
 * ADR-415 Φ1 — Always-on host for floorplan-symbol Firestore persistence.
 *
 * Mirrors `FurniturePersistenceHost` but for pure-vector 2D symbols — renders
 * `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the viewer
 * is active:
 *   - listens for `drawing:entity-created` (tool: 'floorplan-symbol') → first-save
 *   - debounced auto-save when `primarySelectedSymbol.params` change
 *   - subscribes to Firestore + diff-merges incoming symbol docs into the scene
 *
 * No 3D entity-store feed (floorplan symbols are 2D-only). Zero high-frequency
 * subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { FloorplanSymbolEntity } from '../bim/types/floorplan-symbol-types';
import { isFloorplanSymbolEntity } from '../types/entities';
import { useFloorplanSymbolPersistence } from '../hooks/data/useFloorplanSymbolPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface FloorplanSymbolPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
}

export function FloorplanSymbolPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: FloorplanSymbolPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedSymbol: FloorplanSymbolEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isFloorplanSymbolEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useFloorplanSymbolPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedSymbol,
  });

  return null;
}
