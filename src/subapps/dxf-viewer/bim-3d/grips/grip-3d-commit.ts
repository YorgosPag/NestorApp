'use client';

/**
 * grip-3d-commit.ts — 3D reshape-grip drag → view-agnostic command (ADR-535 Φ1).
 *
 * Bridges a finished 3D grip drag onto the EXACT 2D commit SSoT: a `GripInfo` +
 * plan-mm delta become a `UnifiedGripInfo` routed through `commitDxfGripDragModeAware`
 * → `commitSlabGripDrag` → `applySlabGripDrag` + `UpdateSlabParamsCommand`. The scene
 * re-syncs automatically (the command writes the level scene via `setLevelScene`, which
 * the 3D entities store rebuilds from) and `commitSlabGripDrag` self-emits
 * `bim:slab-params-updated` — so NO extra structural emit here (avoids a double-announce).
 *
 * Risk #1 (ADR-535 §6.1) resolved: `buildDeps.execute` is a no-op (the gizmo path runs
 * `getGlobalCommandHistory().execute` itself), so we override `execute` with a real
 * history-backed dispatcher — otherwise `commitSlabGripDrag` would build a command and
 * silently drop it.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { getGlobalCommandHistory } from '../../core/commands';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { GripInfo } from '../../hooks/grip-types';
import type { UnifiedGripInfo, DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { commitDxfGripDragModeAware } from '../../hooks/grips/grip-commit-adapters';
import { buildDeps } from '../animation/bim3d-edit-interaction-helpers';

/**
 * Map a 2D `GripInfo` onto the unified shape the commit adapters consume. The four
 * footprint discriminators are forwarded 1:1 (ADR-535 Φ3) — `commitDxfGripDragModeAware`
 * routes on whichever `*GripKind` is present (`commitSlabGripDrag` / `commitRoofGripDrag`
 * / `commitFloorFinishGripDrag` / `commitSlabOpeningGripDrag`), so the bridge stays
 * type-agnostic.
 */
export function toUnifiedGrip(grip: GripInfo): UnifiedGripInfo {
  return {
    id: `dxf_${grip.entityId}_${grip.gripIndex}`,
    source: 'dxf',
    entityId: grip.entityId,
    gripIndex: grip.gripIndex,
    // GripType 'midpoint' (edge-midpoint insert) maps onto the unified 'edge' type.
    type: grip.type === 'midpoint' ? 'edge' : 'vertex',
    position: grip.position,
    movesEntity: grip.movesEntity,
    edgeVertexIndices: grip.edgeVertexIndices,
    slabGripKind: grip.slabGripKind,
    roofGripKind: grip.roofGripKind,
    floorFinishGripKind: grip.floorFinishGripKind,
    slabOpeningGripKind: grip.slabOpeningGripKind,
  };
}

/**
 * Commit a 3D reshape-grip drag for `levelId`. Returns the executed command (for an
 * optional undo-step assertion in tests), or null on a no-op (zero delta / missing
 * entity / validation reject). Single command = single undo step.
 */
export function commitGrip3DReshape(
  grip: GripInfo,
  deltaMm: Point2D,
  levels: LevelsHookReturn,
  levelId: string,
): ICommand | null {
  if (deltaMm.x === 0 && deltaMm.y === 0) return null;
  let executed: ICommand | null = null;
  const deps: DxfCommitDeps = {
    ...buildDeps(levels, levelId),
    // ADR-535 §6.1 — real history-backed dispatcher (buildDeps.execute is a no-op).
    execute: (command) => {
      executed = command;
      getGlobalCommandHistory().execute(command);
    },
  };
  commitDxfGripDragModeAware(toUnifiedGrip(grip), deltaMm, deps, 'stretch');
  return executed;
}
