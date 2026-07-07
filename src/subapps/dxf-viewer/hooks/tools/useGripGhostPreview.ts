/**
 * USE GRIP GHOST PREVIEW — Ghost entity rendering during grip drag
 *
 * ADR-049: SSOT for drag-time ghost rendering (paired with useMovePreview).
 * ADR-040: PreviewCanvas overlay, RAF-driven, no React re-renders inside this hook.
 *
 * Renders a semi-transparent blue ghost of the dragged entity on the
 * PreviewCanvas overlay — same visual + same code path as the toolbar
 * Move tool. The dragged entity stays painted normally at its original
 * position in the main canvas (no DxfRenderer.applyDragPreview mutation),
 * so the bitmap cache no longer needs to invalidate during grip drag.
 *
 * The transform itself (translate / vertex stretch / edge stretch / quadrant /
 * arc end) is computed by `rendering/ghost/applyEntityPreview()`.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform ζουν πλέον ΜΙΑ φορά
 * στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * ADR-040 Φ12 — `cursorMode: 'world-position'`: ο harness τρέφει `effectiveCursor`
 * = το ΖΩΝΤΑΝΟ realtime effective-world (ίδιο 60fps SSoT/ρολόι με τον crosshair). Ό,τι
 * οδηγεί ο κέρσορας 1:1 ανα-υπολογίζεται live (byte-identical με το React `dragPreview`):
 * translate/resize (delta) ΚΑΙ cursor-driven περιστροφή (free rotate / 6-click align-end,
 * sweep) → ghost κλειδωμένο στον κέρσορα, μηδέν React-state lag, όπως Revit/AutoCAD.
 * Εξαιρούνται (μένουν React): typed-angle περιστροφή (keyed, ΟΧΙ cursor) + hatch-gradient.
 *
 * @module hooks/tools/useGripGhostPreview
 * @see ADR-040 — Preview Canvas Performance
 * @see ADR-049 — Move tool / grip drag SSoT
 * @see hooks/tools/useMovePreview — sibling preview hook
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity, GroupEntity } from '../../types/entities';
// ADR-575 §8 — expand the transformed GROUP into its member primitives to ghost each.
import { expandGroupEntity } from '../../systems/group/group-expander';
import type { WallEntity } from '../../bim/types/wall-types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { useLevels } from '../../systems/levels';
import type { DxfGripDragPreview } from '../grip-computation';
// ADR-513 §grip-parity — length/angle lock για την ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ γραμμής (ίδιος SSoT preview≡commit).
import { resolveLineEndpointLockedDelta } from '../../systems/dynamic-input/grip-endpoint-lock';
// ADR-357/513 §grip-polar — POLAR angle-snap του άκρου (γραμμή + polyline), κοινό preview+commit SSoT.
import { resolveEndpointReshapePolarLock, type EndpointReshapePolarLock } from '../grips/grip-endpoint-polar-lock';
import {
  applyEntityPreview,
  normalizePreviewEntity,
  drawGhostEntity,
  GHOST_DEFAULTS,
} from '../../rendering/ghost';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
// ADR-397 — the rotation-centre ⊙ marker is the SAME SSoT glyph the toolbar Rotate
// tool draws (useRotationPreview), so both rotation flows look identical.
import { drawRotationPivotMarker } from '../../rendering/ui/rotation-pivot-marker';
// ADR-408 Φ-C — connected pipe ends follow a moving plumbing host (SSoT builder,
// shared with the commit + any future 3D pipe ghost), so the run stretches live.
import { buildConnectedPipeGhosts } from '../../bim/mep-segments/build-connected-pipe-ghosts';
// ADR-408 Φ7 P2 — SSoT snapshot→transform map (shared with HomeRunWiresOverlay).
import { toEntityPreviewTransform } from './grip-drag-preview-transform';
// ADR-363/560 — scene→meters (alignment-trace tooltip) + angle formatter (hatch angle readout).
import { sceneDistanceToMeters, formatMoveAngle } from '../../bim/labels/move-readout';
import { resolveSceneUnits } from '../../utils/scene-units';
// ADR-363 — line endpoint RESHAPE readout (length + angle, AutoCAD dynamic input).
import { isLineEntity, isWallEntity } from '../../types/entities';
import type { LineEntity } from '../../types/entities';
// ADR-508/362 — full ISO perpendicular offset dimension (αρχική↔φάντασμα) στη whole-line MOVE της
// κεντρικής λαβής· ΙΔΙΟΣ overlay dim SSoT με το body-drag → μία όψη, μηδέν διπλότυπο. ORTHO-gated.
import { paintLineParallelOffsetDim } from '../../canvas-v2/preview-canvas/line-offset-dim-paint';
// ADR-507 Φ5 A3b — gradient-origin λαβή που ακολουθεί LIVE τον κέρσορα στο preview canvas
// (το main-canvas grip κρύβεται όσο σέρνεται· βλ. HatchRenderer.getGrips).
import { isHatchOriginGripKind, isHatchAngleGripKind } from '../../bim/hatch/hatch-grips';
// ADR-507 Φ5 A4 — ίδια οπτική ένδειξη με την περιστροφή κολώνας (ADR-357/398): πορτοκαλί
// polar-tracking ray στη γωνία + tooltip τιμής. Κεντρικό SSoT — μηδέν bespoke style.
import { paintPolarTrackingLine } from '../../canvas-v2/preview-canvas/polar-tracking-line-paint';
// ADR-397 / ADR-357 — POLAR + AutoAlign ίχνη κατά την περιστροφή (ΙΔΙΑ SSoT με τη σχεδίαση).
import { resolveRotationTracking, paintRotationTracking, type RotationTracking } from './rotation-tracking-overlay';
import { paintDirectionArc } from '../../canvas-v2/preview-canvas/direction-arc-paint';
// ADR-397 §15b — SECOND direction arc: the LIVE corner angle between the rotating wall
// and the neighbour it is joined to (same 🟢/🔴 SSoT paint as the rotation arc).
import { resolveNeighborAxisAngle } from '../../bim/walls/wall-rotation-neighbor-angle';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// ADR-090 — SSoT point+vector add (translate), replaces inline `{x:A.x+B.x,y:A.y+B.y}`.
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
// File-size SRP split — pure draw helpers (dashed leaders / readout arc / gradient
// marker / ADR-543 co-move partner ghosts) live in a sibling module.
import {
  drawDashedSegment,
  drawComovePartnerGhosts,
  drawStructuralFinishSkinPreview,
  drawMemberBodyGhostWithJoinMiter,
  isStructuralFinishMember,
  drawColumnAspectWallWarning,
  drawMemberGripHud,
  paintGripEndpointReshapeArcs,
} from './grip-ghost-preview-draw-helpers';
// ADR-040 Φ12 — SSoT grip delta resolvers (shared with buildDxfDragPreview/commit), so
// the live synchronous ghost derives translate + rotation identically from the effective-world.
import { resolveGripTranslateDelta, resolveLiveRotationFromCursor } from '../grips/grip-projections';
// ADR-508 §grip-tracking (Giorgio 2026-07-06) — ενεργό footprint grip-kind σε reshape λαβές
// (κορυφή/μεσαία) πολυγωνικής BIM οντότητας — χρησιμοποιείται στο POLAR lock του άκρου.
import { resolveActiveFootprintGripKind } from '../../systems/grip/footprint-reshape-anchors';
// ADR-508/507/560 — grip-drag tail overlays (action-alignment traces + move-clearance dims + hatch
// gradient handle marker) σε δικό τους module (file-size SRP N.7.1). Gates/SSoT ζουν μέσα στους helpers.
import {
  paintGripActionAlignmentTraces,
  paintGripMoveClearanceDims,
  drawHatchGradientHandleMarker,
} from './grip-ghost-preview-overlay-helpers';

// ── Types ────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

export interface UseGripGhostPreviewProps {
  /** Live drag-preview snapshot from useUnifiedGripInteraction (null when idle). */
  dragPreview: DxfGripDragPreview | null;
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGripGhostPreview(props: UseGripGhostPreviewProps): void {
  const { dragPreview, levelManager, transform, getCanvas, getViewportElement } = props;

  const isActive = dragPreview !== null;

  const getEntity = useCallback(
    (entityId: string): AnySceneEntity | null => {
      if (!levelManager.currentLevelId) return null;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene?.entities) return null;
      return scene.entities.find(e => e.id === entityId) ?? null;
    },
    [levelManager],
  );

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const getLayersById = useLevelLayersById(levelManager);

  // ADR-040 Φ12 — cursorMode 'world-position': the harness feeds `effectiveCursor`
  // = the LIVE realtime effective-world (same SSoT + same 60fps clock as the
  // compositor crosshair). We recompute the per-frame geometry from it synchronously
  // so the ghost is locked to the cursor with zero React-state lag — byte-identical to
  // the React `dragPreview` (the SSoT == the `moveWorldPos` that fed it), just live.
  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!dragPreview) return;

    // Live recompute of whatever the cursor drives 1:1:
    //  · CURSOR-DRIVEN ROTATION (free rotate / 6-click align-end) → recompute the sweep
    //    (delta + angle readout) from the cursor — Revit/AutoCAD rotate tracks 1:1.
    //  · TRANSLATE / parametric RESIZE → recompute the move delta from the cursor.
    // Excluded (kept on the React `dragPreview`): TYPED-angle rotation (keyed value, NOT
    // cursor-driven) and HATCH-gradient drags (bespoke origin/angle marker geometry).
    const isHatchDrag = !!dragPreview.hatchGripKind;
    const isRotation = !!(dragPreview.rotatePivot || dragPreview.rotateRefLine || dragPreview.rotateAlignLine);
    let dp = dragPreview;
    // ADR-397 / ADR-357 — POLAR + AutoAlign ίχνη κατά την περιστροφή (parity με σχεδίαση). Resolve
    // ΠΡΙΝ το sweep ώστε ο polar/alignment-locked cursor να τροφοδοτήσει την περιστροφή → η πορτοκαλί/
    // λευκή γραμμή να συμπίπτει με τον περιστρεφόμενο τοίχο. Μόνο στο cursor-driven free / align-end rotate.
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
            effectiveCursor,
            dragPreview.movesEntity === true || dragPreview.hotGrip === true,
          ),
        };
      }
    }

    const rawEntity = getEntity(dp.entityId);
    if (!rawEntity) return;
    // ADR-186/561 — a joined-lines result is a scene `'lwpolyline'`; getEntity returns the RAW
    // scene entity but the whole ghost pipeline (applyEntityPreview + model builder) is keyed on
    // `'polyline'`. Normalize the discriminator so the ghost + alignment traces + direction arc
    // all fire exactly as they do for a standard polyline (Giorgio 2026-07-05 «να εμφανίζονται
    // πάντοτε τα φαντάσματα»). Shape is identical, so every downstream read is unaffected.
    const entity = normalizePreviewEntity(rawEntity as unknown as DxfEntityUnion) as unknown as typeof rawEntity;
    if (!entity) return;

    // ADR-513 §grip-parity — length/angle lock στο ghost της ΕΠΕΚΤΑΣΗΣ ΑΚΡΟΥ γραμμής (grip 0/1). Ο
    // ΙΔΙΟΣ helper τρέχει και στο commit (grip-mouseup) → preview ≡ commit. No-op όταν δεν υπάρχει lock.
    let endpointPolar: EndpointReshapePolarLock | null = null;
    if (!isRotation && !isHatchDrag && dp.anchorPos && effectiveCursor) {
      const lockedDelta = resolveLineEndpointLockedDelta(
        entity, dp.gripIndex, dp.lineGripKind, dp.anchorPos, effectiveCursor,
      );
      if (lockedDelta) {
        dp = { ...dp, delta: lockedDelta };
      } else {
        // ADR-357/513 §grip-polar — POLAR angle-snap του ΑΚΡΟΥ (γραμμή grip 0/1 ή ανοιχτό polyline
        // endpoint) γύρω από τον ΣΤΑΘΕΡΟ γείτονα, ΙΔΙΟ SSoT με τη σχεδίαση (`resolveOrthoPolarStep`).
        // Ο ίδιος resolver τρέχει στο commit (grip-mouseup) → preview ≡ commit. No-op όταν POLAR off,
        // ORTHO on, δεν είναι άκρο, ή ο κέρσορας δεν κούμπωσε σε polar ακτίνα.
        endpointPolar = resolveEndpointReshapePolarLock(
          entity, dp.gripIndex, dp.lineGripKind, dp.anchorPos, effectiveCursor,
          // ADR-508 §grip-tracking — καθολικό POLAR σε reshape λαβές πολυγωνικών BIM (κολόνα/πλάκα/…).
          resolveActiveFootprintGripKind(dp),
        );
        if (endpointPolar) dp = { ...dp, delta: endpointPolar.delta };
      }
    }

    const vp = viewport;

    // ADR-397 — the picked rotation CENTRE (⊙). Shown for every rotate step once the
    // centre is set, so the user sees the pivot is locked (Giorgio). Same SSoT glyph
    // as the toolbar Rotate tool.
    if (dp.rotatePivot) {
      drawRotationPivotMarker(ctx, dp.rotatePivot, t, vp);
    }

    // ADR-397 §15 — χρωματισμένο τόξο ΦΟΡΑΣ περιστροφής (🟢 +CCW / 🔴 −CW) + βελάκι + διακεκομμένη
    // baseline 0° + ΧΡΩΜΑΤΙΣΤΗ ζωντανή γωνία (2 δεκαδικά), από τον άξονα αναφοράς (pivot→anchorPos)
    // προς τον κέρσορα (rotateReadoutAnchor). Το πρόσημο/χρώμα οδηγείται από το signed `rotateSweepDeg`
    // (ως προς τον άξονα αναφοράς, όχι world-X). Αντικαθιστά το παλιό λευκό readout pill (Giorgio
    // 2026-07-01: «σβήσε το λευκό label, γράψε τις μοίρες κόκκινες/πράσινες»).
    if (dp.rotatePivot && dp.anchorPos && dp.rotateReadoutAnchor && dp.rotateSweepDeg !== undefined) {
      paintDirectionArc(ctx, dp.rotatePivot, dp.anchorPos, dp.rotateReadoutAnchor, dp.rotateSweepDeg, t, vp);
    }

    // ADR-397 / ADR-357 — πορτοκαλί POLAR γραμμή + λευκές AutoAlign γραμμές/intersection/tooltip κατά
    // την περιστροφή, μέσω των ΙΔΙΩΝ SSoT paints με τη σχεδίαση. toMm = scene-units → mm (ίδια μονάδα
    // με το drawing tooltip). Wiped αυτόματα στο επόμενο frame (RAF clear), όπως τα υπόλοιπα overlays.
    if (rotationTracking && dp.rotatePivot) {
      const rotScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      const rotUnits = resolveSceneUnits(rotScene);
      paintRotationTracking(
        ctx, dp.rotatePivot, rotationTracking.cursor, rotationTracking,
        t, vp, (d) => sceneDistanceToMeters(d, rotUnits) * 1000,
      );
    }

    // ADR-408 Φ7 P2 — snapshot→transform map is now the shared SSoT helper, so the
    // ghost and the live home-run wire derive the SAME previewed entity.
    const preview = toEntityPreviewTransform(dp);

    // ADR-363 Φ1G.5 Slice 2 — for a hosted-opening Alt-move ghost, supply the
    // level's walls so the preview can slide / re-host the opening and recompute
    // its full door symbol (swing arc + leaf) against the resolved host wall.
    let previewCtx: { walls: readonly WallEntity[] } | undefined;
    if (entity.type === 'opening' && levelManager.currentLevelId) {
      const sceneEntities = levelManager.getLevelScene(levelManager.currentLevelId)?.entities ?? [];
      previewCtx = { walls: sceneEntities.filter((e) => e.type === 'wall') as unknown as readonly WallEntity[] };
    }

    const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview, previewCtx);

    // ── ADR-575 §8 — GROUP gizmo live ghost (whole-group move / rotate) ──────────
    // `applyEntityPreview` returns a transformed `type:'group'` CONTAINER (every member
    // moved by the SAME `calculateMovedGeometry`/`rotateEntity` case 'group' the commit
    // runs). The single-entity path below cannot draw a group, so expand + ghost each
    // member (Revit/C4D «όλη η ομάδα κινείται»). Pivot ⊙ + angle arc already drawn above;
    // early-return skips the BIM member-body/alignment/HUD overlays (group-agnostic).
    if ((transformed as { type?: string }).type === 'group') {
      if (transformed !== entity) {
        ctx.save();
        ctx.globalAlpha = GHOST_DEFAULTS.alpha;
        ctx.strokeStyle = GHOST_DEFAULTS.color;
        ctx.fillStyle = GHOST_DEFAULTS.color;
        for (const member of expandGroupEntity(transformed as unknown as GroupEntity)) {
          drawGhostEntity(ctx, member as unknown as DxfEntityUnion, t, vp);
        }
        ctx.restore();
      }
      return;
    }

    // ADR-397 §15b — SECOND direction arc while ROTATING a wall JOINED to a neighbour:
    // the LIVE corner angle between the two walls' axes (Giorgio, στιγμιότυπο 153825).
    // Same green/red SSoT paint as the rotation arc (#1 above), but the reference edge is
    // the NEIGHBOUR axis (fixed) instead of the wall's original orientation → the value is
    // the actual corner the two walls form right now. Radius = 35% of the live wall length
    // so the arc is proportional & distinct from #1. No-op when the wall is free (no joined
    // neighbour) or not rotating. Reuses the SSoT `JOIN_THRESHOLD_MM` neighbour detection.
    if (isRotation && dp.rotatePivot && (transformed as { type?: string }).type === 'wall') {
      const liveWall = transformed as unknown as WallEntity;
      const cornerScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      const cornerWalls = (cornerScene?.entities ?? []).filter(isWallEntity);
      const wallLen = Math.hypot(
        liveWall.params.end.x - liveWall.params.start.x,
        liveWall.params.end.y - liveWall.params.start.y,
      );
      const cornerArc = resolveNeighborAxisAngle(
        liveWall, cornerWalls, resolveSceneUnits(cornerScene), 0.35 * wallLen, dp.rotatePivot,
      );
      if (cornerArc) {
        paintDirectionArc(ctx, cornerArc.pivotW, cornerArc.anchorW, cornerArc.cursorW, cornerArc.sweepDeg, t, vp);
      }
    }

    // ADR-363 Phase 1G.3 — rotate-reference (6-click) guide segments. Drawn for
    // the reference + alignment lines regardless of ghost delta (they exist even
    // while the wall is not yet rotating, e.g. tracing the reference line).
    if (dp.rotateRefLine || dp.rotateAlignLine) {
      if (dp.rotateRefLine) {
        drawDashedSegment(ctx, dp.rotateRefLine.from, dp.rotateRefLine.to, t, vp);
      }
      if (dp.rotateAlignLine) {
        drawDashedSegment(ctx, dp.rotateAlignLine.from, dp.rotateAlignLine.to, t, vp);
      }
    } else if (
      // ADR-363 Phase 1G — dashed rubber-band leader to the cursor (corner/move
      // hot-grip). Drawn BEFORE the ghost short-circuit so it shows even when the
      // params clamp to an identical entity reference (e.g. thickness floor). The
      // start is the move/corner anchor; the end is the cursor (anchorPos + delta).
      dp.hotGrip &&
      dp.anchorPos &&
      (dp.delta.x !== 0 || dp.delta.y !== 0)
    ) {
      const fromW = dp.rotatePivot ?? dp.anchorPos;
      const toW = translatePoint(dp.anchorPos, dp.delta);
      drawDashedSegment(ctx, fromW, toW, t, vp);
    }

    // ADR-357/363/560/508 §grip-tracking — action-alignment traces RESOLVED-IN-DRAW. Anchors +
    // OSNAP-priority + paint ζουν στο overlay helper (file-size SRP N.7.1): whole-entity translate →
    // base point· line/polyline endpoint reshape → fixed neighbour anchors· ΚΑΘΕ πολυγωνική BIM
    // reshape λαβή → σταθερές footprint κορυφές. Display-only (δεν αλλάζει το `dp.delta`).
    {
      const trkScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      paintGripActionAlignmentTraces(
        ctx, dp, entity as unknown as Entity, effectiveCursor,
        (trkScene?.entities ?? null) as unknown as readonly Entity[] | null,
        resolveSceneUnits(trkScene), t, vp,
      );
    }

    // ADR-357/513 §grip-polar — πορτοκαλί polar ray + γωνία από τον ΣΤΑΘΕΡΟ γείτονα προς το κλειδωμένο
    // άκρο (ΙΔΙΟ `paintPolarTrackingLine` SSoT με σχεδίαση/περιστροφή/κολώνα — μηδέν νέο paint). Γραμμή
    // + ενωμένο σύστημα (polyline) parity: μόλις το άκρο κουμπώσει σε 0°/45°/90°… φαίνεται η ένδειξη.
    if (endpointPolar && dp.anchorPos && endpointPolar.polar.snappedAngle !== null) {
      const lockedPt = translatePoint(dp.anchorPos, endpointPolar.delta);
      paintPolarTrackingLine(
        ctx, endpointPolar.fixed, endpointPolar.polar.snappedAngle,
        formatMoveAngle(endpointPolar.polar.snappedAngle), lockedPt, t, vp,
      );
    }

    // Κάθετη διάσταση αρχικής↔φαντάσματος για whole-line MOVE μέσω κεντρικής λαβής (πλήρης ISO dim,
    // ORTHO-gated εσωτερικά). `dp.delta` = η ήδη ORTHO+F9/Q constrained μετάθεση → preview≡commit.
    if (dp.movesEntity === true && !dp.rotatePivot && isLineEntity(entity as unknown as Entity)) {
      const offScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      paintLineParallelOffsetDim(ctx, entity as unknown as LineEntity, dp.delta, t, vp, resolveSceneUnits(offScene));
    }

    // ADR-357/397/561 — endpoint RESHAPE direction arc for a plain line OR an OPEN polyline's
    // true endpoint: the SAME centralized 🟢/🔴 `paintDirectionArc` + live signed angle the wall
    // rotation uses (SSoT helper). Excludes move/hot-grip/rotation (handled above) and interior
    // polyline vertices (two neighbours → no single pivot). The guide line is the ghost itself.
    paintGripEndpointReshapeArcs(
      ctx, dp, entity as unknown as Entity, transformed as unknown as Entity, t, vp,
    );

    // ADR-507 Φ5 A3b/A4 — gradient-origin/angle drag: η λαβή ακολουθεί τον κέρσορα.
    // Σχεδιάζεται ΑΝΕΞΑΡΤΗΤΑ από το delta (ακόμα & στο mousedown πριν την κίνηση) ώστε να
    // μη «εξαφανίζεται» — το committed grip κρύβεται από το main canvas στο active drag.
    const isHatchOriginDrag =
      !!dp.hatchGripKind && isHatchOriginGripKind(dp.hatchGripKind) && entity.type === 'hatch';
    const isHatchAngleDrag =
      !!dp.hatchGripKind && isHatchAngleGripKind(dp.hatchGripKind) && entity.type === 'hatch';

    // applyEntityPreview returns the *same* reference for zero-delta or unsupported
    // types → skip the ghost overlay (avoids a redundant paint). The hatch-origin
    // marker below still draws (it must follow even on a zero-delta press).
    if (transformed !== entity) {
      ctx.save();
      // ADR-550 (WYSIWYG preview) — the MOVING copy renders through the REAL entity renderer
      // (full fidelity: wall thickness+fill+poché+material hatch, column footprint+fill, …) so
      // the preview matches the committed form, not a silhouette. The original-position copy is
      // the dimmed ghost (main canvas, via `gripDraggedEntityId`). Layer table drives ByLayer style.
      const bimPreview = getBimPreview(ctx);
      const layersById = getLayersById();
      // ADR-363 §wall-joint-miter-preview / ADR-449 — draw the moving member body ghost with its
      // LIVE wall join-miter (neighbours mitered underneath, ghost on top), re-forming the future
      // corner exactly as it will close on commit. Columns/beams have no join → drawn as-is. The
      // returned ghost + neighbours feed the finish-skin silhouette below. SHARED SSoT helper with
      // the body-drag MOVE path (`useEntityBodyDragPreview`) so the two gestures cannot diverge.
      const joinScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      const { ghost: wallGhostToDraw, neighbours: finishPreviewNeighbours } = drawMemberBodyGhostWithJoinMiter(
        bimPreview, transformed, joinScene?.entities ?? [], resolveSceneUnits(joinScene), layersById, t, vp,
      );
      // ADR-449 — LIVE σοβάς: after the member body ghost, re-draw the merged finish-skin
      // silhouette for the preview scene (dragged wall/column/beam + mitered neighbours at
      // their new positions) via the SAME committed scene-pass. No-op when «Σοβατισμένη όψη»
      // is off (internal per-element gate). Mirrors the committed order (plaster after body).
      if (joinScene && isStructuralFinishMember((transformed as { type?: string }).type)) {
        drawStructuralFinishSkinPreview(
          ctx, joinScene.entities, wallGhostToDraw, finishPreviewNeighbours, t, vp,
        );
      }

      // ADR-049 (inverted ghost) — followers below (connected pipes / co-move partners) are
      // NOT the selected dragged entity, so their originals stay SOLID on the main canvas.
      // Keep them translucent ghosts to avoid a confusing solid-on-solid double image.
      ctx.globalAlpha = GHOST_DEFAULTS.alpha;
      ctx.strokeStyle = GHOST_DEFAULTS.color;
      ctx.fillStyle = GHOST_DEFAULTS.color;

      // ADR-408 Φ-C — when the dragged entity is a plumbing connector host, draw the
      // connected pipe ends following it so the run visibly stretches WITH the host
      // during the drag (matches the connectivity-preserving commit). The SSoT builder
      // resolves + recomputes geometry once; returns [] for non-plumbing entities.
      const sceneEntities = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)?.entities ?? []
        : [];
      const pipeGhosts = buildConnectedPipeGhosts(
        sceneEntities as unknown as readonly Entity[],
        entity as unknown as Entity,
        transformed as unknown as Entity,
      );
      for (const ghost of pipeGhosts) {
        drawGhostEntity(ctx, ghost as unknown as DxfEntityUnion, t, vp);
      }

      // ADR-543 — co-move partner line(s) sharing the dragged endpoint follow live.
      drawComovePartnerGhosts(
        ctx,
        entity as unknown as Entity,
        transformed as unknown as Entity,
        (id) => getEntity(id) as unknown as Entity | undefined,
        t, vp,
      );
      // ADR-363 §5.6/§5.6b/§5.6c — LIVE 🟠 warning outline: όσο το grip-drag κρατά ΟΠΟΙΟΝΔΗΠΟΤΕ τύπο
      // κολόνας/τοιχίου εκτός εύρους (επιμήκυνση σαν τοιχίο aspect>4 · ασυνήθιστα extents τοιχίου ·
      // εκφύλιση αναλογίας Γ/Τ/Π/Ι), το περίγραμμα του φαντάσματος γίνεται πορτοκαλί (opaque, πάνω από το
      // body). Ίδιο gate με το dialog-on-release. No-op για μη-crossing/άλλα είδη.
      drawColumnAspectWallWarning(ctx, entity as unknown as Entity, transformed as unknown as Entity, t, vp);
      ctx.restore();
    }

    // ADR-508 §wall-hud/§column-hud — LIVE «λευκές ενδείξεις» τοίχου/κολόνας ΠΑΝΩ από το ghost, στο ΙΔΙΟ
    // frame/RAF (μετά το ghost draw, πριν το επόμενο harness clear) → ΣΤΑΘΕΡΕΣ όσο σέρνεις, χωρίς race με
    // ξεχωριστό leaf. FULL SSoT (ίδιοι painters με τη σχεδίαση) — όλη η λογική στο `drawMemberGripHud`.
    {
      const hudScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      drawMemberGripHud(ctx, dp, transformed, transformed !== entity, resolveSceneUnits(hudScene), t, vp);
    }

    // ADR-508 §move-clearance — κυανές neighbor-clearance listening dims κατά το grip-drag (ΙΔΙΟ SSoT
    // με useMovePreview + useEntityBodyDragPreview). Paint LAST (listening-dim overlay πάνω από το
    // ghost). Όλη η λογική/gates (self-exclude, rotate/hatch skip, zero-delta) στο overlay helper.
    {
      const clScene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      paintGripMoveClearanceDims(
        ctx, dp, transformed as unknown as Entity, entity as unknown as Entity,
        (clScene?.entities ?? []) as unknown as readonly Entity[], resolveSceneUnits(clScene), t, vp,
      );
    }

    // ADR-507 Φ5 A3b/A4 — live gradient handle marker LAST (πάνω από το gradient ghost). Origin →
    // τετράγωνο· angle → βραχίονας + πορτοκαλί polar ray (SSoT overlay helper· gates εσωτερικά).
    drawHatchGradientHandleMarker(
      ctx, isHatchOriginDrag, isHatchAngleDrag,
      transformed as unknown as Entity, entity as unknown as Entity, t, vp,
    );
  }, [dragPreview, getEntity, levelManager, getBimPreview, getLayersById]);

  useCanvasGhostPreview({
    isActive,
    getCanvas,
    getViewportElement,
    transform,
    // ADR-040 Φ12 — world-position: arm the live realtime effective-world stream so the
    // ghost redraws synchronously (same frame as the crosshair) on every cursor move.
    cursorMode: 'world-position',
    draw,
  });
}
