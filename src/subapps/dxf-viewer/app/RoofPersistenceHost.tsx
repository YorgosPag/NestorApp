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
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { RoofEntity } from '../bim/types/roof-types';
import { isRoofEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useRoofPersistence } from '../hooks/data/useRoofPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
import { EditRoofTypeDialog } from '../ui/ribbon/components/EditRoofTypeDialog';

export interface RoofPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function RoofPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: RoofPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the roof slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedRoof: RoofEntity | null =
    selectedEntity && isRoofEntity(selectedEntity) ? selectedEntity : null;

  const roofs = useSceneEntitiesByType<RoofEntity>(currentLevelId, isRoofEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setRoofs(roofs);
  }, [roofs]);

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

  // ADR-417 §10 #3 — always-on «Edit Roof Type» dialog (self-renders null when
  // closed; opened via `openEditRoofType` from the contextual ribbon widget).
  return <EditRoofTypeDialog />;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized parent does; with it, a non-roof edit (which leaves
 * `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. Scene reactivity arrives through leaf selectors.
 * Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const RoofPersistenceHost = React.memo(RoofPersistenceHostImpl);
RoofPersistenceHost.displayName = 'RoofPersistenceHost';
