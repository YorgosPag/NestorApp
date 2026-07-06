/**
 * ADR-557 — parametric text/mtext grip commit (rect-box parity).
 *
 * Bypasses the generic stretch/move path because the text box transform (move /
 * rotate / corner+edge resize) is computed by the shared `applyTextGripDrag`
 * (the SAME pure transform the ghost preview runs → preview ≡ commit) and written
 * atomically to the TOP-LEVEL fields via `UpdateTextTransformCommand`. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo (ADR-031).
 *
 * The scene entity (`TextEntity` / `MTextEntity`) is projected to the flat `DxfText`
 * the grips were computed from using the SAME converter SSoT helpers
 * (`resolveTextHeight` + `extractFlatText`), so the commit math is byte-identical to
 * what the user saw while dragging.
 *
 * Split out of `grip-parametric-commits.ts` (N.7.1 file-size budget); re-exported
 * from there so the commit API stays one import.
 */

import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { applyTextGripDrag, type TextTransformPatch } from '../../bim/text/text-grips';
import {
  UpdateTextTransformCommand,
  type TextTransformState,
} from '../../core/commands/text/UpdateTextTransformCommand';
// ADR-557 Φ-attachment — scene→DxfText projection SSoT (shared with the live ghost, so
// preview ≡ commit; see project-scene-text.ts header for the raw-entity regression it fixes).
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/** Current full transform state of the projected text (the undo target). */
function textTransformStateOf(t: DxfText): TextTransformState {
  return {
    position: t.position,
    rotation: t.rotation ?? 0,
    height: t.height,
    fontSize: t.height,
    ...(t.width != null ? { width: t.width } : { widthFactor: t.widthFactor ?? 1 }),
  };
}

/** Fold a partial grip patch onto the previous state → the new full state. */
function mergeTextTransform(prev: TextTransformState, patch: TextTransformPatch): TextTransformState {
  const height = patch.height ?? prev.height;
  return {
    position: patch.position ?? prev.position,
    rotation: patch.rotation ?? prev.rotation,
    height,
    fontSize: height,
    ...(prev.width != null
      ? { width: patch.width ?? prev.width }
      : { widthFactor: patch.widthFactor ?? prev.widthFactor }),
  };
}

/** ADR-557 — parametric text/mtext grip commit via `UpdateTextTransformCommand`. */
export function commitTextGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.textGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const e = raw as unknown as TextSceneShape;
  if (e.type !== 'text' && e.type !== 'mtext') return;

  const dxfText = projectSceneTextToDxf(e, grip.entityId);
  // Anchor = the grabbed grip's world position (matches the rotation sweep start
  // `currentPos − delta`); `currentPos` is the live cursor. Mirror of the column commit.
  const anchor = grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const patch = applyTextGripDrag(grip.textGripKind, { entity: dxfText, delta, currentPos });
  if (Object.keys(patch).length === 0) return;

  const previous = textTransformStateOf(dxfText);
  const next = mergeTextTransform(previous, patch);
  const command = new UpdateTextTransformCommand(grip.entityId, next, previous, sceneManager, true);
  if (command.validate() !== null) return;
  deps.execute(command);
}
