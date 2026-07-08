'use client';

/**
 * ADR-408 Εύρος Β #3 — Always-on host for underfloor heating Firestore persistence.
 *
 * Mirrors `MepBoilerPersistenceHost` but for area-based underfloor heating loops —
 * renders `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-underfloor') → first-save
 *   - debounced auto-save when `primarySelectedUnderfloor.params` change
 *   - subscribes to Firestore + diff-merges incoming underfloor docs into the scene
 *   - feeds the 3D entity store (`setUnderfloors`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { MepUnderfloorEntity } from '../bim/types/mep-underfloor-types';
import { isMepUnderfloorEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useMepUnderfloorPersistence } from '../hooks/data/useMepUnderfloorPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface MepUnderfloorPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey id. Forwarded to hook → service. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

function MepUnderfloorPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepUnderfloorPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the underfloor slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedUnderfloor: MepUnderfloorEntity | null =
    selectedEntity && isMepUnderfloorEntity(selectedEntity) ? selectedEntity : null;

  const underfloors = useSceneEntitiesByType<MepUnderfloorEntity>(
    currentLevelId,
    isMepUnderfloorEntity,
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setUnderfloors(underfloors);
  }, [underfloors]);

  useMepUnderfloorPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedUnderfloor,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host bails when the (now scene-free)
 * props are shallow-equal. Scene reactivity arrives through the leaf selectors
 * (`useSceneEntitiesByType` / `useSceneEntityById`), not a prop.
 */
export const MepUnderfloorPersistenceHost = React.memo(MepUnderfloorPersistenceHostImpl);
MepUnderfloorPersistenceHost.displayName = 'MepUnderfloorPersistenceHost';
