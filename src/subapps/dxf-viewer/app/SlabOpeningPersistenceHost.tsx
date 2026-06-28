'use client';

/**
 * ADR-363 Phase 3.7 — Always-on host για Slab-Opening Firestore persistence.
 *
 * Mirrors `SlabPersistenceHost` αλλά για slab-opening entities — renders
 * `null`. Mounted στο `DxfViewerTopBar` ώστε το hook lifecycle να τρέχει
 * όσο ο viewer είναι ενεργός:
 *   - listens για `drawing:entity-created` (tool: 'slab-opening') → first-save
 *   - debounced auto-save όταν `primarySelectedSlabOpening.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10 §11.Q3
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { SlabOpeningEntity } from '../bim/types/slab-opening-types';
import { isSlabOpeningEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useSlabOpeningPersistence } from '../hooks/data/useSlabOpeningPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface SlabOpeningPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  /** ADR-420 — stable building-storey scope key forwarded to useSlabOpeningPersistence. */
  readonly floorId?: string;
}

function SlabOpeningPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: SlabOpeningPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the slab-opening slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedSlabOpening: SlabOpeningEntity | null =
    selectedEntity && isSlabOpeningEntity(selectedEntity) ? selectedEntity : null;

  // ADR-363 §11.Q3 Phase 3.7d + ADR-370 §6 Phase 7 — push slab-openings to
  // Bim3DEntitiesStore so 3D viewer triangulates slab cutouts (THREE.Shape.holes).
  // Mirror του SlabPersistenceHost pattern. CHECK 6B/6C compliant — low-freq.
  const slabOpenings = useSceneEntitiesByType<SlabOpeningEntity>(currentLevelId, isSlabOpeningEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setSlabOpenings(slabOpenings);
  }, [slabOpenings]);

  useSlabOpeningPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedSlabOpening,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized parent does; with it, a non-slab-opening edit (which leaves
 * `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. Scene reactivity arrives through leaf selectors.
 * Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const SlabOpeningPersistenceHost = React.memo(SlabOpeningPersistenceHostImpl);
SlabOpeningPersistenceHost.displayName = 'SlabOpeningPersistenceHost';
