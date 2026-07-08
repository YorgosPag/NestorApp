'use client';

/**
 * ADR-406 — Always-on host for MEP fixture Firestore persistence.
 *
 * Mirrors `ColumnPersistenceHost` but for point-based MEP fixtures — renders
 * `null`. Mounted in `DxfViewerTopBar` so the hook lifecycle runs while the
 * viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-fixture') → first-save
 *   - debounced auto-save when `primarySelectedFixture.params` change
 *   - subscribes to Firestore + diff-merges incoming fixture docs into the scene
 *   - feeds the 3D entity store (`setFixtures`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { MepFixtureEntity } from '../bim/types/mep-fixture-types';
import { isMepFixtureEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useMepFixturePersistence } from '../hooks/data/useMepFixturePersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface MepFixturePersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key forwarded from DxfViewerTopBar. */
  readonly floorId?: string;
}

function MepFixturePersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: MepFixturePersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the fixture slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedFixture: MepFixtureEntity | null =
    selectedEntity && isMepFixtureEntity(selectedEntity) ? selectedEntity : null;

  const fixtures = useSceneEntitiesByType<MepFixtureEntity>(currentLevelId, isMepFixtureEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setFixtures(fixtures);
  }, [fixtures]);

  useMepFixturePersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedFixture,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host BAILS when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-fixture edit (which
 * leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no longer
 * re-renders this host at all. The scene reactivity it DOES need now arrives
 * through the leaf selectors (`useSceneEntitiesByType`/`useSceneEntityById`),
 * not a prop. Pairs with dropping `currentScene` from the mount in DxfViewerTopBar.
 */
export const MepFixturePersistenceHost = React.memo(MepFixturePersistenceHostImpl);
MepFixturePersistenceHost.displayName = 'MepFixturePersistenceHost';
