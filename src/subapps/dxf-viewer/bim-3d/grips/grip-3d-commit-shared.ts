'use client';

/**
 * grip-3d-commit-shared.ts — shared dispatcher for the two 3D reshape-grip commit
 * bridges (`grip-3d-commit.ts` BIM + `grip-3d-dxf-commit.ts` raw-DXF). Both build the
 * SAME history-backed `DxfCommitDeps` (ADR-535 §6.1: `buildDeps.execute` is a no-op, so
 * `execute` is overridden with a real `getGlobalCommandHistory().execute`) and route a
 * pre-mapped `UnifiedGripInfo` through `commitDxfGripDragModeAware` in 'stretch' mode,
 * returning the executed command (single undo step) or null. The ONLY per-caller
 * difference is the grip mapping (BIM `toUnifiedGrip` vs polyline-guarded
 * `toRawDxfUnifiedGrip`) + delta scaling, which stay in the callers. Extracted here as the
 * SSoT for the shared body (ADR-602 Stage 5 / N.18 — no sibling twins across the bridges).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { getGlobalCommandHistory } from '../../core/commands';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { UnifiedGripInfo, DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { commitDxfGripDragModeAware } from '../../hooks/grips/grip-commit-adapters';
import { buildDeps } from '../animation/bim3d-edit-interaction-helpers';

/**
 * Run a pre-mapped unified grip through the 2D commit SSoT with a real history-backed
 * dispatcher. Returns the executed command (single undo step) or null. `delta` is already
 * in the units the stretch command expects (raw-DXF converts to native units first).
 */
export function commit3DGripViaHistory(
  unified: UnifiedGripInfo,
  delta: Point2D,
  levels: LevelsHookReturn,
  levelId: string,
): ICommand | null {
  let executed: ICommand | null = null;
  const deps: DxfCommitDeps = {
    ...buildDeps(levels, levelId),
    // ADR-535 §6.1 — real history-backed dispatcher (buildDeps.execute is a no-op).
    execute: (command) => {
      executed = command;
      getGlobalCommandHistory().execute(command);
    },
  };
  commitDxfGripDragModeAware(unified, delta, deps, 'stretch');
  return executed;
}
