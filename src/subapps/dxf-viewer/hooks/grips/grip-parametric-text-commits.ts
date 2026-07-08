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
// ADR-557/397 — the entity-agnostic rotate hot-grip commit context (picked pivot +
// reference anchor), published by the hook during a `text-rotation` free/reference spin.
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { gripKindOf } from '../grip-kinds';
// ADR-557 Φ-attachment — durable height write: the run-height SSoT `resolveTextHeight` reads.
import { scaleTextNodeRunHeights } from '../../utils/text-node-utils';
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
  const textKind = gripKindOf(grip, 'text');
  if (!grip.entityId || !textKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const e = raw as unknown as TextSceneShape;
  if (e.type !== 'text' && e.type !== 'mtext') return;

  const dxfText = projectSceneTextToDxf(e, grip.entityId);
  // ADR-557/397 — the text-rotation 6-click / free hot-grip rotates around a
  // USER-PICKED centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore
  // (entity-agnostic); `delta = cursor − anchor`, so `currentPos = anchor + delta` is
  // the live cursor and `pivot` is the rotation centre. Mirror of commitColumnGripDrag.
  // Every other text grip (move / resize) uses the grabbed grip position as the anchor
  // and applyTextRotation's default bbox-centre pivot.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    textKind === 'text-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const patch = applyTextGripDrag(textKind, {
    entity: dxfText,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (Object.keys(patch).length === 0) return;

  const previous = textTransformStateOf(dxfText);
  const next = mergeTextTransform(previous, patch);
  // ADR-557 Φ-attachment — durable height: `resolveTextHeight` reads the textNode run
  // height FIRST, so a flat `height` write is shadowed. When a resize changed the height,
  // scale the raw entity's textNode run heights by the box-height ratio and carry it on
  // BOTH states (undo restores the pre-drag node). Move/rotate leave `patch.height` unset
  // → textNode untouched.
  if (e.textNode && patch.height != null && previous.height > 0) {
    const ratio = next.height / previous.height;
    previous.textNode = e.textNode;
    next.textNode = scaleTextNodeRunHeights(e.textNode, ratio);
  }
  const command = new UpdateTextTransformCommand(grip.entityId, next, previous, sceneManager, true);
  if (command.validate() !== null) return;
  deps.execute(command);
}
