/**
 * GRIP GHOST PREVIEW — live cursor-driven drag-preview resolver
 *
 * ADR-040 Φ12 — `cursorMode: 'world-position'`: the harness feeds the LIVE realtime
 * effective-world (same SSoT + same 60fps clock as the compositor crosshair). This pure
 * helper recomputes, from that cursor, whatever the drag drives 1:1 so the ghost is locked
 * to the cursor with zero React-state lag — byte-identical to the React `dragPreview`:
 *  · CURSOR-DRIVEN ROTATION (free rotate / 6-click align-end) → recompute the sweep
 *    (delta + angle readout) from the cursor — Revit/AutoCAD rotate tracks 1:1.
 *  · TRANSLATE / parametric RESIZE → recompute the move delta from the cursor.
 * Excluded (kept on the React `dragPreview`): TYPED-angle rotation (keyed value, NOT
 * cursor-driven) and HATCH-gradient drags (bespoke origin/angle marker geometry).
 *
 * ADR-397 / ADR-357 — POLAR + AutoAlign ίχνη κατά την περιστροφή (parity με σχεδίαση):
 * resolved BEFORE the sweep so the polar/alignment-locked cursor feeds the rotation → the
 * orange/white line coincides with the rotating wall. Only for cursor-driven free / align-end
 * rotate. Extracted from `useGripGhostPreview` (file-size SRP split, N.7.1) — pure function,
 * no closures, so the live geometry cannot diverge from the hook.
 *
 * @module hooks/tools/grip-ghost-preview-live-transform
 * @see hooks/tools/useGripGhostPreview — the consuming hook
 * @see ADR-040 — Preview Canvas Performance
 */

import type { ViewTransform } from '../../rendering/types/Types';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import type { DxfGripDragPreview } from '../grip-computation';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import { resolveRotationTracking, type RotationTracking } from './rotation-tracking-overlay';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { resolveGripTranslateDelta, resolveLiveRotationFromCursor } from '../grips/grip-projections';

/** Result of the live cursor-driven recompute: the refreshed preview + optional rotation tracking. */
export interface LiveGripDragPreviewResult {
  /** The preview with `delta` / rotation sweep recomputed live from the cursor (or the input unchanged). */
  readonly dp: DxfGripDragPreview;
  /** Rotation POLAR/AutoAlign tracking (null unless a cursor-driven rotation is in progress). */
  readonly rotationTracking: RotationTracking | null;
}

/**
 * ADR-040 Φ12 — recompute the drag preview from the LIVE effective-world cursor. See the module
 * doc for the full rationale. `isRotation` / `isHatchDrag` are passed in (already derived by the
 * caller) so the translate branch stays gated exactly as before.
 */
export function resolveLiveGripDragPreview(
  dragPreview: DxfGripDragPreview,
  effectiveCursor: GhostDrawFrame['effectiveCursor'],
  t: ViewTransform,
  levelManager: LevelSceneReader,
  isRotation: boolean,
  isHatchDrag: boolean,
): LiveGripDragPreviewResult {
  let dp = dragPreview;
  let rotationTracking: RotationTracking | null = null;
  let sweepCursor = effectiveCursor;
  if (effectiveCursor && dragPreview.rotateCursorDriven && dragPreview.rotatePivot) {
    const ambientOn = ambientAlignmentConfigStore.getSnapshot().enabled;
    const sceneEntitiesForAmbient = ambientOn && levelManager.currentLevelId
      ? levelManager.getLevelScene(levelManager.currentLevelId)?.entities ?? null
      : null;
    rotationTracking = resolveRotationTracking(
      dragPreview.rotatePivot, effectiveCursor, t.scale, sceneEntitiesForAmbient,
    );
    sweepCursor = rotationTracking.cursor;
  }
  if (sweepCursor) {
    if (dragPreview.rotateCursorDriven && dragPreview.rotatePivot && dragPreview.anchorPos) {
      dp = { ...dragPreview, ...resolveLiveRotationFromCursor(dragPreview, sweepCursor) };
    } else if (!isRotation && !isHatchDrag && dragPreview.anchorPos) {
      dp = {
        ...dragPreview,
        delta: resolveGripTranslateDelta(
          dragPreview.anchorPos,
          sweepCursor, // === effectiveCursor in this branch, but narrowed non-null by the `if (sweepCursor)` guard
          dragPreview.movesEntity === true || dragPreview.hotGrip === true,
        ),
      };
    }
  }
  return { dp, rotationTracking };
}
