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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import type { MepFixtureEntity } from '../bim/types/mep-fixture-types';
import { isMepFixtureEntity } from '../types/entities';
import { useMepFixturePersistence } from '../hooks/data/useMepFixturePersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepFixturePersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key forwarded from DxfViewerTopBar. */
  readonly floorId?: string;
}

export function MepFixturePersistenceHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: MepFixturePersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  const primarySelectedFixture: MepFixtureEntity | null = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const e = currentScene.entities.find((x) => x.id === primarySelectedId);
    if (!e || !isMepFixtureEntity(e)) return null;
    return e;
  }, [primarySelectedId, currentScene]);

  React.useEffect(() => {
    const fixtures = currentScene?.entities.filter(isMepFixtureEntity) ?? [];
    useBim3DEntitiesStore.getState().setFixtures(fixtures);
  }, [currentScene]);

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
