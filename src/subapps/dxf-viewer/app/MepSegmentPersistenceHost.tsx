'use client';

/**
 * ADR-408 Φ8 — Always-on host for MEP segment Firestore persistence.
 *
 * Mirrors `ElectricalPanelPersistenceHost` but for linear MEP segments
 * (duct/pipe) — renders `null`. Mounted in `DxfViewerTopBar` so the hook
 * lifecycle runs while the viewer is active:
 *   - listens for `drawing:entity-created` (tool: 'mep-segment') → first-save
 *   - auto-save on `bim:mep-segment-params-updated`
 *   - subscribes to Firestore + diff-merges incoming segment docs into the scene
 *   - feeds the 3D entity store (`setMepSegments`)
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { MepSegmentEntity } from '../bim/types/mep-segment-types';
import { isMepSegmentEntity } from '../types/entities';
import { useSceneEntitiesByType, useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useMepSegmentPersistence } from '../hooks/data/useMepSegmentPersistence';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface MepSegmentPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key forwarded from DxfViewerTopBar. */
  readonly floorId?: string;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed. */
  readonly buildingId?: string;
}

function MepSegmentPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  floorId,
  buildingId,
}: MepSegmentPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity or
  // the segment slice changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelectedSegment: MepSegmentEntity | null =
    selectedEntity && isMepSegmentEntity(selectedEntity) ? selectedEntity : null;

  const segments = useSceneEntitiesByType<MepSegmentEntity>(currentLevelId, isMepSegmentEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setMepSegments(segments);
  }, [segments]);

  useMepSegmentPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedSegment,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host bails when the (now scene-free)
 * props are shallow-equal. Scene reactivity arrives through the leaf selectors
 * (`useSceneEntitiesByType` / `useSceneEntityById`), not a prop.
 */
export const MepSegmentPersistenceHost = React.memo(MepSegmentPersistenceHostImpl);
MepSegmentPersistenceHost.displayName = 'MepSegmentPersistenceHost';
