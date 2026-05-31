/**
 * bim3d-resize-bridge.ts — pure resize math bridge: gizmo resize drag → new entity params.
 *
 * ADR-402 (3D Viewport BIM Element Editing) — Phase B resize.
 *
 * Pure (no React, no Zustand, no scene mutation, no command dispatch). Mirrors
 * `bim-gizmo-drag-bridge` for the move/rotate path: it turns the resize drag the
 * gizmo produced (a world axis + the DXF-mm slide delta + the absolute cursor on
 * the floor plane, both in mm) into the new entity `params` by delegating to the
 * SAME view-agnostic 2D grip-drag SSoT the ribbon/2D-grips use
 * (`apply*GripDrag`). Zero new resize math lives here.
 *
 * The 2D `apply*GripDrag` helpers expect their `delta` / `currentPos` in scene
 * (canvas) units — NOT mm — so we scale the mm inputs by `mmScaleFor(params)`
 * (the canonical canvas-per-mm factor) exactly like the 2D commit path. The
 * per-type helper then projects onto the entity's local frame (columns via
 * `projectDeltaToLocal`), so the world-axis gizmo handle resizes the correct
 * dimension even for a rotated element.
 *
 * Phase B slice: columns (resize-x → width, resize-z → depth). Wall thickness /
 * length, beams and slabs follow the same pattern in a later slice.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GizmoAxis, GizmoResizeMode } from './gizmo-types';
import type { ColumnParams } from '../../bim/types/column-types';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import { mmScaleFor } from '../../utils/scene-units';

/** A finished gizmo resize drag, expressed in DXF-plan millimetres. */
export interface ResizeDragMm {
  readonly axis: GizmoAxis;
  readonly mode: GizmoResizeMode;
  /** World→DXF slide delta (mm) — from `worldDeltaToDxfDelta`. */
  readonly deltaMm: Point2D;
  /** Absolute cursor on the floor plane (mm) — from `worldToDxfPlan`. */
  readonly cursorMm: Point2D;
}

/** mm delta → scene/canvas-unit delta (`apply*GripDrag` work in canvas units). */
export function toCanvasDelta(deltaMm: Point2D, sceneScale: number): Point2D {
  return { x: deltaMm.x * sceneScale, y: deltaMm.y * sceneScale };
}

/** Column resize: resize-x → width (local X), resize-z → depth (local Y). */
function columnGripFor(axis: GizmoAxis): ColumnGripKind | null {
  if (axis === 'x') return 'column-width';
  if (axis === 'z') return 'column-depth';
  return null; // axis-y (height) is a later Phase B slice
}

/**
 * Column resize → new `ColumnParams`, or `null` when the axis has no column
 * mapping or the drag is a no-op (e.g. depth on a circular/polygon column —
 * `applyColumnGripDrag` returns the original params referentially).
 */
export function computeColumnResizeParams(
  params: ColumnParams,
  drag: ResizeDragMm,
): ColumnParams | null {
  const gripKind = columnGripFor(drag.axis);
  if (!gripKind) return null;
  const delta = toCanvasDelta(drag.deltaMm, mmScaleFor(params));
  const next = applyColumnGripDrag(gripKind, { originalParams: params, delta });
  return next === params ? null : next;
}
