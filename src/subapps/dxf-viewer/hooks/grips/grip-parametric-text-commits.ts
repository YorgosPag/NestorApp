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
  const validateResult = command.validate();
  // TEMP-DIAG (2026-07-06) — commit trace. REMOVE WHEN SOLVED. Shows the computed
  // patch/next, validate result, then what ACTUALLY persisted (flat vs textNode height).
  // eslint-disable-next-line no-console
  console.log('[TEXT-COMMIT-DIAG]', {
    kind: grip.textGripKind,
    entityType: e.type,
    delta,
    projected: { height: dxfText.height, text: dxfText.text, widthFactor: dxfText.widthFactor, width: dxfText.width },
    patch, next, validate: validateResult,
  });
  if (validateResult !== null) return;
  deps.execute(command);
  // TEMP-DIAG — re-fetch AFTER commit: does the flat write stick, or is height shadowed by textNode?
  const after = sceneManager.getEntity(grip.entityId) as unknown as Record<string, unknown> | null;
  const runHeight = (after?.textNode as { paragraphs?: Array<{ runs?: Array<{ style?: { height?: number } }> }> } | undefined)
    ?.paragraphs?.[0]?.runs?.[0]?.style?.height ?? null;
  // eslint-disable-next-line no-console
  console.log('[TEXT-COMMIT-AFTER]', after ? {
    type: after.type, position: after.position, height: after.height, fontSize: after.fontSize,
    widthFactor: after.widthFactor, width: after.width, textNodeRunHeight: runHeight,
  } : { after: 'null' });
}
