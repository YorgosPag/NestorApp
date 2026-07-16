/**
 * ADR-363 Phase 1G.5 — whole-entity "move from characteristic point" (AutoCAD base-point move).
 *
 * Split out of `grip-commit-adapters.ts` (ADR-663 §4 part 5), mirroring the earlier
 * `grip-scene-manager-adapter.ts` extraction. Reason: this is a **leaf SSoT** — several
 * commit modules need it and it needs nothing from them — but its old home imports
 * `grip-parametric-dispatch`, which imports the `grip-parametric-commits` barrel, which
 * re-exports those very commit modules. Importing it from there therefore closed an
 * import cycle and the eager `PARAMETRIC_COMMIT_HANDLERS` registry detonated it as a
 * TDZ `ReferenceError` at module-init, taking a whole test suite down. Living in a leaf
 * module, it has no path back into the dispatcher.
 *
 * @see ./grip-commit-adapters.ts — mode-aware commit; re-exports this for its own callers
 * @see ./grip-scene-manager-adapter.ts — same extraction, same reason
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';
import { CopyEntityCommand, type CopyEntityParams } from '../../core/commands/entity-commands/CopyEntityCommand';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { executeWholeEntityConnectivityMove } from '../../bim/mep-segments/build-whole-entity-connectivity-move';

/**
 * Translates the ENTIRE entity by `delta` via `deps.moveEntities` (→ MoveEntityCommand →
 * `calculateBimMovedGeometry`), or clones it with the same displacement when `copy` is set
 * (CopyEntityCommand, copy-with-base-point). Shared SSoT for the `mode === 'move'` branch
 * AND the Alt-modifier bypass so both routes stay byte-identical.
 *
 * ADR-627 — the hatch MOVE cross (`commitHatchGripDrag`) reuses this EXACT whole-entity
 * translate + copy-with-base-point path: the hatch grip is intercepted by
 * `tryCommitParametricGripDrag` on `on:'hatch'` before the mode-aware move gate runs, so it
 * cannot fall through to it — it calls this SSoT directly instead of duplicating it.
 */
export function commitWholeEntityMove(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  copy: boolean,
): void {
  if (!grip.entityId) return;
  if (copy) {
    const sceneManager = createSceneManagerAdapter(deps);
    if (!sceneManager) return;
    const params: CopyEntityParams = { vertexMoves: [], anchorMoves: [grip.entityId], displacement: delta };
    const command = new CopyEntityCommand(params, sceneManager);
    if (command.validate() !== null) return;
    deps.execute(command);
    GripCopyModeStore.bumpCount();
    return;
  }
  // ADR-408 Φ-C (move-from-point side) — when the moved entity is a plumbing
  // connector host (sink / manifold / boiler / radiator / water-heater), its
  // connected pipe ends must FOLLOW it (Revit "host moves, connectors move with
  // it"). The parametric grip path already does this via
  // `executeHostMoveWithConnectedPipes`; this whole-entity / Alt move-from-point
  // path historically used a bare `MoveEntityCommand` (connectivity-blind), so the
  // run tore off the network. Route plumbing hosts through the SAME shared executor
  // (one CompoundCommand = single undo). Returns false for non-plumbing entities →
  // fall back to the standard move (walls / furniture / panels stay byte-identical).
  const sceneManager = createSceneManagerAdapter(deps);
  if (
    sceneManager &&
    executeWholeEntityConnectivityMove({ entityId: grip.entityId, delta, sceneManager, execute: deps.execute })
  ) {
    return;
  }
  deps.moveEntities([grip.entityId], delta, { isDragging: false });
}
