'use client';

/**
 * ADR-437 — Always-on host για space-separator Firestore persistence.
 *
 * Mirror του `ThermalSpacePersistenceHost` (ADR-422 L0) — renders `null`. Mounted
 * σε `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:entity-created` (tool: 'space-separator') → first-save
 *   - debounced auto-save when `primarySelected.params` change
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *
 * 3D feed ΔΕΝ υπάρχει (ο διαχωριστής = IfcVirtualElement, σωστά αόρατος σε 3D).
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { SpaceSeparatorEntity } from '../bim/types/space-separator-types';
import { isSpaceSeparatorEntity } from '../types/entities';
import { useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useSpaceSeparatorPersistence } from '../hooks/data/useSpaceSeparatorPersistence';

export interface SpaceSeparatorPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function SpaceSeparatorPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: SpaceSeparatorPersistenceHostProps): null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity
  // changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelected: SpaceSeparatorEntity | null =
    selectedEntity && isSpaceSeparatorEntity(selectedEntity) ? selectedEntity : null;

  useSpaceSeparatorPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelected,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host bails when the (now scene-free)
 * props are shallow-equal. Without it, the host would re-render whenever the
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-separator edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selector (`useSceneEntityById`), not a prop.
 */
export const SpaceSeparatorPersistenceHost = React.memo(SpaceSeparatorPersistenceHostImpl);
SpaceSeparatorPersistenceHost.displayName = 'SpaceSeparatorPersistenceHost';
