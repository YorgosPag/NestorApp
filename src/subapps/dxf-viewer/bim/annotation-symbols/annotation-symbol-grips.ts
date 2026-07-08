/**
 * ADR-583 — Annotation symbol (North arrow) grip SSoT (pure helpers).
 *
 * The SINGLE source both grip paths consume so they can never diverge (mirror
 * `systems/arc/arc-grips.ts` ↔ `ArcRenderer.getGrips`):
 *   - `computeDxfEntityGrips` (case 'annotation-symbol') → interaction + hit-testing.
 *   - `AnnotationSymbolRenderer.getGrips`                → on-canvas 2D grip painting.
 *
 * Like the arc, the symbol has an intrinsic orientation → it gets BOTH a move cross
 * AND a rotation handle, but NO resize (fixed aspect, D5 — μέγεθος from the ribbon):
 *   0 → centre (whole-entity translate; `'annotation-symbol-move'` → 4-arrow MOVE
 *       glyph + directional prompt; `movesEntity` → `calculateMovedGeometry`).
 *   1 → rotation handle (`'annotation-symbol-rotation'` → RotateEntityCommand about
 *       the centre; tracks the glyph orientation).
 *
 * The handle sits below the centre (local −Y, `rotationHandleMidwayOffset` parity
 * με τον arc) and is rotated by the glyph's own `rotation` via the canonical
 * `rotatePoint` SSoT — no re-implemented cos/sin. Annotative: the offset scales
 * with the model size (paper-mm × drawing scale), the SAME size the renderer draws.
 *
 * @see systems/arc/arc-grips.ts — the move+rotation primitive template
 * @see bim/annotation-symbols/annotation-symbol-model-size.ts — annotative size SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, AnnotationSymbolGripKind } from '../../hooks/grip-types';
import { rotatePoint } from '../../utils/rotation-math';
import { rotationHandleMidwayOffset } from '../grips/rotation-handle-policy';
import { annotationSymbolModelSizeLive } from './annotation-symbol-model-size';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from '../../types/annotation-symbol';

/** The annotation-symbol MOVE + ROTATION grip kinds (mirror `arc-move` / `arc-rotation`). */
export const ANNOTATION_SYMBOL_MOVE_KIND: AnnotationSymbolGripKind = 'annotation-symbol-move';
export const ANNOTATION_SYMBOL_ROTATION_KIND: AnnotationSymbolGripKind = 'annotation-symbol-rotation';

/**
 * World position of the rotation handle: below the centre (local −Y, midway offset)
 * rotated by the glyph's own `rotation` so it tracks the symbol's orientation.
 */
export function annotationSymbolRotationHandlePos(
  position: Point2D,
  modelSize: number,
  rotationDeg: number,
): Point2D {
  const offY = rotationHandleMidwayOffset(modelSize); // negative (convex) ⇒ −modelSize/4
  const handleLocal: Point2D = { x: position.x, y: position.y + offY };
  return rotatePoint(handleLocal, position, rotationDeg);
}

/**
 * The 2 grips of an annotation symbol — the SSoT both grip paths consume:
 *   0 → centre MOVE cross (`'annotation-symbol-move'`, `movesEntity`).
 *   1 → rotation handle (`'annotation-symbol-rotation'`, `type: 'vertex'` so the
 *       showMidpoints/showCenters prefs never hide it).
 */
export function getAnnotationSymbolGrips(
  entityId: string,
  position: Point2D,
  sizeMm: number | undefined,
  rotationDeg: number | undefined,
): GripInfo[] {
  const modelSize = annotationSymbolModelSizeLive(sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM);
  const rot = rotationDeg ?? 0;
  return [
    {
      entityId, gripIndex: 0, type: 'center',
      position, movesEntity: true, annotationSymbolGripKind: ANNOTATION_SYMBOL_MOVE_KIND,
      gripKind: { on: 'annotation-symbol', kind: ANNOTATION_SYMBOL_MOVE_KIND },
    },
    {
      entityId, gripIndex: 1, type: 'vertex',
      position: annotationSymbolRotationHandlePos(position, modelSize, rot),
      movesEntity: false, annotationSymbolGripKind: ANNOTATION_SYMBOL_ROTATION_KIND,
      gripKind: { on: 'annotation-symbol', kind: ANNOTATION_SYMBOL_ROTATION_KIND },
    },
  ];
}
