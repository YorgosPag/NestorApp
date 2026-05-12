/**
 * USE MOVE PREVIEW — Ghost entity rendering during 2-click move operation
 *
 * ADR-049: Unified Move Tool (DXF + Overlays)
 * ADR-040: Preview Canvas Performance (imperative API, RAF, no React re-renders)
 *
 * Renders semi-transparent translated copies of selected entities on the
 * PreviewCanvas overlay. Also draws:
 * - Base point crosshair marker (red)
 * - Rubber band line: base point → cursor (dashed gold)
 * - Displacement tooltip near cursor showing Δx, Δy
 *
 * Uses requestAnimationFrame for 60fps — NO React re-renders.
 * Cursor position read via useCursorWorldPosition() (ImmediatePositionStore).
 *
 * @module hooks/tools/useMovePreview
 */

import { useCallback, useRef, useEffect } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import type { MovePhase } from './useMoveTool';
import type { useLevels } from '../../systems/levels';

// ============================================================================
// TYPES
// ============================================================================

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

export interface UseMovePreviewProps {
  phase: MovePhase;
  basePoint: Point2D | null;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMovePreview(props: UseMovePreviewProps): void {
  const {
    phase,
    basePoint,
    selectedEntityIds,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
  } = props;

  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);
  const prevPhaseRef = useRef<MovePhase>('idle');

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

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (phase !== 'awaiting-base-point' && phase !== 'awaiting-destination') return;
    if (!basePoint) return;

    const viewportEl = getViewportElement?.() ?? canvas;
    const rect = viewportEl.getBoundingClientRect();
    const vp = { width: rect.width, height: rect.height };
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, transform, vp);

    // Base point crosshair
    const markerSize = 8;
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotScreen.x - markerSize, pivotScreen.y);
    ctx.lineTo(pivotScreen.x + markerSize, pivotScreen.y);
    ctx.moveTo(pivotScreen.x, pivotScreen.y - markerSize);
    ctx.lineTo(pivotScreen.x, pivotScreen.y + markerSize);
    ctx.stroke();
    ctx.restore();

    if (!cursorWorld) return;

    const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, vp);

    // Rubber band line (dashed gold)
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pivotScreen.x, pivotScreen.y);
    ctx.lineTo(cursorScreen.x, cursorScreen.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Only draw ghost + tooltip during awaiting-destination
    if (phase !== 'awaiting-destination') return;

    const delta: Point2D = {
      x: cursorWorld.x - basePoint.x,
      y: cursorWorld.y - basePoint.y,
    };

    // Displacement tooltip
    const tooltipText = `Δ${delta.x.toFixed(1)}, ${delta.y.toFixed(1)}`;
    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(tooltipText, cursorScreen.x + 15, cursorScreen.y - 10);
    ctx.restore();

    // Ghost entities (semi-transparent translated copies)
    if (Math.abs(delta.x) > 0.001 || Math.abs(delta.y) > 0.001) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 1.5;

      for (const entityId of selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        drawTranslatedGhostEntity(ctx, entity as unknown as DxfEntityUnion, delta, transform, vp);
      }

      ctx.restore();
    }
  }, [phase, basePoint, cursorWorld, selectedEntityIds, getEntity, transform, getCanvas, getViewportElement]);

  // Clear canvas when leaving preview phase
  const PREVIEW_PHASES: ReadonlySet<MovePhase> = new Set(['awaiting-base-point', 'awaiting-destination']);
  useEffect(() => {
    const wasPreview = PREVIEW_PHASES.has(prevPhaseRef.current);
    const isPreview = PREVIEW_PHASES.has(phase);
    if (wasPreview && !isPreview) {
      const canvas = getCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const clearDpr = window.devicePixelRatio || 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(clearDpr, 0, 0, clearDpr, 0, 0);
        }
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, getCanvas]);

  // Schedule RAF during preview phases
  useEffect(() => {
    if (phase !== 'awaiting-base-point' && phase !== 'awaiting-destination') return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, drawFrame]);
}

// ============================================================================
// GHOST ENTITY DRAWING (translated by delta)
// ============================================================================

function drawTranslatedGhostEntity(
  ctx: CanvasRenderingContext2D,
  entity: DxfEntityUnion,
  delta: Point2D,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): void {
  const toScreen = (p: Point2D) =>
    CoordinateTransforms.worldToScreen(
      { x: p.x + delta.x, y: p.y + delta.y },
      transform,
      viewport,
    );

  switch (entity.type) {
    case 'line': {
      const s = toScreen(entity.start);
      const e = toScreen(entity.end);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      break;
    }

    case 'circle': {
      const c = toScreen(entity.center);
      const r = entity.radius * transform.scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arc': {
      const c = toScreen(entity.center);
      const r = entity.radius * transform.scale;
      const startRad = (entity.startAngle * Math.PI) / 180;
      const endRad = (entity.endAngle * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, -startRad, -endRad, entity.counterclockwise ?? false);
      ctx.stroke();
      break;
    }

    case 'polyline': {
      if (entity.vertices.length < 2) break;
      ctx.beginPath();
      const first = toScreen(entity.vertices[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < entity.vertices.length; i++) {
        const p = toScreen(entity.vertices[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (entity.closed) ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'text':
    case 'mtext': {
      // Cast wide to support both imported entities (.text flat string) and
      // TEXT-tool-created entities (.textNode rich AST, no flat .text).
      const e = entity as DxfEntityUnion & {
        textNode?: { paragraphs?: Array<{ runs?: Array<{ text?: string }> }> };
      };
      if (!e.position) break;
      const pos = toScreen(e.position);
      const flatText = e.text
        ?? e.textNode?.paragraphs
             ?.flatMap(p => p.runs ?? [])
             .map(r => r.text ?? '')
             .join('')
        ?? '';
      if (!flatText) break;
      ctx.save();
      const height = (e as { height?: number }).height ?? 12;
      const fontSize = Math.max(8, height * transform.scale);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = '#00BFFF';
      ctx.fillText(flatText, pos.x, pos.y);
      ctx.restore();
      break;
    }

    case 'angle-measurement': {
      const v = toScreen(entity.vertex);
      const p1 = toScreen(entity.point1);
      const p2 = toScreen(entity.point2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(v.x, v.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      break;
    }

    default:
      break;
  }
}
