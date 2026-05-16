'use client';

/**
 * ADR-358 Phase 7b2a — Host orchestrator for the Stair Floating Advanced
 * Properties panel.
 *
 * Mounted as a sibling of `RibbonRoot` in `DxfViewerContent`. Orchestrator-
 * level state (`primarySelectedId`, `currentScene`, `levelManager`) is passed
 * in as props — this host stays orphan w.r.t. high-frequency stores and
 * does NOT add new `useSyncExternalStore` subscriptions to the parent
 * (ADR-040 CHECK 6C compliance).
 *
 * Conditional render: panel mounts only when the primary selection narrows
 * to a `StairEntity`. Industry-aligned with Revit/ArchiCAD/AutoCAD pattern
 * (Properties Palette appears on object selection, lifecycle independent
 * from the contextual ribbon tab).
 */

import React from 'react';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { useSelectedStair } from '../ui/stair-advanced-panel/hooks/useSelectedStair';
import { useStairParamsDispatcher } from '../ui/stair-advanced-panel/commands/dispatchStairParamPatch';
import { StairAdvancedPanel } from '../ui/stair-advanced-panel/StairAdvancedPanel';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface StairAdvancedPanelHostProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
}

export function StairAdvancedPanelHost({
  primarySelectedId,
  currentScene,
  levelManager,
}: StairAdvancedPanelHostProps): React.ReactElement | null {
  const stair = useSelectedStair(primarySelectedId, currentScene);
  const dispatchPatch = useStairParamsDispatcher({ levelManager });

  if (!stair) return null;

  return <StairAdvancedPanel stair={stair} dispatchPatch={dispatchPatch} />;
}
