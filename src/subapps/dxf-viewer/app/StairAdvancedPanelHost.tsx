'use client';

/**
 * ADR-358 Phase 7b2a + 7.5 — Host orchestrator for the Stair Floating Advanced
 * Properties panel.
 *
 * Mounted as a sibling of `RibbonRoot` in `DxfViewerContent`. Orchestrator-
 * level state (`primarySelectedId`, `currentScene`, `levelManager`) is passed
 * in as props — this host stays orphan w.r.t. high-frequency stores and
 * does NOT add new `useSyncExternalStore` subscriptions to the parent
 * (ADR-040 CHECK 6C compliance).
 *
 * Phase 7.5: also reads `useAuth()` for `companyId` + `userId` (required by
 * `stair-presets-service`). `projectId` is plumbed as optional prop — when
 * absent, project-scope presets are simply hidden (user/company scopes still
 * work). Auth read here is fine: orchestrator already mounts conditionally on
 * selection, so this hook does not introduce new high-frequency subscriptions.
 *
 * Conditional render: panel mounts only when the primary selection narrows
 * to a `StairEntity`. Industry-aligned with Revit/ArchiCAD/AutoCAD pattern
 * (Properties Palette appears on object selection, lifecycle independent
 * from the contextual ribbon tab).
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { useSelectedStair } from '../ui/stair-advanced-panel/hooks/useSelectedStair';
import { useStairParamsDispatcher } from '../ui/stair-advanced-panel/commands/dispatchStairParamPatch';
import { useStairPersistence } from '../bim/hooks/use-stair-persistence';
import { StairAdvancedPanel } from '../ui/stair-advanced-panel/StairAdvancedPanel';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface StairAdvancedPanelHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
  readonly projectId?: string;
  /** Required by Phase 8 persistence — falls back to floorplanId when absent (subscribe gated). */
  readonly floorplanId?: string;
}

export function StairAdvancedPanelHost({
  primarySelectedId,
  currentScene,
  levelManager,
  projectId,
  floorplanId,
}: StairAdvancedPanelHostProps): React.ReactElement | null {
  const stair = useSelectedStair(primarySelectedId, currentScene);
  const dispatchPatch = useStairParamsDispatcher({ levelManager });
  const { user } = useAuth();

  // Phase 8 — persistence + soft-lock. Hook is always called (rules of hooks);
  // it no-ops internally until `companyId/projectId/floorplanId/userId` are set.
  const persistence = useStairPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedStair: stair,
  });

  if (!stair) return null;

  return (
    <StairAdvancedPanel
      stair={stair}
      dispatchPatch={dispatchPatch}
      companyId={user?.companyId ?? null}
      userId={user?.uid ?? null}
      projectId={projectId}
      levelManager={levelManager}
      persistence={persistence}
    />
  );
}
