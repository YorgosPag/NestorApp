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
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { DxfGripDragPreview } from '../grip-computation';
import type { SceneUnits } from '../../utils/scene-units';
import { gripKindOf } from '../grip-kinds';
// ADR-397 §15b — SECOND direction-arc SSoT (live corner angle vs a joined neighbour).
import { resolveNeighborAxisAngle } from '../../bim/walls/wall-rotation-neighbor-angle';
import { paintDirectionArc } from '../../canvas-v2/preview-canvas/direction-arc-paint';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
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
// ADR-557 — whole-entity move paints resolve #1's PUBLISHED tracking (same store useDimGripGhostPreview
// paints for dims) instead of a divergent local re-resolve on the post-OSNAP-override cursor.
import { getGripAlignmentTracking } from '../../systems/cursor/GripAlignmentTrackingStore';
// ADR-508 §length-angle-hud-global — ΙΔΙΟΣ live HUD μήκους/γωνίας με τη σχεδίαση γραμμής/τοίχου.
import { paintWallHud, buildSegmentHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { isLengthAngleHudVisible } from '../../systems/constraints/length-angle-hud-gate';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

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
  if (transformed === entity || dp.rotatePivot || gripKindOf(dp, 'hatch')) return;
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
    lineGripKind: gripKindOf(dp, 'line'),
    // ADR-627 — hatch boundary vertex grip → its ring+index feed the polyline adjacency SSoT.
    hatchGripKind: gripKindOf(dp, 'hatch'),
  };
  // ── ADR-557 — WHOLE-ENTITY MOVE: paint resolve #1's PUBLISHED store, NOT a local re-resolve ──
  // The snap pass (`applyGripDragAlignmentTracking`, mouse-handler-move) already resolved the ambient
  // alignment on the PRE-override cursor and published it (HIT for an MTEXT). Re-resolving HERE on the
  // POST-OSNAP-override `effectiveCursor` DIVERGED — an MTEXT's cursor is pulled off the ambient by
  // neighbour extension snaps, so the local pass saw `null`/suppressed while the snap pass saw HIT (the
  // «διπλότυπο» two-resolve smell). Painting the ONE published store removes the divergence — exactly
  // what `useDimGripGhostPreview` already does for dims. mouse-handler-move clears the store when a
  // DISCRETE OSNAP wins, so OSNAP priority still holds (null store → no cyan on those frames).
  if (role.movesEntity && !role.isRotation && role.anchorPos) {
    const published = getGripAlignmentTracking();
    if (published) paintActionAlignmentTracking(ctx, published, t, vp, sceneUnits);
    return;
  }
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
  // OSNAP priority — a DISCRETE characteristic-point snap (endpoint/midpoint/center/intersection)
  // takes over the cyan (the marker shows the exact target). Construction-line snaps (extension /
  // perpendicular / parallel) are filtered UPSTREAM in `resolveGripDragSnap` (they no longer set
  // `getImmediateSnap().found`), so an MTEXT no longer has its neighbour cyan drowned by an
  // everywhere-present extension ray (ADR-557, Giorgio browser-verify 2026-07-07).
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

/**
 * ADR-508 §length-angle-hud-global — Η ΛΕΥΚΗ ΕΝΔΕΙΞΗ ΜΗΚΟΥΣ + ΓΩΝΙΑΣ κατά τη ΜΕΤΑΚΙΝΗΣΗ ΛΑΒΗΣ.
 *
 * Giorgio 2026-07-18 (στιγμιότυπο 210337): «όταν λέω ένδειξη απόστασης εννοώ ΑΥΤΕΣ τις λευκές
 * ενδείξεις που εμφανίζονται όταν δημιουργώ μια γραμμή — ΔΕΝ θέλω πινακίδα». Δηλαδή ακριβώς το
 * ΥΠΑΡΧΟΝ live HUD της σχεδίασης (aligned διάσταση μήκους + `∠ γωνία`), όχι η `drawDimPill` που το
 * ADR-560 κατάργησε ρητά από όλες τις ροές μετακίνησης. Καμία ανατροπή του ADR-560 — άλλη ένδειξη.
 *
 * Ίδιος painter (`paintWallHud` → `paintWallHudCore`) και ίδιο SSoT gate (`isLengthAngleHudVisible`,
 * status-bar «ΜΗΚΟΣ/ΓΩΝΙΑ») με τη σχεδίαση γραμμής/τοίχου → μηδέν νέος painter, μηδέν νέο toggle. Το
 * ίδιο το gate module ορίζει ρητά ως πεδίο εφαρμογής «κατά τη ΣΧΕΔΙΑΣΗ **και κατά το GRIP-DRAG**»,
 * οπότε αυτό κλείνει ένα τεκμηριωμένο κενό, δεν επεκτείνει σκοπό.
 *
 * Το τμήμα που διαστασιολογείται είναι ΤΟ ΛΑΣΤΙΧΟ: σημείο βάσης (`anchorPos`) → τρέχουσα θέση λαβής
 * (`anchorPos + delta`). Άρα η ένδειξη δείχνει πάντα την ΠΡΑΓΜΑΤΙΚΗ μετατόπιση — ήδη ORTHO/βήμα
 * constrained και ήδη typed-value locked (το `dp.delta` έχει περάσει από τη σκάλα κλειδωμάτων), οπότε
 * το νούμερο ταυτίζεται με ό,τι θα γίνει commit (WYSIWYG).
 *
 * `specLabel` κενό: η μετατόπιση δεν έχει BIM ταυτότητα (πάχος/ύψος) — μόνο μήκος + γωνία, όπως η γραμμή.
 * No-op: εκτός armed hot-grip, χωρίς άγκυρα, σε μηδενικό delta (τίποτα να μετρηθεί), ή σε ΠΕΡΙΣΤΡΟΦΗ
 * (εκεί η ρητή ένδειξη είναι το χρωματιστό τόξο φοράς με τις μοίρες — διαφορετική σημασιολογία).
 */
export function paintGripArmedDistanceHud(
  ctx: CanvasRenderingContext2D,
  dp: DxfGripDragPreview,
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: Viewport,
): void {
  if (!dp.hotGrip || !dp.anchorPos || dp.rotatePivot) return;
  if (dp.delta.x === 0 && dp.delta.y === 0) return;
  if (!isLengthAngleHudVisible()) return;
  const end = translatePoint(dp.anchorPos, dp.delta);
  paintWallHud(ctx, buildSegmentHudMeta(dp.anchorPos, end, sceneUnits), '', t, vp);
}

/**
 * ADR-397 §15b — SECOND direction arc while ROTATING a wall JOINED to a neighbour:
 * the LIVE corner angle between the two walls' axes (Giorgio, στιγμιότυπο 153825).
 * Same green/red SSoT paint as the rotation arc, but the reference edge is the
 * NEIGHBOUR axis (fixed) instead of the wall's original orientation → the value is
 * the actual corner the two walls form right now. Radius = 35% of the live wall length
 * so the arc is proportional & distinct from the primary arc. No-op when the wall is
 * free (no joined neighbour) or not rotating. Reuses the SSoT `JOIN_THRESHOLD_MM`
 * neighbour detection. Gate «ΤΟΞΟ ΦΟΡΑΣ» (Giorgio 2026-07-09): κρύβεται OFF.
 */
export function paintWallJoinCornerArc(
  ctx: CanvasRenderingContext2D,
  isRotation: boolean,
  dp: DxfGripDragPreview,
  transformed: Entity,
  sceneEntities: readonly Entity[],
  sceneUnits: SceneUnits,
  t: ViewTransform,
  vp: Viewport,
): void {
  if (!isRotation || !dp.rotatePivot || !cadToggleState.isDirArcOn()) return;
  if ((transformed as { type?: string }).type !== 'wall') return;
  const liveWall = transformed as unknown as WallEntity;
  const cornerWalls = sceneEntities.filter(isWallEntity);
  const wallLen = Math.hypot(
    liveWall.params.end.x - liveWall.params.start.x,
    liveWall.params.end.y - liveWall.params.start.y,
  );
  const cornerArc = resolveNeighborAxisAngle(
    liveWall, cornerWalls, sceneUnits, 0.35 * wallLen, dp.rotatePivot,
  );
  if (cornerArc) {
    paintDirectionArc(ctx, cornerArc.pivotW, cornerArc.anchorW, cornerArc.cursorW, cornerArc.sweepDeg, t, vp);
  }
}
