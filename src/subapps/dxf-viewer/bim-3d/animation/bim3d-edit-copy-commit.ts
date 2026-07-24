'use client';

/**
 * bim3d-edit-copy-commit.ts — ADR-688 Φ3. Ctrl+drag move-copy commit for the 3D gizmo.
 *
 * Big-player parity (Revit «Copy» με drag, C4D/SketchUp/ArchiCAD Ctrl+drag): grab an
 * entity's move gizmo, hold Ctrl, drag → the ORIGINAL stays put and a CLONE is dropped
 * at the drag displacement. This module owns ONLY the commit side of that gesture; the
 * copy intent is frozen at press time in `EditInteractionCtx.copyDrag` and read on
 * pointer-up by `dispatchOutcome`.
 *
 * Reuse-only (N.0.2), zero new clone/ghost/drag:
 *   - `resolveMovePlanDeltaCanvas` — the SAME native-units plan delta the move command
 *     uses (axis-lock + `mmToEntityUnitFactor`), so the dropped copy lands EXACTLY where
 *     a move would have → ghost ≡ commit ≡ copy.
 *   - `buildEntityCloneCommand` — the clone SSoT shared with Ctrl+V paste / Ctrl+drag 2D
 *     body-copy (BIM enterprise IDs + host rewire + DXF id-swap, undoable, auto-persist).
 *   - `sceneEntitiesForEdit` — the edited entities' floor entity list (shared with the
 *     live-preview apply path).
 *   - `ctx.reselect` — the universal-selection SSoT the Φ1 clipboard uses to re-select the
 *     freshly created clones (Revit feedback).
 *
 * PLAN-ONLY (Φ3 scope): a pure-vertical Ctrl+drag (axis-Y arrow) has a zero plan delta →
 * this returns false and the caller falls through to a normal vertical move (the clone SSoT
 * does not express a z-delta; elevation-copy is a documented future extension).
 *
 * @see ./bim3d-edit-command-builders.ts — `resolveMovePlanDeltaCanvas` (shared delta SSoT)
 * @see ../../bim/transforms/build-entity-clone-command.ts — clone SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-688-3d-canvas-entity-copy-paste.md
 */

import type { BridgeOutcome } from '../gizmo/bim-gizmo-drag-bridge';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { getGlobalCommandHistory } from '../../core/commands';
import { buildEntityCloneCommand } from '../../bim/transforms/build-entity-clone-command';
import { resolveMovePlanDeltaCanvas } from './bim3d-edit-command-builders';
import { sceneEntitiesForEdit } from './bim3d-edit-live-preview-apply';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

/** Everything the copy commit needs, already resolved by `dispatchOutcome`. */
export interface CopyDragDeps {
  /** All edited ids (the whole selection copies; [0] = primary for unit scaling). */
  readonly entityIds: string[];
  readonly entityId: string;
  readonly axisLock: 'X' | 'Z' | null;
  readonly sm: ISceneManager;
}

/**
 * Commit a Ctrl copy-drag: clone the edited entities by the drag's plan delta, execute the
 * undoable clone command, and re-select the clones. Returns true when a clone was made;
 * false (non-move outcome / zero plan delta / no clonable source) → the caller performs a
 * normal move instead and restores the originals to the source.
 */
export function commitCopyDrag(
  ctx: EditInteractionCtx,
  outcome: BridgeOutcome,
  deps: CopyDragDeps,
): boolean {
  if (outcome.kind !== 'move') return false;
  const entities = sceneEntitiesForEdit(ctx);
  const primary = entities.find((e) => e.id === deps.entityId);
  const delta = resolveMovePlanDeltaCanvas(outcome, primary, deps.axisLock);
  // Plan-only: a pure-vertical drag has a zero plan delta → not a copy (caller falls through).
  if (delta.x === 0 && delta.y === 0) return false;
  const idSet = new Set(deps.entityIds);
  const sources = entities.filter((e) => idSet.has(e.id)) as unknown as SceneEntity[];
  if (sources.length === 0) return false;
  const result = buildEntityCloneCommand(sources, delta, deps.sm);
  if (!result) return false;
  getGlobalCommandHistory().execute(result.command);
  ctx.reselect(result.cloneIds);
  return true;
}
