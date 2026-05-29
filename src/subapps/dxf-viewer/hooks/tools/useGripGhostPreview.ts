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
import type { AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { useLevels } from '../../systems/levels';
import type { DxfGripDragPreview } from '../grip-computation';
import {
  applyEntityPreview,
  drawGhostEntity,
  GHOST_DEFAULTS,
  type EntityPreviewTransform,
} from '../../rendering/ghost';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

// ── Constants ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G — dash pattern for the corner hot-grip rubber-band leader. */
const HOT_GRIP_RUBBER_BAND_DASH: readonly number[] = [6, 4];

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

    const preview: EntityPreviewTransform = {
      entityId: dragPreview.entityId,
      gripIndex: dragPreview.gripIndex,
      delta: dragPreview.delta,
      movesEntity: dragPreview.movesEntity,
      edgeVertexIndices: dragPreview.edgeVertexIndices,
      // ADR-358 Phase 5d — stair parametric ghost discriminator pass-through.
      ...(dragPreview.stairGripKind       ? { stairGripKind:       dragPreview.stairGripKind }       : {}),
      // ADR-363 Phase 1C — wall parametric ghost discriminator pass-through.
      ...(dragPreview.wallGripKind        ? { wallGripKind:        dragPreview.wallGripKind }         : {}),
      // ADR-363 Phase 5.5 / 3.5 / 3.7a — beam / slab / slab-opening parametric ghost.
      ...(dragPreview.beamGripKind        ? { beamGripKind:        dragPreview.beamGripKind }         : {}),
      // ADR-397 — column parametric ghost (move/rotation/resize) pass-through.
      ...(dragPreview.columnGripKind      ? { columnGripKind:      dragPreview.columnGripKind }       : {}),
      ...(dragPreview.slabGripKind        ? { slabGripKind:        dragPreview.slabGripKind }         : {}),
      ...(dragPreview.slabOpeningGripKind ? { slabOpeningGripKind: dragPreview.slabOpeningGripKind }  : {}),
      ...(dragPreview.anchorPos           ? { anchorPos:           dragPreview.anchorPos }            : {}),
      // ADR-363 Phase 1G — rotation centre for the wall-rotation hot-grip ghost.
      ...(dragPreview.rotatePivot         ? { rotatePivot:         dragPreview.rotatePivot }          : {}),
    };

    const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview);

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

    // applyEntityPreview returns the *same* reference for zero-delta or
    // unsupported types → skip drawing (avoids a redundant overlay).
    if (transformed === entity) return;

    ctx.save();
    ctx.globalAlpha = GHOST_DEFAULTS.alpha;
    ctx.strokeStyle = GHOST_DEFAULTS.color;
    ctx.fillStyle = GHOST_DEFAULTS.color;
    ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
    drawGhostEntity(ctx, transformed, transform, vp);
    ctx.restore();
  }, [dragPreview, getEntity, transform, getCanvas, getViewportElement]);

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
