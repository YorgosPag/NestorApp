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
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { FloorplanSymbolEntity } from '../bim/types/floorplan-symbol-types';
import { isFloorplanSymbolEntity } from '../types/entities';
import { useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useFloorplanSymbolPersistence } from '../hooks/data/useFloorplanSymbolPersistence';

export interface FloorplanSymbolPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
}

function FloorplanSymbolPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: FloorplanSymbolPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity
  // changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedSymbol: FloorplanSymbolEntity | null =
    selectedEntity && isFloorplanSymbolEntity(selectedEntity) ? selectedEntity : null;

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

/**
 * ADR-547 Stage 2 — `React.memo` so the host bails when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-symbol edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selector (`useSceneEntityById`), not a prop.
 */
export const FloorplanSymbolPersistenceHost = React.memo(FloorplanSymbolPersistenceHostImpl);
FloorplanSymbolPersistenceHost.displayName = 'FloorplanSymbolPersistenceHost';
