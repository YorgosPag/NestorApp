/**
 * ADR-363 Phase 4.5c.5 — Live dimension annotation during column/beam grip drag.
 *
 * Mirrors `useGripGhostPreview` (ADR-049): RAF-based, draws to PreviewCanvas,
 * no React re-renders inside this hook. Clears the annotation on drag end.
 *
 * When a dimensional column grip (width/depth/arm/flange) or beam grip
 * (width/depth) is dragged, a floating "w=350mm" label appears near the grip
 * handle on the preview canvas — Revit/AutoCAD live-dim convention.
 *
 * @module hooks/tools/useGripDimAnnotation
 * @see ADR-363 Phase 4.5c.5
 * @see ADR-040 — Preview Canvas Performance
 */

'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { useLevels } from '../../systems/levels';
import type { DxfGripDragPreview } from '../grip-computation';
import type { ColumnParams } from '../../bim/types/column-types';
import type { BeamParams } from '../../bim/types/beam-types';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { isColumnEntity, isBeamEntity } from '../../types/entities';
import {
  PILL_FONT,
  PILL_TEXT_COLOR,
  PILL_BG_COLOR,
  PILL_PADDING,
  PILL_RADIUS,
  pillPath,
} from '../../rendering/utils/canvas-pill';

// ── Types ────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

export interface UseGripDimAnnotationProps {
  dragPreview: DxfGripDragPreview | null;
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LABEL_OFFSET_X = 12;
const LABEL_OFFSET_Y = -4;

// ── Helpers ──────────────────────────────────────────────────────────────────

function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function worldToScreen(p: Point2D, t: ViewTransform): Point2D {
  return { x: p.x * t.scale + t.offsetX, y: p.y * t.scale + t.offsetY };
}

function drawLabelPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  sx: number,
  sy: number,
): void {
  ctx.save();
  ctx.font = PILL_FONT;
  const metrics = ctx.measureText(text);
  const w = metrics.width + PILL_PADDING * 2;
  const h = 13;
  const x = sx + LABEL_OFFSET_X;
  const y = sy + LABEL_OFFSET_Y - h + PILL_PADDING;
  pillPath(ctx, x, y, w, h, PILL_RADIUS);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.fillStyle = PILL_TEXT_COLOR;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x + PILL_PADDING, y + PILL_PADDING);
  ctx.restore();
}

function buildColumnLabel(
  preview: DxfGripDragPreview,
  originalParams: ColumnParams,
): string | null {
  const { columnGripKind } = preview;
  if (!columnGripKind) return null;
  if (columnGripKind === 'column-center' || columnGripKind === 'column-rotation') return null;

  const p = applyColumnGripDrag(columnGripKind, { originalParams, delta: preview.delta });

  switch (columnGripKind) {
    case 'column-width':
      return `w=${Math.round(p.width)}`;
    case 'column-depth':
      return `d=${Math.round(p.depth)}`;
    case 'column-arm-length':
      return `al=${Math.round(p.lshape?.armLength ?? p.depth / 3)}`;
    case 'column-arm-width':
      return `aw=${Math.round(p.lshape?.armWidth ?? p.width / 3)}`;
    case 'column-flange-length':
      return `fl=${Math.round(p.tshape?.flangeLength ?? p.width)}`;
    case 'column-web-thickness':
      return `wt=${Math.round(p.tshape?.webThickness ?? p.depth / 3)}`;
    case 'column-i-flange-thickness':
      return `tf=${Math.round(p.ishape?.flangeThickness ?? 20)}`;
    case 'column-i-web-thickness':
      return `tw=${Math.round(p.ishape?.webThickness ?? 15)}`;
    default:
      return null;
  }
}

function buildBeamLabel(
  preview: DxfGripDragPreview,
  originalParams: BeamParams,
): string | null {
  const { beamGripKind } = preview;
  if (!beamGripKind) return null;
  if (
    beamGripKind === 'beam-start' ||
    beamGripKind === 'beam-end' ||
    beamGripKind === 'beam-midpoint' ||
    beamGripKind === 'beam-curve'
  ) return null;

  const p = applyBeamGripDrag(beamGripKind, { originalParams, delta: preview.delta });

  switch (beamGripKind) {
    case 'beam-width':
      return `w=${Math.round(p.width)}`;
    case 'beam-depth':
      return `d=${Math.round(p.depth)}`;
    default:
      return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGripDimAnnotation(props: UseGripDimAnnotationProps): void {
  const { dragPreview, levelManager, transform, getCanvas } = props;

  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);

  const isDimPreview =
    dragPreview !== null &&
    (dragPreview.columnGripKind !== undefined || dragPreview.beamGripKind !== undefined);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // NOTE: Do NOT clearCanvas here — GripDragPreviewMount (mounted before this
    // leaf in PreviewCanvasMounts) schedules its RAF first, clears the canvas,
    // then draws the ghost. This RAF runs second, drawing the label on top of
    // the already-cleared canvas. Two clears in the same frame = label wipe.
    if (!dragPreview?.anchorPos) return;

    const { columnGripKind, beamGripKind, anchorPos, delta, entityId } = dragPreview;
    if (!columnGripKind && !beamGripKind) return;

    const lid = levelManager.currentLevelId;
    if (!lid) return;
    const scene = levelManager.getLevelScene(lid);
    const entity = scene?.entities?.find(e => e.id === entityId);
    if (!entity) return;

    const gripWorld: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const { x: sx, y: sy } = worldToScreen(gripWorld, transform);

    let label: string | null = null;
    if (columnGripKind && isColumnEntity(entity)) {
      label = buildColumnLabel(dragPreview, entity.params);
    } else if (beamGripKind && isBeamEntity(entity)) {
      label = buildBeamLabel(dragPreview, entity.params);
    }

    if (label) drawLabelPill(ctx, label, sx, sy);
  }, [dragPreview, levelManager, transform, getCanvas]);

  useEffect(() => {
    if (prevActiveRef.current && !isDimPreview) {
      const canvas = getCanvas();
      if (canvas) clearCanvas(canvas);
    }
    prevActiveRef.current = isDimPreview;
  }, [isDimPreview, getCanvas]);

  useEffect(() => {
    if (!isDimPreview) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDimPreview, drawFrame]);
}
