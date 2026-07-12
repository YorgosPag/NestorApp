/**
 * ADR-641 — BLOCK selection-box SCALE grip commit (Giorgio 2026-07-12 «οι ίδιες λαβές που
 * δείχνει ένας τοίχος»).
 *
 * A block's placement is a flat `{ position, scale }` INSERT transform (no derived-params
 * command), so a corner/edge box drag transforms those two fields and writes them atomically
 * via the generic `UpdateEntityCommand` — the SAME pure `applyBlockBoxGripDrag` SSoT the live
 * ghost runs, so preview ≡ commit by identity (mirror `commitAnnotationSymbolResizeGripDrag`).
 * The canonical `block.entities` (definition-local members) stay immutable — AutoCAD block
 * scale semantics.
 *
 * ONLY the 8 box handles route here (gated by `blockBoxRoleFromKind`); the `block-move` cross
 * falls through to the whole-block translate path and `block-rotation` to
 * `commitGroupGizmoRotation` — both upstream in `commitDxfGripDragModeAware`.
 *
 * @see systems/block/block-box-grips.ts — `applyBlockBoxGripDrag` (shared drag SSoT)
 * @see hooks/grips/grip-annotation-symbol-commit.ts — the flat-field parametric commit this mirrors
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { BlockEntity } from '../../types/entities';
import { gripKindOf } from '../grip-kinds';
import { applyBlockBoxGripDrag, blockBoxRoleFromKind } from '../../systems/block/block-box-grips';
import { UpdateEntityCommand, type EntityPatch } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * ADR-641 — block box (corner/edge) SCALE commit. Routes the drag through `applyBlockBoxGripDrag`
 * → `UpdateEntityCommand` (a `{ position, scale }` flat patch). Idempotent + undo/redo-safe.
 * No-op for non-box kinds (move/rotation) or a zero/degenerate drag (null patch → early return).
 */
export function commitBlockBoxScaleGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  const role = blockBoxRoleFromKind(gripKindOf(grip, 'block'));
  if (!grip.entityId || !role) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as { type?: string }).type !== 'block') return;
  const patch = applyBlockBoxGripDrag(role, raw as unknown as BlockEntity, delta);
  if (!patch) return;
  const command = new UpdateEntityCommand(
    grip.entityId,
    patch as unknown as EntityPatch,
    sceneManager,
    'Scale block',
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}
