'use client';

/**
 * bim3d-edit-drag-commit.ts — ADR-402/688. Finished-drag → command dispatch for the 3D
 * BIM gizmo. Extracted from `bim3d-edit-interaction-handlers.ts` (file-size N.7.1) so the
 * pointer-handler module stays focused on the event flow.
 *
 * Maps ONE `BridgeOutcome` (read from the controller on pointer-up) to a single dispatch,
 * then reports how the caller must dispose the live preview:
 *   - Ctrl copy-drag + move outcome → clone the selection at the drag delta (`commitCopyDrag`),
 *     leaving the original in place → returns 'copy' (the caller RESTORES the originals).
 *   - otherwise → the matching view-agnostic command (`buildEditCommand`) → returns 'move'
 *     (the caller keeps the live-moved meshes; the command re-sync replaces them).
 *   - no-op → false.
 * No React; store reads happen at event time (ADR-040). Imports only the `EditInteractionCtx`
 * TYPE from the handler module (type-only → no runtime cycle, mirror `-live-preview-apply`).
 */

import type { WallEntity } from '../../bim/types/wall-types';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import { getGlobalCommandHistory } from '../../core/commands';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import { resolveEntityLevelId } from './bim3d-edit-live-preview-apply';
import { buildDeps } from './bim3d-edit-interaction-helpers';
import { buildEditCommand } from './bim3d-edit-command-builders';
import { commitCopyDrag } from './bim3d-edit-copy-commit';
import { emitStructuralChangeAfterEdit } from './bim3d-edit-structural-emit';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/**
 * Dispatch ONE view-agnostic command from the drag outcome (one undo step).
 * Returns 'move' when a normal command executed (the caller keeps the live preview and lets
 * the re-sync replace the meshes), 'copy' when a Ctrl copy-drag cloned instead (the caller
 * RESTORES the originals to the source), false on a no-op (the caller restores too).
 * ADR-402 Phase C — move/rotate apply to the whole multi-selection; the adapter resolves the
 * primary element's level (same-floor multi is the common case — cross-floor multi falls back
 * to the active level, see ADR-402 limitations).
 */
export function dispatchOutcome(
  ctx: EditInteractionCtx,
  outcome: BridgeOutcome,
  pickedWall?: WallEntity,
): 'move' | 'copy' | false {
  if (outcome.kind === 'none') return false;
  const edit = useBim3DEditStore.getState();
  const levels = ctx.getLevels();
  const entityIds = edit.editEntityIds;
  const entityId = entityIds[0];
  if (!levels || !entityId) return false;
  const levelId = resolveEntityLevelId(levels, entityId) ?? levels.currentLevelId;
  if (!levelId) return false;
  const sm = createSceneManagerAdapter(buildDeps(levels, levelId));
  if (!sm) return false;
  // ADR-688 Φ3 — Ctrl copy-drag: a move outcome clones the selection at the drag delta and
  // leaves the original in place. A zero plan delta (pure-vertical drag) → falls through to a
  // normal vertical move below (the clone SSoT is plan-only).
  if (ctx.copyDrag.active && outcome.kind === 'move') {
    if (commitCopyDrag(ctx, outcome, { entityIds, entityId, axisLock: edit.axisLock, sm })) {
      useBim3DEditStore.getState().setBasePointOverride(null);
      useBim3DEditStore.getState().setTargetLevel(levelId);
      return 'copy';
    }
  }
  const cmd = buildEditCommand(outcome, { entityIds, entityId, edit, sm, levels, levelId, pickedWall });
  if (!cmd) return false;
  // `validate` is optional on ICommand (CompoundCommand has none — it validates each
  // child at execute time and rolls back on failure). Only block on a real error.
  if ('validate' in cmd && cmd.validate() !== null) return false;
  // ADR-408 — a relocated base point is CONSUMED by any non-rotate transform (Revit
  // «specify base point» is per-command); rotate keeps the invariant pivot. Clear
  // BEFORE execute so the entity-resync re-anchors the gizmo on the centroid.
  if (outcome.kind !== 'rotate') useBim3DEditStore.getState().setBasePointOverride(null);
  getGlobalCommandHistory().execute(cmd);
  // ADR-459 Φ7 — announce the edit as a structural-change event (mirror the 2D grip
  // commit layer) so the auto-foundation designer / organism / persistence react. Must
  // run AFTER execute so the edited command is the last on the stack when the coalesced
  // reactor microtask groups the derived footing update into the same atomic undo step.
  emitStructuralChangeAfterEdit(cmd, entityIds, sm);
  useBim3DEditStore.getState().setTargetLevel(levelId);
  return 'move';
}
