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
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { ColumnEntity } from '../bim/types/column-types';
import { isColumnEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useColumnPersistence } from '../hooks/data/useColumnPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface ColumnPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function ColumnPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: ColumnPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the column slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedColumn: ColumnEntity | null =
    selectedEntity && isColumnEntity(selectedEntity) ? selectedEntity : null;

  const columns = useSceneEntitiesByType<ColumnEntity>(currentLevelId, isColumnEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setColumns(columns);
  }, [columns]);

  useColumnPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedColumn,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-column edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const ColumnPersistenceHost = React.memo(ColumnPersistenceHostImpl);
ColumnPersistenceHost.displayName = 'ColumnPersistenceHost';
