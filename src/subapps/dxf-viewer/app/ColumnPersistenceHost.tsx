'use client';

/**
 * ADR-363 Phase 4 — Always-on host για Column Firestore persistence.
 *
 * Mirrors `SlabPersistenceHost` αλλά για columns — renders `null`.
 * Mounted στο `DxfViewerTopBar` ώστε το hook lifecycle να τρέχει ενώ ο
 * viewer είναι ενεργός:
 *   - listens για `drawing:entity-created` (tool: 'column') → first-save
 *   - debounced auto-save όταν `primarySelectedColumn.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming column docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { ColumnEntity } from '../bim/types/column-types';
import { isColumnEntity } from '../types/entities';
import { useColumnPersistence } from '../hooks/data/useColumnPersistence';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface ColumnPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
}

export function ColumnPersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
}: ColumnPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedColumn: ColumnEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isColumnEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  useColumnPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedColumn,
  });

  return null;
}
