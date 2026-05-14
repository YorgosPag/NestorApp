/**
 * USE MIRROR PREVIEW — Ghost entity rendering during axis definition
 *
 * Draws mirrored ghost copies of selected entities on the PreviewCanvas.
 * Also draws the mirror axis line while awaiting-second-point.
 *
 * Uses requestAnimationFrame for 60fps — NO React re-renders.
 * Cursor position read via useCursorWorldPosition() (ImmediatePositionStore).
 *
 * @module hooks/tools/useMirrorPreview
 */

import { useCallback, useRef, useEffect } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { AnySceneEntity } from '../../types/entities';
import { mirrorPoint, orthoSnap } from '../../utils/mirror-math';
import type { MirrorAxis } from '../../utils/mirror-math';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { useCadToggles } from '../common/useCadToggles';
import type { MirrorPhase } from './useMirrorTool';
import type { useLevels } from '../../systems/levels';

// ============================================================================
// TYPES
// ============================================================================

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

export interface UseMirrorPreviewProps {
  phase: MirrorPhase;
  firstPoint: Point2D | null;
  secondPoint: Point2D | null;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

const PREVIEW_PHASES: ReadonlySet<MirrorPhase> = new Set(['awaiting-second-point', 'awaiting-keep-originals']);

// ============================================================================
// HOOK
// ============================================================================

export function useMirrorPreview(props: UseMirrorPreviewProps): void {
  const { phase, firstPoint, secondPoint, selectedEntityIds, levelManager, transform, getCanvas, getViewportElement } = props;
  const cursorWorld = useCursorWorldPosition();

  const { ortho } = useCadToggles();
  const orthoOnRef = useRef(ortho.on);
  orthoOnRef.current = ortho.on;
  const shiftHeldRef = useRef(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = true; };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const rafRef = useRef<number>(0);
  const prevPhaseRef = useRef<MirrorPhase>('idle');

  const getEntity = useCallback((entityId: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    return scene.entities.find(e => e.id === entityId) ?? null;
  }, [levelManager]);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rawAxisP2 = phase === 'awaiting-keep-originals' ? secondPoint : cursorWorld;
    const axisP2 = (phase === 'awaiting-second-point' && firstPoint && rawAxisP2 && (orthoOnRef.current || shiftHeldRef.current))
      ? orthoSnap(firstPoint, rawAxisP2)
      : rawAxisP2;
    if (!firstPoint || !axisP2) return;
    if (phase !== 'awaiting-second-point' && phase !== 'awaiting-keep-originals') return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const freshViewport = { width: rect.width, height: rect.height };

    const p1Screen = CoordinateTransforms.worldToScreen(firstPoint, transform, freshViewport);
    const p2Screen = CoordinateTransforms.worldToScreen(axisP2, transform, freshViewport);

    // Mirror axis line
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    // Extend line beyond canvas edges for visual clarity
    const dx = p2Screen.x - p1Screen.x;
    const dy = p2Screen.y - p1Screen.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.01) {
      const extend = Math.max(canvas.width / dpr, canvas.height / dpr);
      const ux = (dx / len) * extend;
      const uy = (dy / len) * extend;
      ctx.moveTo(p1Screen.x - ux, p1Screen.y - uy);
      ctx.lineTo(p1Screen.x + ux, p1Screen.y + uy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // First-point marker
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    const mk = 8;
    ctx.beginPath();
    ctx.moveTo(p1Screen.x - mk, p1Screen.y);
    ctx.lineTo(p1Screen.x + mk, p1Screen.y);
    ctx.moveTo(p1Screen.x, p1Screen.y - mk);
    ctx.lineTo(p1Screen.x, p1Screen.y + mk);
    ctx.stroke();
    ctx.restore();

    // Ghost entities mirrored about firstPoint→cursorWorld axis
    const axis: MirrorAxis = { p1: firstPoint, p2: axisP2 };
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 1.5;

    for (const entityId of selectedEntityIds) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      drawMirroredGhost(ctx, entity as unknown as DxfEntityUnion, axis, transform, freshViewport);
    }

    ctx.restore();
  }, [phase, firstPoint, secondPoint, cursorWorld, selectedEntityIds, getEntity, transform, getCanvas, getViewportElement]);

  // Clear on phase exit
  useEffect(() => {
    const wasActive = PREVIEW_PHASES.has(prevPhaseRef.current);
    const isNowActive = PREVIEW_PHASES.has(phase);

    if (wasActive && !isNowActive) {
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

  // Schedule RAF during active phase
  useEffect(() => {
    if (!PREVIEW_PHASES.has(phase)) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, drawFrame]);
}

// ============================================================================
// GHOST ENTITY DRAWING
// ============================================================================

function drawMirroredGhost(
  ctx: CanvasRenderingContext2D,
  entity: DxfEntityUnion,
  axis: MirrorAxis,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): void {
  const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, transform, viewport);
  const mp = (p: Point2D) => mirrorPoint(p, axis);

  switch (entity.type) {
    case 'line': {
      const s = toScreen(mp(entity.start));
      const e = toScreen(mp(entity.end));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      break;
    }

    case 'circle': {
      const c = toScreen(mp(entity.center));
      const edge = toScreen(mp({ x: entity.center.x + entity.radius, y: entity.center.y }));
      const r = Math.sqrt((c.x - edge.x) ** 2 + (c.y - edge.y) ** 2);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arc': {
      const c = toScreen(mp(entity.center));
      const edgePt = toScreen(mp({ x: entity.center.x + entity.radius, y: entity.center.y }));
      const r = Math.sqrt((c.x - edgePt.x) ** 2 + (c.y - edgePt.y) ** 2);
      // Start/end swap on mirror — handled by mirrorEntity; here draw approximate arc
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'polyline': {
      const pts = entity.vertices.map(v => toScreen(mp(v)));
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      break;
    }

    case 'text': {
      const pos = toScreen(mp(entity.position));
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);
      ctx.restore();
      break;
    }

    default:
      break;
  }
}
