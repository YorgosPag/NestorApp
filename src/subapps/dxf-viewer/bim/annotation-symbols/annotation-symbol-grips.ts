/**
 * ADR-583 — Annotation symbol (North arrow) grip SSoT (pure helpers).
 *
 * The SINGLE source both grip paths consume so they can never diverge (mirror
 * `systems/arc/arc-grips.ts` ↔ `ArcRenderer.getGrips`):
 *   - `computeDxfEntityGrips` (case 'annotation-symbol') → interaction + hit-testing.
 *   - `AnnotationSymbolRenderer.getGrips`                → on-canvas 2D grip painting.
 *
 * Like the arc, the symbol has an intrinsic orientation → it gets a move cross AND a
 * rotation handle; ADR-583 Φ3 («αύξηση λαβών», Giorgio 2026-07-09) ADDS 4 UNIFORM-scale
 * corner resize handles (revised D5 — a fixed-aspect glyph still scales uniformly, the
 * Revit/Figma annotative standard):
 *   0   → centre (whole-entity translate; `'annotation-symbol-move'` → 4-arrow MOVE
 *         glyph + directional prompt; `movesEntity` → `calculateMovedGeometry`).
 *   1   → rotation handle (`'annotation-symbol-rotation'` → RotateEntityCommand about
 *         the centre; tracks the glyph orientation).
 *   2-5 → corner resize handles (ne/nw/sw/se, `'annotation-symbol-corner-*'`,
 *         `type:'vertex'`) that UNIFORMLY scale `sizeMm` about the insertion point.
 *         `type:'vertex'` → always visible on a selected symbol (single AND multi-select),
 *         so they also fix the original «σύμβολα δεν δείχνουν highlight σε multi-select» bug.
 *
 * The rotation handle sits below the centre (local −Y, `rotationHandleMidwayOffset` parity
 * με τον arc) and is rotated by the glyph's own `rotation` via the canonical `rotatePoint`
 * SSoT — no re-implemented cos/sin. The corners come from the shared rotated-rectangle SSoT
 * (`rectCornerWorld` / `RECT_CORNERS`, the SAME code walls/columns/furniture use) on a SQUARE
 * affordance box (half-extent = modelSize/2). Annotative: both offsets scale with the model
 * size (paper-mm × drawing scale), the SAME size the renderer draws.
 *
 * @see systems/arc/arc-grips.ts — the move+rotation primitive template
 * @see bim/grips/rect-frame.ts — `rectCornerWorld` / `RECT_CORNERS` (corner geometry SSoT)
 * @see bim/scale-bar/scale-bar-grips.ts — the SCALE-FREE ratio resize pattern (Φ2)
 * @see bim/annotation-symbols/annotation-symbol-model-size.ts — annotative size SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, AnnotationSymbolGripKind } from '../../hooks/grip-types';
import { rotatePoint } from '../../utils/rotation-math';
import { rotationHandleMidwayOffset } from '../grips/rotation-handle-policy';
import type { RectFrame } from '../grips/rect-frame';
import { rectCornerWorld, RECT_CORNERS } from '../grips/rect-frame';
import { annotationSymbolModelSizeLive } from './annotation-symbol-model-size';
import {
  DEFAULT_ANNOTATION_SYMBOL_SIZE_MM,
  type AnnotationSymbolEntity,
} from '../../types/annotation-symbol';

/** The annotation-symbol MOVE + ROTATION grip kinds (mirror `arc-move` / `arc-rotation`). */
export const ANNOTATION_SYMBOL_MOVE_KIND: AnnotationSymbolGripKind = 'annotation-symbol-move';
export const ANNOTATION_SYMBOL_ROTATION_KIND: AnnotationSymbolGripKind = 'annotation-symbol-rotation';

/**
 * The 4 UNIFORM-scale corner resize grip kinds (ADR-583 Φ3). Order MATCHES `RECT_CORNERS`
 * (NE, NW, SW, SE) so `getAnnotationSymbolGrips` can zip them index-for-index.
 */
export const ANNOTATION_SYMBOL_CORNER_KINDS: readonly AnnotationSymbolGripKind[] = [
  'annotation-symbol-corner-ne',
  'annotation-symbol-corner-nw',
  'annotation-symbol-corner-sw',
  'annotation-symbol-corner-se',
];

/** Minimum annotative glyph height (paper mm) — the corner resize clamps to this. */
export const MIN_ANNOTATION_SYMBOL_SIZE_MM = 1;

/** True for the 4 corner resize kinds (the only kinds `applyAnnotationSymbolGripDrag` acts on). */
export function isAnnotationSymbolCornerKind(kind: AnnotationSymbolGripKind): boolean {
  return kind.startsWith('annotation-symbol-corner-');
}

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
 * The 6 grips of an annotation symbol — the SSoT both grip paths consume:
 *   0   → centre MOVE cross (`'annotation-symbol-move'`, `movesEntity`).
 *   1   → rotation handle (`'annotation-symbol-rotation'`, `type: 'vertex'` so the
 *         showMidpoints/showCenters prefs never hide it).
 *   2-5 → corner UNIFORM-resize handles (ne/nw/sw/se, `type: 'vertex'`), placed on a
 *         SQUARE box (half-extent = modelSize/2, rotated by the glyph) via the shared
 *         `rectCornerWorld` / `RECT_CORNERS` corner-geometry SSoT.
 */
export function getAnnotationSymbolGrips(
  entityId: string,
  position: Point2D,
  sizeMm: number | undefined,
  rotationDeg: number | undefined,
): GripInfo[] {
  const modelSize = annotationSymbolModelSizeLive(sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM);
  const rot = rotationDeg ?? 0;
  // Square affordance box centred on the insertion point, rotated by the glyph's own
  // rotation — the corners scale `sizeMm` uniformly, so width == length (fixed aspect).
  const half = modelSize / 2;
  const frame: RectFrame = { center: position, rotationDeg: rot, halfWidth: half, halfLength: half };
  const grips: GripInfo[] = [
    {
      entityId, gripIndex: 0, type: 'center',
      position, movesEntity: true,
      gripKind: { on: 'annotation-symbol', kind: ANNOTATION_SYMBOL_MOVE_KIND },
    },
    {
      entityId, gripIndex: 1, type: 'vertex',
      position: annotationSymbolRotationHandlePos(position, modelSize, rot),
      movesEntity: false,
      gripKind: { on: 'annotation-symbol', kind: ANNOTATION_SYMBOL_ROTATION_KIND },
    },
  ];
  RECT_CORNERS.forEach((corner, i) => {
    grips.push({
      entityId, gripIndex: 2 + i, type: 'vertex',
      position: rectCornerWorld(frame, corner),
      movesEntity: false,
      gripKind: { on: 'annotation-symbol', kind: ANNOTATION_SYMBOL_CORNER_KINDS[i] },
    });
  });
  return grips;
}

/**
 * Pure drag transform — the params patch for an annotation-symbol grip drag (the SSoT the
 * commit AND the live ghost both run, so preview ≡ commit by identity; mirror
 * `applyScaleBarGripDrag`). ONLY the 4 corner handles act here (uniform resize); the move /
 * rotation kinds return `{}` because they commit through their own richer SSoTs
 * (whole-entity move + `RotateEntityCommand` hot-grip).
 *
 * UNIFORM scale about the insertion point (Revit/Figma annotative standard, revised D5): the
 * paper `sizeMm` scales by the SCALE-FREE radial ratio `newDist/oldDist`. The drawingScale +
 * sceneUnits factors cancel (model/model → dimensionless), so no store read is needed in the
 * drag and the aspect ratio is preserved. `position` never moves (it IS the scale pivot).
 * `gripWorldPos` = the grabbed corner's world anchor; `delta` = the cursor displacement.
 */
export function applyAnnotationSymbolGripDrag(
  kind: AnnotationSymbolGripKind,
  entity: Pick<AnnotationSymbolEntity, 'position' | 'sizeMm'>,
  gripWorldPos: Point2D,
  delta: Point2D,
): Partial<AnnotationSymbolEntity> {
  if (!isAnnotationSymbolCornerKind(kind)) return {};
  const { position } = entity;
  const oldX = gripWorldPos.x - position.x;
  const oldY = gripWorldPos.y - position.y;
  const oldDist = Math.hypot(oldX, oldY);
  if (oldDist <= 1e-6) return {};
  const newDist = Math.hypot(oldX + delta.x, oldY + delta.y);
  const size = entity.sizeMm ?? DEFAULT_ANNOTATION_SYMBOL_SIZE_MM;
  return { sizeMm: Math.max((size * newDist) / oldDist, MIN_ANNOTATION_SYMBOL_SIZE_MM) };
}
