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
import { WallCascadeDeleteDialog } from '../ui/dialogs/WallCascadeDeleteDialog';

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
}

export function WallPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
}: WallPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedWall: WallEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isWallEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useWallPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedWall,
  });

  useWallSplitPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    userId: user?.uid ?? null,
  });

  return <WallCascadeDeleteDialog />;
}
