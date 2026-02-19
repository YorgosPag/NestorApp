/**
 * USE ROTATION PREVIEW — Ghost entity rendering during rotation
 *
 * 🏢 ADR-188: Entity Rotation System — Visual Feedback
 *
 * Renders semi-transparent rotated copies of selected entities on a dedicated
 * canvas overlay. Also draws:
 * - Rubber band line: pivot → cursor
 * - Angle arc indicator near pivot
 * - Angle tooltip near cursor
 *
 * Uses requestAnimationFrame for 60fps smooth preview — NO React re-renders.
 *
 * @module hooks/tools/useRotationPreview
 */

import { useCallback, useRef, useEffect } from 'react';
import type { Point2D, Viewport, ViewTransform } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { AnySceneEntity } from '../../types/entities';
import { rotatePoint } from '../../utils/rotation-math';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import type { RotationPhase } from './useRotationTool';
import type { useLevels } from '../../systems/levels';

// ============================================================================
// TYPES
// ============================================================================

/** Subset of useLevels return type needed by rotation preview */
type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseRotationPreviewProps {
  phase: RotationPhase;
  basePoint: Point2D | null;
  currentAngle: number;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  viewport: Viewport;
  /** Callback returning the canvas element to draw on */
  getCanvas: () => HTMLCanvasElement | null;
  /** Current cursor world position */
  cursorWorld: Point2D | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRotationPreview(props: UseRotationPreviewProps): void {
  const {
    phase, basePoint, currentAngle,
    selectedEntityIds, levelManager,
    transform, viewport, getCanvas,
    cursorWorld,
  } = props;

  const rafRef = useRef<number>(0);

  /** Read an entity from the current level scene (read-only) */
  const getEntity = useCallback((entityId: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    return scene.entities.find(e => e.id === entityId) ?? null;
  }, [levelManager]);

  /**
   * Draw a single frame of the rotation preview
   */
  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Nothing to draw if not in angle-picking phase
    if (phase !== 'awaiting-angle' || !basePoint) return;

    const dpr = window.devicePixelRatio || 1;

    // Convert pivot to screen coords
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, transform, viewport);

    // === 1. Draw rubber band line: pivot → cursor ===
    if (cursorWorld) {
      const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, viewport);

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(pivotScreen.x * dpr, pivotScreen.y * dpr);
      ctx.lineTo(cursorScreen.x * dpr, cursorScreen.y * dpr);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // === 2. Draw angle arc near pivot ===
      const arcRadius = 30 * dpr;
      const startRad = 0; // Reference angle (east)
      const endRad = degToRad(currentAngle);

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      // In screen coords, Y is inverted → negate angle for correct visual
      ctx.arc(
        pivotScreen.x * dpr,
        pivotScreen.y * dpr,
        arcRadius,
        -startRad,  // Canvas Y-flip
        -endRad,    // Canvas Y-flip
        currentAngle > 0 // CCW positive in world = CW in screen
      );
      ctx.stroke();
      ctx.restore();

      // === 3. Draw angle tooltip near cursor ===
      const angleText = `${currentAngle.toFixed(1)}°`;
      ctx.save();
      ctx.font = `${12 * dpr}px monospace`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(
        angleText,
        cursorScreen.x * dpr + 15 * dpr,
        cursorScreen.y * dpr - 10 * dpr
      );
      ctx.restore();
    }

    // === 4. Draw base point marker (crosshair) ===
    const markerSize = 8 * dpr;
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(pivotScreen.x * dpr - markerSize, pivotScreen.y * dpr);
    ctx.lineTo(pivotScreen.x * dpr + markerSize, pivotScreen.y * dpr);
    ctx.moveTo(pivotScreen.x * dpr, pivotScreen.y * dpr - markerSize);
    ctx.lineTo(pivotScreen.x * dpr, pivotScreen.y * dpr + markerSize);
    ctx.stroke();
    ctx.restore();

    // === 5. Draw ghost entities (semi-transparent rotated copies) ===
    if (Math.abs(currentAngle) > 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 1.5 * dpr;

      for (const entityId of selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;

        const dxfEntity = entity as unknown as DxfEntityUnion;
        drawGhostEntity(ctx, dxfEntity, basePoint, currentAngle, transform, viewport, dpr);
      }

      ctx.restore();
    }
  }, [phase, basePoint, currentAngle, selectedEntityIds, getEntity, transform, viewport, getCanvas, cursorWorld]);

  // Schedule rendering on every relevant change
  useEffect(() => {
    if (phase !== 'awaiting-angle') {
      // Clear canvas when not in angle mode
      const canvas = getCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, drawFrame, getCanvas]);
}

// ============================================================================
// GHOST ENTITY DRAWING (per entity type)
// ============================================================================

function drawGhostEntity(
  ctx: CanvasRenderingContext2D,
  entity: DxfEntityUnion,
  pivot: Point2D,
  angleDeg: number,
  transform: ViewTransform,
  viewport: { width: number; height: number },
  dpr: number
): void {
  const toScreen = (p: Point2D) => {
    const s = CoordinateTransforms.worldToScreen(p, transform, viewport);
    return { x: s.x * dpr, y: s.y * dpr };
  };

  switch (entity.type) {
    case 'line': {
      const s = toScreen(rotatePoint(entity.start, pivot, angleDeg));
      const e = toScreen(rotatePoint(entity.end, pivot, angleDeg));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      break;
    }

    case 'circle': {
      const c = toScreen(rotatePoint(entity.center, pivot, angleDeg));
      const radiusScreen = entity.radius * transform.scale * dpr;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radiusScreen, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arc': {
      const c = toScreen(rotatePoint(entity.center, pivot, angleDeg));
      const radiusScreen = entity.radius * transform.scale * dpr;
      const startRad = degToRad(entity.startAngle + angleDeg);
      const endRad = degToRad(entity.endAngle + angleDeg);
      ctx.beginPath();
      // Canvas Y-flip: negate angles
      ctx.arc(c.x, c.y, radiusScreen, -startRad, -endRad, entity.counterclockwise ?? false);
      ctx.stroke();
      break;
    }

    case 'polyline': {
      if (entity.vertices.length < 2) break;
      ctx.beginPath();
      const first = toScreen(rotatePoint(entity.vertices[0], pivot, angleDeg));
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < entity.vertices.length; i++) {
        const p = toScreen(rotatePoint(entity.vertices[i], pivot, angleDeg));
        ctx.lineTo(p.x, p.y);
      }
      if (entity.closed) {
        ctx.closePath();
      }
      ctx.stroke();
      break;
    }

    case 'text': {
      const pos = toScreen(rotatePoint(entity.position, pivot, angleDeg));
      ctx.save();
      const fontSize = Math.max(8, entity.height * transform.scale * dpr);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = '#00BFFF';
      const totalRotation = (entity.rotation ?? 0) + angleDeg;
      ctx.translate(pos.x, pos.y);
      // Canvas Y-flip
      ctx.rotate(-degToRad(totalRotation));
      ctx.fillText(entity.text, 0, 0);
      ctx.restore();
      break;
    }

    case 'angle-measurement': {
      // Draw rotated arms
      const v = toScreen(rotatePoint(entity.vertex, pivot, angleDeg));
      const p1 = toScreen(rotatePoint(entity.point1, pivot, angleDeg));
      const p2 = toScreen(rotatePoint(entity.point2, pivot, angleDeg));
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(v.x, v.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      break;
    }
  }
}
