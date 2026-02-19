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
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
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
  /** Callback returning the canvas element to draw on (PreviewCanvas) */
  getCanvas: () => HTMLCanvasElement | null;
  /** Callback returning the DxfCanvas element — used for viewport calculation
   *  to ensure worldToScreen uses the SAME dimensions as the click handler.
   *  Falls back to getCanvas() if not provided. */
  getViewportElement?: () => HTMLElement | null;
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
    transform, getCanvas, getViewportElement,
    cursorWorld,
  } = props;

  const rafRef = useRef<number>(0);
  /** Track previous phase to clear canvas ONLY on transition out of awaiting-angle */
  const prevPhaseRef = useRef<RotationPhase>('idle');

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

    // 🏢 FIX (2026-02-20): Explicit ctx transform — guarantees DPR scaling regardless of
    // prior state. Same pattern as PreviewRenderer.render() (lines 322-325).
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Nothing to draw if not in angle-picking phase
    if (phase !== 'awaiting-angle' || !basePoint) return;

    // 🏢 FIX (2026-02-20): Viewport from the DxfCanvas element (= same element used in
    // click handler's getPointerSnapshotFromElement). This eliminates any viewport mismatch
    // between the click path and the preview rendering path.
    // Fallback to PreviewCanvas dimensions if DxfCanvas ref not available.
    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const freshViewport = { width: rect.width, height: rect.height };

    // Draw in CSS pixel coordinates — DPR scaling handled by ctx.setTransform above.
    // Same pattern as PreviewRenderer.renderLine().

    // Convert pivot to screen coords (CSS pixels)
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, transform, freshViewport);

    // === 1. Draw rubber band line: pivot → cursor ===
    if (cursorWorld) {
      const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, freshViewport);

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

      // === 2. Draw angle arc near pivot ===
      const arcRadius = 30;
      const startRad = 0; // Reference angle (east)
      const endRad = degToRad(currentAngle);

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // In screen coords, Y is inverted → negate angle for correct visual
      ctx.arc(
        pivotScreen.x,
        pivotScreen.y,
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
      ctx.font = '12px monospace';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(
        angleText,
        cursorScreen.x + 15,
        cursorScreen.y - 10
      );
      ctx.restore();
    }

    // === 4. Draw base point marker (crosshair) ===
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

    // === 5. Draw ghost entities (semi-transparent rotated copies) ===
    if (Math.abs(currentAngle) > 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 1.5;

      for (const entityId of selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;

        const dxfEntity = entity as unknown as DxfEntityUnion;
        drawGhostEntity(ctx, dxfEntity, basePoint, currentAngle, transform, freshViewport);
      }

      ctx.restore();
    }
  }, [phase, basePoint, currentAngle, selectedEntityIds, getEntity, transform, getCanvas, getViewportElement, cursorWorld]);

  // Clear canvas ONLY when transitioning FROM awaiting-angle → idle/base-point
  // (never on every render — that would wipe the drawing tool preview)
  useEffect(() => {
    if (prevPhaseRef.current === 'awaiting-angle' && phase !== 'awaiting-angle') {
      const canvas = getCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 🏢 Same explicit transform pattern as drawFrame
          const clearDpr = window.devicePixelRatio || 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(clearDpr, 0, 0, clearDpr, 0, 0);
        }
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, getCanvas]);

  // Schedule rendering on every relevant change (only when active)
  useEffect(() => {
    if (phase !== 'awaiting-angle') return;

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, drawFrame]);
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
): void {
  // 🏢 FIX (2026-02-19): Draw in CSS pixels — DPR scaling handled by canvas transform
  const toScreen = (p: Point2D) =>
    CoordinateTransforms.worldToScreen(p, transform, viewport);

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
      const radiusScreen = entity.radius * transform.scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radiusScreen, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'arc': {
      const c = toScreen(rotatePoint(entity.center, pivot, angleDeg));
      const radiusScreen = entity.radius * transform.scale;
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
      const fontSize = Math.max(8, entity.height * transform.scale);
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
