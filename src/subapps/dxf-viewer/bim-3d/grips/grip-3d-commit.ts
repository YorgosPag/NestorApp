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
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { GripInfo } from '../../hooks/grip-types';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import { commit3DGripViaHistory } from './grip-3d-commit-shared';

/**
 * Map a 2D `GripInfo` onto the unified shape the commit adapters consume. The tagged
 * `gripKind` discriminator is forwarded 1:1 — `commitDxfGripDragModeAware` routes on its
 * `on` tag via `gripKindOf` (`commitSlabGripDrag` / `commitRoofGripDrag` /
 * `commitFloorFinishGripDrag` / `commitSlabOpeningGripDrag` / `commitColumnGripDrag` /
 * `commitWallGripDrag` / `commitBeamGripDrag`), so the bridge stays type-agnostic. ADR-602
 * Stage 5 — the 7 legacy per-entity `*GripKind` forwards were deleted; the one `gripKind`
 * carries slab/roof/floor-finish/slab-opening/column/wall/beam, so none can fall through.
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
    // ADR-602 Stage 5 — forward ONLY the tagged discriminator SSoT (the 7 legacy
    // `xxxGripKind` forwards were deleted). `commitDxfGripDragModeAware` reads via `gripKindOf`.
    gripKind: grip.gripKind,
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
  return commit3DGripViaHistory(toUnifiedGrip(grip), deltaMm, levels, levelId);
}
