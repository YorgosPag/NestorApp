/**
 * ADR-583 Φ3 — Annotation-symbol UNIFORM-resize grip commit («αύξηση λαβών», Giorgio 2026-07-09).
 *
 * A symbol's `sizeMm` is a flat annotative param (no derived params command), so a corner
 * resize drag transforms that field and writes it atomically via the generic
 * `UpdateEntityCommand` — the SAME pure `applyAnnotationSymbolGripDrag` SSoT the live ghost
 * runs, so preview ≡ commit by identity (mirror `commitScaleBarGripDrag`).
 *
 * ONLY the 4 corner handles route here (gated by `isAnnotationSymbolCornerKind`); the
 * `'annotation-symbol-move'` cross falls through to the whole-entity translate path and the
 * `'annotation-symbol-rotation'` handle to `commitAnnotationSymbolGripDrag`
 * (`RotateEntityCommand`) — both upstream in `commitDxfGripDragModeAware`.
 *
 * Split out of `grip-parametric-commits.ts` (N.7.1 file-size budget); re-exported from there
 * so the commit API stays one import.
 *
 * @see bim/annotation-symbols/annotation-symbol-grips.ts — `applyAnnotationSymbolGripDrag` (shared drag SSoT)
 * @see hooks/grips/grip-scale-bar-commit.ts — the flat-field parametric commit this mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { AnnotationSymbolEntity } from '../../types/annotation-symbol';
import { gripKindOf } from '../grip-kinds';
import {
  applyAnnotationSymbolGripDrag,
  isAnnotationSymbolCornerKind,
} from '../../bim/annotation-symbols/annotation-symbol-grips';
import { UpdateEntityCommand, type EntityPatch } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';

/**
 * ADR-583 Φ3 — annotation-symbol corner UNIFORM-resize commit. Routes the corner drag through
 * `applyAnnotationSymbolGripDrag` → `UpdateEntityCommand` (a `{ sizeMm }` flat patch).
 * Idempotent + undo/redo-safe. No-op for non-corner kinds (empty patch → early return).
 */
export function commitAnnotationSymbolResizeGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  const kind = gripKindOf(grip, 'annotation-symbol');
  if (!grip.entityId || !kind || !isAnnotationSymbolCornerKind(kind)) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as { type?: string }).type !== 'annotation-symbol') return;
  const entity = raw as unknown as AnnotationSymbolEntity;
  const patch = applyAnnotationSymbolGripDrag(kind, entity, grip.position, delta);
  if (Object.keys(patch).length === 0) return;
  const command = new UpdateEntityCommand(
    grip.entityId,
    patch as unknown as EntityPatch,
    sceneManager,
    'Resize annotation symbol',
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}
