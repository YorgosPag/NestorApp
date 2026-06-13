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
 * @module hooks/tools/useGripGhostPreview
 * @see ADR-040 — Preview Canvas Performance
 * @see ADR-049 — Move tool / grip drag SSoT
 * @see hooks/tools/useMovePreview — sibling preview hook
 */

import { useCallback, useRef, useEffect } from 'react';
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
// ADR-408 Φ7 P2 — SSoT snapshot→transform map (shared with HomeRunWiresOverlay).
import { toEntityPreviewTransform } from './grip-drag-preview-transform';
// ADR-363 — live move-distance readout pill at the grip-drag / Alt-drag leader midpoint
// (SSoT shared with useMovePreview + the 3D overlay).
import { drawDimPill } from '../../bim/labels/bim-dim-labels';
import { formatMoveDistance, moveReadoutMid, sceneDistanceToMeters } from '../../bim/labels/move-readout';
import { resolveSceneUnits } from '../../utils/scene-units';

// ── Constants ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G — dash pattern for the corner hot-grip rubber-band leader. */
const HOT_GRIP_RUBBER_BAND_DASH: readonly number[] = [6, 4];

/**
 * ADR-363 — discreet neutral colour for the live move-distance readout leader (Revit-grade).
 * Semi-transparent WHITE so it stays subtle yet visible on the pure-black AutoCAD canvas
 * (`CANVAS_BACKGROUND #000`) — a black leader would be invisible.
 */
const MOVE_READOUT_LEADER_COLOR = 'rgba(255,255,255,0.5)';

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

function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

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

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGripGhostPreview(props: UseGripGhostPreviewProps): void {
  const { dragPreview, levelManager, transform, getCanvas, getViewportElement } = props;

  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);

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

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearCanvas(canvas);

    if (!dragPreview) return;

    const entity = getEntity(dragPreview.entityId);
    if (!entity) return;

    const viewportEl = getViewportElement?.() ?? canvas;
    const rect = viewportEl.getBoundingClientRect();
    const vp = { width: rect.width, height: rect.height };

    // ADR-397 — the picked rotation CENTRE (⊙). Shown for every rotate step once the
    // centre is set, so the user sees the pivot is locked (Giorgio). Same SSoT glyph
    // as the toolbar Rotate tool.
    if (dragPreview.rotatePivot) {
      drawRotationPivotMarker(ctx, dragPreview.rotatePivot, transform, vp);
    }

    // ADR-408 Φ7 P2 — snapshot→transform map is now the shared SSoT helper, so the
    // ghost and the live home-run wire derive the SAME previewed entity.
    const preview = toEntityPreviewTransform(dragPreview);

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
    if (dragPreview.rotateRefLine || dragPreview.rotateAlignLine) {
      if (dragPreview.rotateRefLine) {
        drawDashedSegment(ctx, dragPreview.rotateRefLine.from, dragPreview.rotateRefLine.to, transform, vp);
      }
      if (dragPreview.rotateAlignLine) {
        drawDashedSegment(ctx, dragPreview.rotateAlignLine.from, dragPreview.rotateAlignLine.to, transform, vp);
      }
    } else if (
      // ADR-363 Phase 1G — dashed rubber-band leader to the cursor (corner/move
      // hot-grip). Drawn BEFORE the ghost short-circuit so it shows even when the
      // params clamp to an identical entity reference (e.g. thickness floor). The
      // start is the move/corner anchor; the end is the cursor (anchorPos + delta).
      dragPreview.hotGrip &&
      dragPreview.anchorPos &&
      (dragPreview.delta.x !== 0 || dragPreview.delta.y !== 0)
    ) {
      const fromW = dragPreview.rotatePivot ?? dragPreview.anchorPos;
      const toW = { x: dragPreview.anchorPos.x + dragPreview.delta.x, y: dragPreview.anchorPos.y + dragPreview.delta.y };
      drawDashedSegment(ctx, fromW, toW, transform, vp);
    }

    // ADR-363 — live move-distance readout for ANY whole-entity TRANSLATE: a plain
    // center/midpoint move grip (e.g. a line), an Alt move-from-point, or a corner "move"
    // hot-grip. Draws a discreet base→current leader (skipped when the hot-grip already drew
    // its own) + a distance pill at the midpoint. Rotation flows (rotatePivot set) excluded.
    const isTranslate =
      (dragPreview.movesEntity === true || dragPreview.hotGrip === true) && !dragPreview.rotatePivot;
    if (isTranslate && dragPreview.anchorPos && (dragPreview.delta.x !== 0 || dragPreview.delta.y !== 0)) {
      const fromS = CoordinateTransforms.worldToScreen(dragPreview.anchorPos, transform, vp);
      const toS = CoordinateTransforms.worldToScreen(
        { x: dragPreview.anchorPos.x + dragPreview.delta.x, y: dragPreview.anchorPos.y + dragPreview.delta.y },
        transform, vp,
      );
      if (!dragPreview.hotGrip) drawMoveReadoutLeader(ctx, fromS, toS);
      const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
      const meters = sceneDistanceToMeters(Math.hypot(dragPreview.delta.x, dragPreview.delta.y), resolveSceneUnits(scene));
      const mid = moveReadoutMid(fromS, toS);
      drawDimPill(ctx, [formatMoveDistance(meters)], mid.x, mid.y);
    }

    // applyEntityPreview returns the *same* reference for zero-delta or
    // unsupported types → skip drawing (avoids a redundant overlay).
    if (transformed === entity) return;

    ctx.save();
    ctx.globalAlpha = GHOST_DEFAULTS.alpha;
    ctx.strokeStyle = GHOST_DEFAULTS.color;
    ctx.fillStyle = GHOST_DEFAULTS.color;
    ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
    drawGhostEntity(ctx, transformed, transform, vp);

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
      drawGhostEntity(ctx, ghost as unknown as DxfEntityUnion, transform, vp);
    }
    ctx.restore();
  }, [dragPreview, getEntity, transform, getCanvas, getViewportElement, levelManager]);

  // Clear canvas when drag finishes (idle → active transition is handled by RAF)
  useEffect(() => {
    if (prevActiveRef.current && !isActive) {
      const canvas = getCanvas();
      if (canvas) clearCanvas(canvas);
    }
    prevActiveRef.current = isActive;
  }, [isActive, getCanvas]);

  // Schedule RAF on every drag-preview change
  useEffect(() => {
    if (!isActive) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, drawFrame]);
}
