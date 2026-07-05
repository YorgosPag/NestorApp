/**
 * GRIP GHOST PREVIEW — overlay draw helpers (clearance dims + hatch handle marker)
 *
 * Self-contained overlay renderers used at the TAIL of `useGripGhostPreview`'s draw
 * callback, extracted for file-size SRP (N.7.1, 2026-07-05):
 *   · ADR-508 §move-clearance — κυανές neighbor-clearance listening dims κατά το grip-drag
 *     (ΙΔΙΟ SSoT με useMovePreview + useEntityBodyDragPreview)·
 *   · ADR-507 Φ5 A3b/A4 — live gradient-origin/angle handle marker (ακολουθεί τον κέρσορα).
 * Stateless — δέχονται resolved scene entities / units, δεν κρατούν state.
 *
 * @module hooks/tools/grip-ghost-preview-overlay-helpers
 * @see hooks/tools/useGripGhostPreview — the consuming hook
 * @see ADR-507 / ADR-508 — the individual overlay behaviours
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Entity, HatchEntity } from '../../types/entities';
import type { DxfGripDragPreview } from '../grip-computation';
import type { SceneUnits } from '../../utils/scene-units';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { hatchBoundsCenter, hatchGradientAngleGripPos } from '../../bim/hatch/hatch-grips';
import { paintPolarTrackingLine } from '../../canvas-v2/preview-canvas/polar-tracking-line-paint';
import { formatMoveAngle } from '../../bim/labels/move-readout';
import { resolveMoveClearanceDims } from '../../bim/framing/move-clearance-dims';
import { paintGhostFaceDimensions } from '../../canvas-v2/preview-canvas/ghost-face-dim-paint';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { drawGradientOriginMarker } from './grip-ghost-preview-draw-helpers';

/**
 * ADR-508 §move-clearance — κυανές neighbor-clearance listening dims κατά το grip-drag: ΤΟ ΙΔΙΟ
 * `resolveMoveClearanceDims` + `paintGhostFaceDimensions` SSoT που τρέχουν το 2-click Move
 * (`useMovePreview`) + το body-drag (`useEntityBodyDragPreview`). Το grip-drag ήταν ο μόνος move
 * path που ΔΕΝ τα έδειχνε → parity. Χρήση του ΗΔΗ υπολογισμένου `transformed` ghost με delta {0,0}
 * → καλύπτει ΚΑΙ whole-move (κεντρικό grip) ΚΑΙ endpoint reshape με ΕΝΑ path (footprint του
 * μετασχηματισμένου). Self-excluded (το κινούμενο entity δεν μετριέται ως στόχος). Εξαιρείται η
 * περιστροφή (`rotatePivot`) + hatch-gradient (bespoke). No-op σε zero-delta (`transformed === entity`).
 */
export function paintGripMoveClearanceDims(
  ctx: CanvasRenderingContext2D,
  dp: DxfGripDragPreview,
  transformed: Entity,
  entity: Entity,
  sceneEntities: readonly Entity[],
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: Viewport,
): void {
  if (transformed === entity || dp.rotatePivot || dp.hatchGripKind) return;
  const clearanceDims = resolveMoveClearanceDims(
    transformed,
    { x: 0, y: 0 },
    new Set([dp.entityId]),
    sceneEntities,
    sceneUnits,
    worldPerPixel(t.scale),
  );
  if (clearanceDims) paintGhostFaceDimensions(ctx, clearanceDims, t, vp);
}

/**
 * ADR-507 Φ5 A3b/A4 — live handle marker (πάνω από το gradient ghost). Ζωντανή θέση από το preview
 * entity (ή το committed σε zero-delta). Origin → τετράγωνο στο κέντρο· angle → δαχτυλίδι-βραχίονας
 * (origin→handle) + τετράγωνο στο άκρο = «περιστροφή» (ΙΔΙΑ ένδειξη με την περιστροφή κολώνας:
 * πορτοκαλί guide ray στη snapped γωνία + tooltip τιμής). No-op όταν δεν σέρνεται λαβή gradient.
 */
export function drawHatchGradientHandleMarker(
  ctx: CanvasRenderingContext2D,
  isHatchOriginDrag: boolean,
  isHatchAngleDrag: boolean,
  transformed: Entity,
  entity: Entity,
  t: ViewTransform,
  vp: Viewport,
): void {
  if (!isHatchOriginDrag && !isHatchAngleDrag) return;
  const live = (transformed !== entity ? transformed : entity) as unknown as HatchEntity;
  const originW = live.patternOrigin ?? hatchBoundsCenter(live.boundaryPaths ?? []);
  if (originW && isHatchOriginDrag) {
    drawGradientOriginMarker(ctx, CoordinateTransforms.worldToScreen(originW, t, vp));
  } else if (originW && isHatchAngleDrag) {
    const angleDeg = live.gradient?.angleDeg ?? 0;
    const handleW = hatchGradientAngleGripPos(originW, angleDeg, live.boundaryPaths ?? []);
    if (handleW) {
      // ΙΔΙΑ ένδειξη με την περιστροφή κολώνας: πορτοκαλί guide ray στη (snapped) γωνία + tooltip τιμής.
      paintPolarTrackingLine(ctx, originW, angleDeg, formatMoveAngle(angleDeg), handleW, t, vp);
      drawGradientOriginMarker(ctx, CoordinateTransforms.worldToScreen(handleW, t, vp));
    }
  }
}
