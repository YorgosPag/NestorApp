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
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { isMepFittingEntity } from '../types/entities';
import { useMepFittingAutoReconciliation } from '../hooks/data/useMepFittingAutoReconciliation';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface MepFittingPersistenceHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function MepFittingPersistenceHost({
  currentScene,
  levelManager,
  projectId,
  floorplanId,
}: MepFittingPersistenceHostProps): React.ReactElement | null {
  const { user } = useAuth();

  // `currentScene` is a new reference on every render (getLevelScene returns a
  // fresh object), so keying the 3D-store push on it churned `setMepFittings`
  // every render. Push only when the fitting set actually changes (id + params).
  const fittings = React.useMemo(
    () => currentScene?.entities.filter(isMepFittingEntity) ?? [],
    [currentScene],
  );
  const fittingsSig = React.useMemo(
    () => fittings.map((f) => `${f.id}:${JSON.stringify(f.params)}`).join('|'),
    [fittings],
  );
  React.useEffect(() => {
    useBim3DEntitiesStore.getState().setMepFittings(fittings);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- push keyed on content signature, not the per-render array ref
  }, [fittingsSig]);

  useMepFittingAutoReconciliation({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
    levelManager,
  });

  return null;
}
