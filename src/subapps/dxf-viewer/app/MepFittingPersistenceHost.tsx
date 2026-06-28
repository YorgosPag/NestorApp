'use client';

/**
 * ADR-408 Φ11 — Always-on host for MEP fitting auto-reconciliation.
 *
 * Mirrors `MepSegmentPersistenceHost` but for the AUTO-DERIVED point-based pipe
 * fittings (elbow / tee / cross / coupling / reducer / cap) — renders `null`.
 * Mounted in `DxfViewerTopBar` beside `MepSegmentPersistenceHost` so the
 * reconciliation lifecycle runs while the viewer is active:
 *   - subscribes to `floorplan_mep_fittings` + diff-merges incoming docs into the scene
 *   - reconciles the persisted fittings against the live pipe topology (create /
 *     update / delete by `junctionKey`) on every segment add / move / delete
 *   - feeds the 3D entity store (`setMepFittings`)
 *
 * Unlike the segment host there is NO selection-driven save path: fittings are
 * derived from topology, not hand-drawn or hand-edited (not on the undo stack).
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see ./MepSegmentPersistenceHost.tsx — the linear-element template
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { useLevels } from '../systems/levels';
import type { MepFittingEntity } from '../bim/types/mep-fitting-types';
import { isMepFittingEntity } from '../types/entities';
import { useSceneEntitiesByType } from '../systems/scene/useSceneSelectors';
import { useMepFittingAutoReconciliation } from '../hooks/data/useMepFittingAutoReconciliation';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepFittingPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** ADR-420 — stable building-storey scope key forwarded from DxfViewerTopBar. */
  readonly floorId?: string;
}

function MepFittingPersistenceHostImpl({
  levelManager,
  projectId,
  floorplanId,
  floorId,
}: MepFittingPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();
  // ADR-547 Stage 2 — `useSceneEntitiesByType` returns a reference-stable slice
  // (only a new array reference when the fitting set actually changes), so the
  // previous `fittingsSig` churn-guard is no longer necessary.
  const currentLevelId = levelManager.currentLevelId;

  const fittings = useSceneEntitiesByType<MepFittingEntity>(currentLevelId, isMepFittingEntity);
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setMepFittings(fittings);
  }, [fittings]);

  useMepFittingAutoReconciliation({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    floorId,
    userId: user?.uid ?? null,
    levelManager,
  });

  return null;
}

/**
 * ADR-547 Stage 2 — `React.memo` so the host bails when the (now scene-free)
 * props are shallow-equal. Scene reactivity arrives through the leaf selector
 * (`useSceneEntitiesByType`), not a prop.
 */
export const MepFittingPersistenceHost = React.memo(MepFittingPersistenceHostImpl);
MepFittingPersistenceHost.displayName = 'MepFittingPersistenceHost';
