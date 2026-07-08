'use client';

/**
 * ADR-363 Phase 2 — Always-on host για Opening Firestore persistence.
 *
 * Mirrors `WallPersistenceHost` but για openings — renders `null`. Mounted
 * στο `DxfViewerTopBar` so the hook lifecycle τρέχει while the viewer is
 * active:
 *   - listens for `drawing:entity-created` (tool: 'opening') → first-save
 *   - debounced auto-save όταν `primarySelectedOpening.params` αλλάξουν
 *   - subscribes σε Firestore + diff-merges incoming opening docs στο scene
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { OpeningEntity } from '../bim/types/opening-types';
import { isOpeningEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useOpeningPersistence } from '../hooks/data/useOpeningPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';
// ADR-421 SLICE C — always-on «Edit Opening Type» dialog (mirror EditWallTypeDialog
// in WallPersistenceHost). The family-type catalog loader + the entity-agnostic
// delete dialog are already mounted by WallPersistenceHost → reused here.
import { EditOpeningTypeDialog } from '../ui/ribbon/components/EditOpeningTypeDialog';

interface LevelManagerLike
  extends LevelSceneWriter,
    Pick<ReturnType<typeof useLevels>, 'levels'> {}

export interface OpeningPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  /** ADR-420 — stable building-storey scope key forwarded to useOpeningPersistence. */
  readonly floorId?: string;
}

function OpeningPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: OpeningPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the opening slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedOpening: OpeningEntity | null =
    selectedEntity && isOpeningEntity(selectedEntity) ? selectedEntity : null;

  // ADR-363 Bug 2 — push opening entities στο Bim3DEntitiesStore ώστε ο 3D
  // viewer να ενσωματώσει wall cutouts (THREE.Shape.holes per-segment).
  // Mirror του SlabOpeningPersistenceHost pattern. CHECK 6B/6C compliant —
  // low-freq (user-triggered scene changes).
  const openings = useSceneEntitiesByType<OpeningEntity>(currentLevelId, isOpeningEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setOpenings(openings);
  }, [openings]);

  useOpeningPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedOpening,
  });

  return <EditOpeningTypeDialog />;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-opening edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const OpeningPersistenceHost = React.memo(OpeningPersistenceHostImpl);
OpeningPersistenceHost.displayName = 'OpeningPersistenceHost';
