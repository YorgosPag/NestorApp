/**
 * ADR-519 — Circular column ⇄ quadrant-grip adapter (kind `circular` only).
 *
 * Brings the **circular** column to full grip parity με την ορθογώνια (Giorgio
 * 2026-06-24, «ίδιος ακριβώς κώδικας, full SSoT»): κέντρο = σταυρός μετακίνησης
 * (4 αυτόνομα βελάκια) + **4 λαβές στις κορυφές τεταρτημορίων** (Β/Α/Ν/Δ) που
 * μεγαλώνουν την ακτίνα (διάμετρο). **ΧΩΡΙΣ** σήμα περιστροφής — ο κύκλος είναι
 * rotationally symmetric (το rotation drag είναι ήδη no-op για circular).
 *
 * Αδελφός του `column-rect-adapter.ts`: η ίδια δομή (kind guard + emission +
 * `apply*Grip` που γυρίζει `null` για μη-circular ή μη-quadrant kinds → ο caller
 * κάνει fall back). Reuse των ΙΔΙΩΝ 4 grip-kinds με τα 4 μέσα-πλευρών της
 * ορθογώνιας (`column-{width,depth,edge-w,edge-s}`) → «πανομοιότυπο» downstream
 * (glyph 'square', hit-test, dim labels) χωρίς νέα kinds.
 *
 * SEMANTICS (κύκλος): κάθε quadrant grip κάνει **συμμετρικό diameter resize περί
 * κέντρου** (factor 2) — το `position` (κέντρο) μένει σταθερό, ο κύκλος μεγαλώνει
 * ομοιόμορφα. Αυτό διαφέρει σκόπιμα από το opposite-edge-fixed της ορθογώνιας:
 * ο κύκλος ΔΕΝ έχει ανεξάρτητες πλευρές — μία ακτίνα, κεντραρισμένη.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/columns/column-rect-adapter.ts — αδελφός adapter (ορθογώνια), το πρότυπο
 * @see bim/columns/column-grip-utils.ts — `columnCenterMoveGrip` SSoT (center MOVE)
 * @see docs/centralized-systems/reference/adrs/ADR-519-circular-column-grips.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ColumnGripKind } from '../../hooks/useGripMovement';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import { MIN_COLUMN_DIMENSION_MM } from '../types/column-types';
import { mmScaleFor } from '../../utils/scene-units';
import { columnCenterMoveGrip } from './column-grip-utils';

/** True for the rotationally-symmetric circular column kind. */
export function isCircularColumn(params: ColumnParams): boolean {
  return params.kind === 'circular';
}

/**
 * `column-{width|depth|edge-w|edge-s}` → world quadrant axis + outward sign. Reuse
 * των ΙΔΙΩΝ kinds με τα 4 μέσα-πλευρών της ορθογώνιας: E=width(+X), N=depth(+Y),
 * W=edge-w(−X), S=edge-s(−Y). Κάθε ένα μεγαλώνει την ίδια διάμετρο (`width`).
 */
const CIRCULAR_QUADRANT_MAP: Partial<Record<ColumnGripKind, { axis: 'x' | 'y'; sign: 1 | -1 }>> = {
  'column-width': { axis: 'x', sign: 1 },
  'column-depth': { axis: 'y', sign: 1 },
  'column-edge-w': { axis: 'x', sign: -1 },
  'column-edge-s': { axis: 'y', sign: -1 },
};

/**
 * World position μιας quadrant λαβής πάνω στην περιφέρεια: `position ± r` στον
 * world άξονα (r = radius σε scene units). No rotation — ο κύκλος είναι συμμετρικός
 * (mirror του υπάρχοντος `widthHandleWorld` circular branch).
 */
function circularQuadrantWorld(params: ColumnParams, axis: 'x' | 'y', sign: 1 | -1): Point2D {
  const r = (params.width / 2) * mmScaleFor(params);
  const { x, y } = params.position;
  return axis === 'x' ? { x: x + sign * r, y } : { x, y: y + sign * r };
}

/**
 * ADR-519 — full grip set για circular column:
 *   0 → center MOVE (`column-center`, 4 αυτόνομα βελάκια — shared `columnCenterMoveGrip`)
 *   2 → width  (E quadrant, +X)
 *   3 → depth  (N quadrant, +Y)
 *   8 → edge-w (W quadrant, −X)
 *   9 → edge-s (S quadrant, −Y)
 * Δείκτες parity ορθογώνιας (2/3/8/9). ΧΩΡΙΣ rotation/corners (κύκλος = συμμετρικός).
 */
export function circularColumnGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const { id, params } = entity;
  const quad = (
    axis: 'x' | 'y',
    sign: 1 | -1,
    gripIndex: number,
    columnGripKind: ColumnGripKind,
  ): GripInfo => ({
    entityId: id,
    gripIndex,
    type: 'vertex',
    position: circularQuadrantWorld(params, axis, sign),
    movesEntity: false,
    gripKind: { on: 'column', kind: columnGripKind },
  });
  return [
    columnCenterMoveGrip(entity),
    quad('x', 1, 2, 'column-width'),
    quad('y', 1, 3, 'column-depth'),
    quad('x', -1, 8, 'column-edge-w'),
    quad('y', -1, 9, 'column-edge-s'),
  ];
}

/**
 * Apply a circular quadrant grip (συμμετρικό diameter resize περί κέντρου). Returns
 * `null` όταν το `gripKind` δεν είναι quadrant grip Ή η κολόνα δεν είναι circular —
 * ο caller κάνει fall back (mirror `applyRectColumnGrip`).
 *
 * `delta` σε scene units, `width` σε mm → `÷ s` (mirror `resizeWidth`). Το κέντρο
 * (`position`) μένει σταθερό· factor 2 ώστε η λαβή να ακολουθεί τον κέρσορα 1:1.
 */
export function applyCircularColumnGrip(
  gripKind: ColumnGripKind,
  params: ColumnParams,
  delta: Point2D,
): ColumnParams | null {
  if (!isCircularColumn(params)) return null;
  const q = CIRCULAR_QUADRANT_MAP[gripKind];
  if (!q) return null;
  const s = mmScaleFor(params);
  const component = q.axis === 'x' ? delta.x : delta.y;
  const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, params.width + (2 * (q.sign * component)) / s);
  return { ...params, width: newWidth };
}
