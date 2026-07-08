'use client';

/**
 * ADR-363 Phase 5 — Always-on host για Beam Firestore persistence.
 *
 * Mirrors `ColumnPersistenceHost` αλλά για beams — renders `null`.
 * Mounted στο `DxfViewerTopBar` ώστε το hook lifecycle να τρέχει ενώ ο
 * viewer είναι ενεργός:
 *   - listens για `drawing:entity-created` (tool: 'beam') → first-save
 *   - debounced auto-save όταν `primarySelectedBeam.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming beam docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { BeamEntity } from '../bim/types/beam-types';
import { isBeamEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useBeamPersistence } from '../hooks/data/useBeamPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface BeamPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function BeamPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: BeamPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the beam slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedBeam: BeamEntity | null =
    selectedEntity && isBeamEntity(selectedEntity) ? selectedEntity : null;

  const beams = useSceneEntitiesByType<BeamEntity>(currentLevelId, isBeamEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setBeams(beams);
  }, [beams]);

  useBeamPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedBeam,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-beam edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const BeamPersistenceHost = React.memo(BeamPersistenceHostImpl);
BeamPersistenceHost.displayName = 'BeamPersistenceHost';
