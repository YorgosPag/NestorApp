'use client';

/**
 * grip-3d-dxf-commit.ts — RAW DXF 3D reshape-grip drag → view-agnostic command
 * (ADR-537). Sibling of `grip-3d-commit.ts` (BIM), but the unified grip forwards NO
 * BIM `*GripKind`, so `commitDxfGripDragModeAware` lands on its DEFAULT leg:
 *   - polyline arc-apex → `commitPolylineBulgeGripDrag` (+ `SetBulgeCommand`)
 *   - everything else   → `commitDxfGripDragViaStretchCommand` (+ `StretchEntityCommand`
 *     vertex refs, or whole-entity `anchorMoves` for a `movesEntity` grip).
 *
 * The scene re-syncs automatically (the command writes the level scene via
 * `setLevelScene`, which the DXF overlay rebuilds from). `buildDeps.execute` is a no-op,
 * so we override it with a real history-backed dispatcher (same fix as ADR-535 §6.1) —
 * otherwise the built command would be silently dropped. Single command = single undo.
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
 * Map a raw-DXF `GripInfo` onto the unified shape the commit adapters consume. Forwards
 * ONLY the raw-DXF-relevant fields (NO BIM `*GripKind`), so the commit routes through the
 * stretch / bulge default path. `polylineGripKind` IS forwarded (raw-DXF discriminator —
 * arc-apex bulge vs vertex/segment stretch).
 */
export function toRawDxfUnifiedGrip(grip: GripInfo): UnifiedGripInfo {
  return {
    id: `dxf_${grip.entityId}_${grip.gripIndex}`,
    source: 'dxf',
    entityId: grip.entityId,
    gripIndex: grip.gripIndex,
    // GripType 'midpoint' (edge-midpoint) maps onto the unified 'edge' type.
    type: grip.type === 'midpoint' ? 'edge' : grip.type === 'corner' ? 'vertex' : grip.type,
    position: grip.position,
    movesEntity: grip.movesEntity,
    edgeVertexIndices: grip.edgeVertexIndices,
    polylineGripKind: grip.polylineGripKind,
  };
}

/**
 * Commit a raw-DXF 3D reshape-grip drag for `levelId`. Returns the executed command (for
 * an undo-step assertion in tests), or null on a no-op (zero delta / validation reject).
 * Single command = single undo step.
 */
export function commitDxfGrip3D(
  grip: GripInfo,
  deltaMm: Point2D,
  levels: LevelsHookReturn,
  levelId: string,
): ICommand | null {
  if (deltaMm.x === 0 && deltaMm.y === 0) return null;
  let executed: ICommand | null = null;
  const deps: DxfCommitDeps = {
    ...buildDeps(levels, levelId),
    // Real history-backed dispatcher (buildDeps.execute is a no-op) — mirror ADR-535 §6.1.
    execute: (command) => {
      executed = command;
      getGlobalCommandHistory().execute(command);
    },
  };
  commitDxfGripDragModeAware(toRawDxfUnifiedGrip(grip), deltaMm, deps, 'stretch');
  return executed;
}
