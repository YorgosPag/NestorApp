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
import type { ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { useLevels } from '../../systems/levels';
import type { DxfGripDragPreview } from '../grip-computation';
import {
  applyEntityPreview,
  drawGhostEntity,
  GHOST_DEFAULTS,
} from '../../rendering/ghost';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ADR-397 — the rotation-centre ⊙ marker is the SAME SSoT glyph the toolbar Rotate
// tool draws (useRotationPreview), so both rotation flows look identical.
import { drawRotationPivotMarker } from '../../rendering/ui/rotation-pivot-marker';
// ADR-408 Φ-C — connected pipe ends follow a moving plumbing host (SSoT builder,
// shared with the commit + any future 3D pipe ghost), so the run stretches live.
import { buildConnectedPipeGhosts } from '../../bim/mep-segments/build-connected-pipe-ghosts';
// ADR-543 — coincident-endpoint co-move: the partner line(s) sharing the dragged endpoint
// follow live during the drag (SSoT pure builder, shared with the commit + 3D ghost).
import { buildCoincidentPartnerGhostEntities } from '../../systems/stretch/coincident-endpoint-comove';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
// ADR-408 Φ7 P2 — SSoT snapshot→transform map (shared with HomeRunWiresOverlay).
import { toEntityPreviewTransform } from './grip-drag-preview-transform';
// ADR-363 — live move-distance readout pill at the grip-drag / Alt-drag leader midpoint
// (SSoT shared with useMovePreview + the 3D overlay).
import { drawDimPill } from '../../bim/labels/bim-dim-labels';
import { formatMoveDistance, moveReadoutMid, sceneDistanceToMeters, formatMoveAngle } from '../../bim/labels/move-readout';
import { resolveSceneUnits } from '../../utils/scene-units';
// ADR-363 — line endpoint RESHAPE readout (length + angle, AutoCAD dynamic input).
import { isLineEntity } from '../../types/entities';
import type { HatchEntity } from '../../types/entities';
// ADR-507 Φ5 A3b — gradient-origin λαβή που ακολουθεί LIVE τον κέρσορα στο preview canvas
// (το main-canvas grip κρύβεται όσο σέρνεται· βλ. HatchRenderer.getGrips).
import {
  isHatchOriginGripKind, isHatchAngleGripKind, hatchBoundsCenter, hatchGradientAngleGripPos,
} from '../../bim/hatch/hatch-grips';
// ADR-507 Φ5 A4 — ίδια οπτική ένδειξη με την περιστροφή κολώνας (ADR-357/398): πορτοκαλί
// polar-tracking ray στη γωνία + tooltip τιμής. Κεντρικό SSoT — μηδέν bespoke style.
import { paintPolarTrackingLine } from '../../canvas-v2/preview-canvas/polar-tracking-line-paint';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// ADR-040 Φ12 — SSoT grip delta resolvers (shared with buildDxfDragPreview/commit), so
// the live synchronous ghost derives translate + rotation identically from the effective-world.
import { resolveGripTranslateDelta, resolveLiveRotationFromCursor } from '../grips/grip-projections';

// ── Constants ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G — dash pattern for the corner hot-grip rubber-band leader. */
const HOT_GRIP_RUBBER_BAND_DASH: readonly number[] = [6, 4];

/**
 * ADR-363 — discreet neutral colour for the live move-distance readout leader (Revit-grade).
 * Semi-transparent WHITE so it stays subtle yet visible on the pure-black AutoCAD canvas
 * (`CANVAS_BACKGROUND #000`) — a black leader would be invisible.
 */
const MOVE_READOUT_LEADER_COLOR = 'rgba(255,255,255,0.5)';

/** ADR-397 Σ3 — screen offset of the free-rotate angle readout pill from the cursor. */
const ROTATE_READOUT_OFFSET_PX = 18;

/** ADR-363 — angular-dimension arc (endpoint reshape readout): screen radius + neutral colour. */
const ANGLE_ARC_RADIUS_PX = 22;
const ANGLE_ARC_LABEL_GAP_PX = 12;
const ANGLE_ARC_COLOR = 'rgba(255,255,255,0.7)';

/** ADR-507 Φ5 A3b — half-size (CSS px) του live gradient-origin grip-marker (fixed on-screen). */
const GRADIENT_ORIGIN_MARKER_HALF_PX = 5;

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G.3 — draw one dashed world-space segment on the preview canvas. */
function drawDashedSegment(
  ctx: CanvasRenderingContext2D,
  fromW: { x: number; y: number },
  toW: { x: number; y: number },
  transform: ViewTransform,
  vp: { width: number; height: number },
): void {
  const fromS = CoordinateTransforms.worldToScreen(fromW, transform, vp);
  const toS = CoordinateTransforms.worldToScreen(toW, transform, vp);
  ctx.save();
  ctx.setLineDash([...HOT_GRIP_RUBBER_BAND_DASH]);
  ctx.strokeStyle = GHOST_DEFAULTS.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fromS.x, fromS.y);
  ctx.lineTo(toS.x, toS.y);
  ctx.stroke();
  ctx.restore();
}

/** ADR-363 — draw the discreet neutral base→current leader for the move-distance readout. */
function drawMoveReadoutLeader(
  ctx: CanvasRenderingContext2D,
  fromS: { x: number; y: number },
  toS: { x: number; y: number },
): void {
  ctx.save();
  ctx.setLineDash([...HOT_GRIP_RUBBER_BAND_DASH]);
  ctx.strokeStyle = MOVE_READOUT_LEADER_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fromS.x, fromS.y);
  ctx.lineTo(toS.x, toS.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-363 — AutoCAD-style angular-dimension arc for the endpoint-reshape readout. Draws a
 * short +X baseline tick at the fixed vertex (`centerS`) and an arc to the segment direction
 * (`segAngleRad`, SCREEN space so it hugs the visible segment). Returns the label anchor on
 * the arc bisector so the angle value sits just outside the arc.
 */
function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  centerS: { x: number; y: number },
  segAngleRad: number,
): { x: number; y: number } {
  ctx.save();
  ctx.strokeStyle = ANGLE_ARC_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerS.x, centerS.y);
  ctx.lineTo(centerS.x + ANGLE_ARC_RADIUS_PX, centerS.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerS.x, centerS.y, ANGLE_ARC_RADIUS_PX, 0, segAngleRad, segAngleRad < 0);
  ctx.stroke();
  ctx.restore();
  const bisector = segAngleRad / 2;
  const r = ANGLE_ARC_RADIUS_PX + ANGLE_ARC_LABEL_GAP_PX;
  return { x: centerS.x + r * Math.cos(bisector), y: centerS.y + r * Math.sin(bisector) };
}

/**
 * ADR-507 Φ5 A3b — live gradient-origin grip-marker. Ζωγραφίζει το «τετράγωνο» της λαβής
 * στη ΖΩΝΤΑΝΗ θέση (κέρσορας) στο preview canvas, full-opacity, ώστε να ΑΚΟΛΟΥΘΕΙ ορατά το
 * drag (το committed grip κρύβεται από το main canvas — `HatchRenderer.getGrips`). Ghost-cyan
 * γέμισμα + λευκό περίγραμμα = «η λαβή που σέρνεις», fixed on-screen size σε κάθε zoom.
 */
function drawGradientOriginMarker(ctx: CanvasRenderingContext2D, screenPt: { x: number; y: number }): void {
  const h = GRADIENT_ORIGIN_MARKER_HALF_PX;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = GHOST_DEFAULTS.color;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(screenPt.x - h, screenPt.y - h, h * 2, h * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-543 — articulated joint: when a single line endpoint is reshaped and another selected
 * line shares that endpoint, draw the partner line(s) reshaping by the same delta (live preview
 * matching the co-move commit). The `startMoved === endMoved` guard keeps this to single-endpoint
 * reshapes only (excludes whole-entity move where both ends shift, and zero-delta). Reuses the
 * SSoT `buildCoincidentPartnerGhostEntities` so the preview geometry equals the commit.
 */
function drawComovePartnerGhosts(
  ctx: CanvasRenderingContext2D,
  origEntity: Entity,
  transformed: Entity,
  getEntity: (id: string) => Entity | undefined,
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  if (!isLineEntity(origEntity) || !isLineEntity(transformed)) return;
  const startMoved = transformed.start.x !== origEntity.start.x || transformed.start.y !== origEntity.start.y;
  const endMoved = transformed.end.x !== origEntity.end.x || transformed.end.y !== origEntity.end.y;
  if (startMoved === endMoved) return; // both (whole move) or neither (idle) → not a single-endpoint reshape
  const kind = startMoved ? 'line-start' : 'line-end';
  const origMoved = startMoved ? origEntity.start : origEntity.end;
  const newMoved = startMoved ? transformed.start : transformed.end;
  const selectedEntityIds = SelectedEntitiesStore.getSelectedEntityIds();
  const ghosts = buildCoincidentPartnerGhostEntities({
    draggedEntity: origEntity,
    draggedRefs: [{ entityId: origEntity.id, kind }],
    selectedEntityIds,
    getEntity,
    delta: { x: newMoved.x - origMoved.x, y: newMoved.y - origMoved.y },
  });
  // TEMP ADR-543 diagnostic — remove after the 2D partner-ghost issue is pinned.
  console.warn('[ADR-543 2D]', {
    draggedId: origEntity.id, kind, selectedEntityIds,
    foundInScene: selectedEntityIds.map((id) => ({ id, type: getEntity(id)?.type ?? null })),
    ghosts: ghosts.length,
  });
  for (const ghost of ghosts) {
    drawGhostEntity(ctx, ghost as unknown as DxfEntityUnion, t, vp);
  }
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
    if (effectiveCursor) {
      if (dragPreview.rotateCursorDriven && dragPreview.rotatePivot && dragPreview.anchorPos) {
        dp = { ...dragPreview, ...resolveLiveRotationFromCursor(dragPreview, effectiveCursor) };
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

    const entity = getEntity(dp.entityId);
    if (!entity) return;

    const vp = viewport;

    // ADR-397 — the picked rotation CENTRE (⊙). Shown for every rotate step once the
    // centre is set, so the user sees the pivot is locked (Giorgio). Same SSoT glyph
    // as the toolbar Rotate tool.
    if (dp.rotatePivot) {
      drawRotationPivotMarker(ctx, dp.rotatePivot, t, vp);
    }

    // ADR-397 Σ3 — live angle readout (°) on the cursor during a FREE rotate. Shows the
    // signed sweep (+CCW/−CW), or the typed angle while the user is keying one in, so
    // the rotation is VISIBLE (not blind typing). Same pill SSoT as the move readout.
    if (dp.rotateSweepDeg !== undefined && dp.rotateReadoutAnchor) {
      const anchorS = CoordinateTransforms.worldToScreen(dp.rotateReadoutAnchor, t, vp);
      drawDimPill(ctx, [formatMoveAngle(dp.rotateSweepDeg)], anchorS.x + ROTATE_READOUT_OFFSET_PX, anchorS.y - ROTATE_READOUT_OFFSET_PX);
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
      const toW = { x: dp.anchorPos.x + dp.delta.x, y: dp.anchorPos.y + dp.delta.y };
      drawDashedSegment(ctx, fromW, toW, t, vp);
    }

    // ADR-363 — live move-distance readout for ANY whole-entity TRANSLATE: a plain
    // center/midpoint move grip (e.g. a line), an Alt move-from-point, or a corner "move"
    // hot-grip. Draws a discreet base→current leader (skipped when the hot-grip already drew
    // its own) + a distance pill at the midpoint. Rotation flows (rotatePivot set) excluded.
    const isTranslate =
      (dp.movesEntity === true || dp.hotGrip === true) && !dp.rotatePivot;
    if (isTranslate && dp.anchorPos && (dp.delta.x !== 0 || dp.delta.y !== 0)) {
      const fromS = CoordinateTransforms.worldToScreen(dp.anchorPos, t, vp);
      const toS = CoordinateTransforms.worldToScreen(
        { x: dp.anchorPos.x + dp.delta.x, y: dp.anchorPos.y + dp.delta.y },
        t, vp,
      );
      if (!dp.hotGrip) drawMoveReadoutLeader(ctx, fromS, toS);
      const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      const meters = sceneDistanceToMeters(Math.hypot(dp.delta.x, dp.delta.y), resolveSceneUnits(scene));
      const mid = moveReadoutMid(fromS, toS);
      drawDimPill(ctx, [formatMoveDistance(meters)], mid.x, mid.y);
    }

    // ADR-363 — endpoint RESHAPE readout (AutoCAD/Revit angular-dimension style): stretching a
    // line's endpoint grip shows the resulting segment LENGTH (pill at the midpoint) plus an
    // ANGLE ARC drawn at the fixed vertex with the degree value beside it — the angle is shown
    // graphically, not just numerically. The guide line is the ghost itself. The moved endpoint
    // is the changed one; the fixed end anchors the arc. Excludes move/hot-grip/rotation (above).
    const origLine = entity as unknown as Entity;
    const tLine = transformed as unknown as Entity;
    if (
      !dp.movesEntity && !dp.hotGrip && !dp.rotatePivot &&
      transformed !== entity && isLineEntity(origLine) && isLineEntity(tLine)
    ) {
      const startMoved = tLine.start.x !== origLine.start.x || tLine.start.y !== origLine.start.y;
      const fixedW = startMoved ? tLine.end : tLine.start;
      const movedW = startMoved ? tLine.start : tLine.end;
      const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      const lenMeters = sceneDistanceToMeters(Math.hypot(movedW.x - fixedW.x, movedW.y - fixedW.y), resolveSceneUnits(scene));
      const fixedS = CoordinateTransforms.worldToScreen(fixedW, t, vp);
      const movedS = CoordinateTransforms.worldToScreen(movedW, t, vp);
      // Length pill at the segment midpoint.
      const midS = moveReadoutMid(fixedS, movedS);
      drawDimPill(ctx, [formatMoveDistance(lenMeters)], midS.x, midS.y);
      // Angle arc + value at the fixed vertex (screen-space angle → arc & number always agree).
      const segAngle = Math.atan2(movedS.y - fixedS.y, movedS.x - fixedS.x);
      const angleLabelS = drawAngleArc(ctx, fixedS, segAngle);
      drawDimPill(ctx, [formatMoveAngle((Math.abs(segAngle) * 180) / Math.PI)], angleLabelS.x, angleLabelS.y);
    }

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
      ctx.globalAlpha = GHOST_DEFAULTS.alpha;
      ctx.strokeStyle = GHOST_DEFAULTS.color;
      ctx.fillStyle = GHOST_DEFAULTS.color;
      ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
      drawGhostEntity(ctx, transformed, t, vp);

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
      ctx.restore();
    }

    // ADR-507 Φ5 A3b/A4 — live handle marker LAST (πάνω από το gradient ghost). Ζωντανή θέση
    // από το preview entity (ή το committed σε zero-delta). Origin → τετράγωνο στο κέντρο·
    // angle → δαχτυλίδι-βραχίονας (origin→handle dashed) + τετράγωνο στο άκρο = «περιστροφή».
    if (isHatchOriginDrag || isHatchAngleDrag) {
      const live = (transformed !== entity ? transformed : entity) as unknown as HatchEntity;
      const originW = live.patternOrigin ?? hatchBoundsCenter(live.boundaryPaths ?? []);
      if (originW && isHatchOriginDrag) {
        drawGradientOriginMarker(ctx, CoordinateTransforms.worldToScreen(originW, t, vp));
      } else if (originW && isHatchAngleDrag) {
        const angleDeg = live.gradient?.angleDeg ?? 0;
        const handleW = hatchGradientAngleGripPos(originW, angleDeg, live.boundaryPaths ?? []);
        if (handleW) {
          // ΙΔΙΑ ένδειξη με την περιστροφή κολώνας: πορτοκαλί guide ray στη (snapped) γωνία +
          // tooltip τιμής (formatMoveAngle). Έτσι ο χρήστης ΒΛΕΠΕΙ τη γωνία + το «κούμπωμα» 15°.
          paintPolarTrackingLine(ctx, originW, angleDeg, formatMoveAngle(angleDeg), handleW, t, vp);
          drawGradientOriginMarker(ctx, CoordinateTransforms.worldToScreen(handleW, t, vp));
        }
      }
    }
  }, [dragPreview, getEntity, levelManager]);

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
