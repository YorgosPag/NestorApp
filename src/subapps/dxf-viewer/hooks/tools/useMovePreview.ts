/**
 * USE MOVE PREVIEW — Ghost entity rendering during 2-click move operation
 *
 * ADR-049: Unified Move Tool (DXF + Overlays)
 * ADR-040: Preview Canvas Performance (imperative API, RAF, no React re-renders)
 *
 * Renders semi-transparent translated copies of selected entities on the
 * PreviewCanvas overlay. Also draws:
 *   - Base point crosshair marker (red)
 *   - Rubber band line: base point → cursor (dashed gold)
 *   - Displacement tooltip near cursor showing Δx, Δy
 *
 * Ghost rendering itself is delegated to `rendering/ghost` (SSOT) — the same
 * primitives used by `useGripGhostPreview` so the two preview paths cannot
 * visually diverge.
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
import type { Overlay } from '../../overlays/types';
import {
  applyEntityPreview,
  drawGhostEntity,
  makeTranslationPreview,
  GHOST_DEFAULTS,
} from '../../rendering/ghost';

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
  selectedOverlayIds?: string[];
  getOverlay?: (id: string) => Overlay | null;
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

const PREVIEW_PHASES: ReadonlySet<MovePhase> = new Set([
  'awaiting-base-point',
  'awaiting-destination',
]);

// ============================================================================
// HOOK
// ============================================================================

export function useMovePreview(props: UseMovePreviewProps): void {
  const {
    phase,
    basePoint,
    selectedEntityIds,
    selectedOverlayIds,
    getOverlay,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
  } = props;

  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);
  const prevPhaseRef = useRef<MovePhase>('idle');

  // O(1) entity lookup — map rebuilt only when entities array ref changes (not every RAF frame)
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const entityArrayRef = useRef<AnySceneEntity[] | undefined>(undefined);

  const getEntity = useCallback(
    (entityId: string): AnySceneEntity | null => {
      if (!levelManager.currentLevelId) return null;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene?.entities) return null;
      if (scene.entities !== entityArrayRef.current) {
        entityArrayRef.current = scene.entities;
        entityMapRef.current = new Map(scene.entities.map(e => [e.id, e]));
      }
      return entityMapRef.current.get(entityId) ?? null;
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

    if (!PREVIEW_PHASES.has(phase)) return;
    if (!basePoint) return;

    const viewportEl = getViewportElement?.() ?? canvas;
    const rect = viewportEl.getBoundingClientRect();
    const vp = { width: rect.width, height: rect.height };
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, transform, vp);

    // Base point crosshair (red)
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

    // Rubber band (dashed gold)
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

    // Ghost + tooltip only during awaiting-destination
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

    // Ghost entities — SSOT via rendering/ghost
    if (Math.abs(delta.x) > 0.001 || Math.abs(delta.y) > 0.001) {
      ctx.save();
      ctx.globalAlpha = GHOST_DEFAULTS.alpha;
      ctx.strokeStyle = GHOST_DEFAULTS.color;
      ctx.fillStyle = GHOST_DEFAULTS.color;
      ctx.lineWidth = GHOST_DEFAULTS.lineWidth;

      for (const entityId of selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        const preview = makeTranslationPreview(entityId, delta);
        const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview);
        drawGhostEntity(ctx, transformed, transform, vp);
      }

      ctx.restore();

      // Ghost overlays (stroke-only outline)
      if (selectedOverlayIds && selectedOverlayIds.length > 0 && getOverlay) {
        ctx.save();
        ctx.globalAlpha = GHOST_DEFAULTS.alpha;
        ctx.strokeStyle = GHOST_DEFAULTS.color;
        ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
        for (const ovId of selectedOverlayIds) {
          const ov = getOverlay(ovId);
          if (!ov || ov.polygon.length < 2) continue;
          const pts = ov.polygon.map(([x, y]) =>
            CoordinateTransforms.worldToScreen({ x: x + delta.x, y: y + delta.y }, transform, vp)
          );
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }, [phase, basePoint, cursorWorld, selectedEntityIds, selectedOverlayIds, getOverlay, getEntity, transform, getCanvas, getViewportElement]);

  // Clear canvas when leaving preview phase
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
    if (!PREVIEW_PHASES.has(phase)) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, drawFrame]);
}
