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

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
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
import { paintActionAlignmentTracking, resolveActionAlignmentTracking } from '../dimensions/dim-alignment-tracking';
import { resolveGripAlignmentAnchors, type GripAlignmentRole, type GripAlignmentEntityView } from '../../systems/grip/grip-drag-alignment-role';
import { getFootprintReshapeAlignmentAnchors, resolveActiveFootprintGripKind } from '../../systems/grip/footprint-reshape-anchors';
import { getBimCharacteristicPointsOfCategory } from '../../bim/utils/bim-characteristic-points';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';

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

/**
 * ADR-357/363/560/508 — action-alignment traces RESOLVED-IN-DRAW (mirror useEntityBodyDragPreview):
 * το ΙΔΙΟ pure SSoT resolve τρέχει ΤΟΠΙΚΑ ανά frame πάνω στον `effectiveCursor` → self-contained,
 * ΜΗΔΕΝ timing-skew· idempotent double-resolve → WYSIWYG. Anchors:
 *  · whole-entity translate (Alt-move ΟΠΟΙΑΣΔΗΠΟΤΕ οντότητας ή line move-cross/hot-grip) → base point.
 *  · line ENDPOINT reshape → line SSoT anchors (fixed endpoint· rotation→null).
 *  · polyline VERTEX reshape → fixed neighbour vertices (polyline SSoT).
 *  · ADR-508 §grip-tracking — ΚΑΘΕ πολυγωνική BIM οντότητα (κολόνα/πλάκα/…) σε reshape ΚΟΡΥΦΗΣ/ΜΕΣΑΙΑΣ
 *    λαβής → οι ΣΤΑΘΕΡΕΣ κορυφές του footprint (ordered corner SSoT).
 * OSNAP-priority: όσο κουμπώνει χαρακτηριστικό σημείο, το OSNAP marker αναλαμβάνει — καμία κυανή.
 * ΚΑΜΙΑ πινακίδα. Non-line non-move grip → null → no-op. Display-only (δεν αλλάζει το `dp.delta`).
 */
export function paintGripActionAlignmentTraces(
  ctx: CanvasRenderingContext2D,
  dp: DxfGripDragPreview,
  entity: Entity,
  effectiveCursor: Point2D | null,
  sceneEntities: readonly Entity[] | null,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: Viewport,
): void {
  if (!effectiveCursor) return;
  // ADR-537/561/508 — line/polyline anchor selection (base-point move · line endpoint · polyline
  // vertex reshape · straight edge-slide «λαβές των μέσων», arc-apex excluded) lives in the SHARED
  // 2D↔3D SSoT `resolveGripAlignmentAnchors`. This helper is now a thin adapter: `dp`→role. The BIM
  // footprint branch (not reachable in raw-DXF 3D) stays here as the fallback.
  const role: GripAlignmentRole = {
    movesEntity: dp.movesEntity === true,
    isRotation: dp.rotatePivot != null,
    gripIndex: dp.gripIndex,
    anchorPos: dp.anchorPos ?? null,
    edgeVertexIndices: dp.edgeVertexIndices,
    lineGripKind: dp.lineGripKind,
  };
  let alignAnchors: Point2D[] | null =
    resolveGripAlignmentAnchors(entity as unknown as GripAlignmentEntityView, role);
  if (!alignAnchors) {
    const footprintKind = resolveActiveFootprintGripKind(dp);
    if (footprintKind) {
      const corners = getBimCharacteristicPointsOfCategory(entity, 'corner');
      const anchors = getFootprintReshapeAlignmentAnchors(corners, footprintKind);
      alignAnchors = anchors.length ? anchors : null;
    }
  }
  // [MLDIAG] TEMP — ADR-557 multiline cyan investigation (Giorgio 2026-07-07). Remove after diagnosis.
  if (entity.type === 'text' || entity.type === 'mtext') {
    const g = globalThis as unknown as { __ml?: number };
    g.__ml = (g.__ml ?? 0) + 1;
    if (g.__ml % 12 === 0) {
      const trk = alignAnchors
        ? resolveActionAlignmentTracking(effectiveCursor, alignAnchors, t.scale, sceneEntities, new Set([dp.entityId]))
        : null;
      // eslint-disable-next-line no-console
      console.log('[MLDIAG]', JSON.stringify({
        type: entity.type, moves: dp.movesEntity === true, anchor: dp.anchorPos, cursor: effectiveCursor,
        anchors: alignAnchors, snapFound: getImmediateSnap()?.found ?? false,
        sceneN: sceneEntities?.length ?? 0, trk: trk ? 'HIT' : 'null',
      }));
    }
  }
  if (!alignAnchors || getImmediateSnap()?.found) return;
  const actionTracking = resolveActionAlignmentTracking(
    // ADR-557 — exclude the dragged entity from the ambient scan: a moving multi-line text must NOT
    // lock onto its OWN insertion point (which sits far below the box-centre anchor) — that phantom
    // self-anchor was drowning out the neighbour cyan traces (Giorgio browser-verify 2026-07-07).
    effectiveCursor, alignAnchors, t.scale, sceneEntities, new Set([dp.entityId]),
  );
  if (actionTracking) {
    paintActionAlignmentTracking(ctx, actionTracking, t, vp, sceneUnits);
  }
}
