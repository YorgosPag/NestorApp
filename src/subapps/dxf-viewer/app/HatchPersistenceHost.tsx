'use client';

/**
 * ADR-507 — Always-on host για hatch Firestore persistence.
 *
 * Mirrors `FloorFinishPersistenceHost` (ADR-419) — renders `null`. Mounted σε
 * `DxfViewerTopBar` ώστε το hook lifecycle τρέχει όσο ο viewer είναι ενεργός:
 *   - listens for `drawing:complete` (tool: 'hatch') → first-save
 *   - debounced auto-save when the selected hatch payload changes
 *   - subscribes to Firestore + diff-merges incoming docs στο scene
 *
 * Σε αντίθεση με το floor-finish ΔΕΝ τροφοδοτεί 3D entity store — η γραμμοσκίαση
 * είναι 2D-only fill (Revit Filled-Region = view annotation).
 *
 * Zero high-frequency subscriptions — ADR-040 CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';
import type { HatchEntity } from '../types/entities';
import { isHatchEntity } from '../types/entities';
import { useSceneEntityById } from '../systems/scene/useSceneSelectors';
import { useHatchPersistence } from '../hooks/data/useHatchPersistence';

export interface HatchPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly projectId?: string;
  readonly floorplanId?: string;
  readonly buildingId?: string;
  readonly floorId?: string;
}

function HatchPersistenceHostImpl({
  primarySelectedId,
  levelManager,
  projectId,
  floorplanId,
  buildingId,
  floorId,
}: HatchPersistenceHostProps): null {
  const { user } = useAuth();
  // ADR-547 Stage 2/3 — leaf scene subscriptions REPLACE the monolithic
  // `currentScene` prop: this host re-renders only when the selected entity
  // changes, never when an unrelated entity type is edited.
  const currentLevelId = levelManager.currentLevelId;

  const selectedEntity = useSceneEntityById(currentLevelId, primarySelectedId);
  const primarySelected: HatchEntity | null =
    selectedEntity && isHatchEntity(selectedEntity) ? selectedEntity : null;

  useHatchPersistence({
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
 * non-memoized `DxfViewerTopBar` parent does; with it, a non-hatch edit
 * (which leaves `primarySelectedId` + `levelManager` + scope ids unchanged) no
 * longer re-renders this host at all. The scene reactivity it DOES need now
 * arrives through the leaf selector (`useSceneEntityById`), not a prop.
 */
export const HatchPersistenceHost = React.memo(HatchPersistenceHostImpl);
HatchPersistenceHost.displayName = 'HatchPersistenceHost';
