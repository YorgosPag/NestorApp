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
  /** Reference direction point (from awaiting-reference phase) */
  referencePoint: Point2D | null;
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
    phase, basePoint, referencePoint, currentAngle,
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

    // Only draw during reference or angle phases
    const isReferencePhase = phase === 'awaiting-reference';
    const isAnglePhase = phase === 'awaiting-angle';
    if ((!isReferencePhase && !isAnglePhase) || !basePoint) return;

    // 🏢 FIX (2026-02-20): Viewport from the DxfCanvas element (= same element used in
    // click handler's getPointerSnapshotFromElement). This eliminates any viewport mismatch
    // between the click path and the preview rendering path.
    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const freshViewport = { width: rect.width, height: rect.height };

    // Convert pivot to screen coords (CSS pixels)
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, transform, freshViewport);

    // === Base point marker (crosshair) — visible in BOTH phases ===
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

    // === Rubber band line: pivot → cursor — visible in BOTH phases ===
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
    }

    // === Reference phase: only base marker + rubber band (drawn above) ===
    if (isReferencePhase) return;

    // === Angle phase: reference line + angle arc + tooltip + ghost entities ===

    // Draw reference direction line (dimmed) from pivot to reference point
    if (referencePoint) {
      const refScreen = CoordinateTransforms.worldToScreen(referencePoint, transform, freshViewport);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pivotScreen.x, pivotScreen.y);
      ctx.lineTo(refScreen.x, refScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (cursorWorld) {
      const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, freshViewport);

      // Angle arc near pivot (from reference direction to cursor direction)
      const arcRadius = 30;
      const refAngleRad = referencePoint
        ? Math.atan2(-(referencePoint.y - basePoint.y), referencePoint.x - basePoint.x)
        : 0;
      const endRad = refAngleRad - degToRad(currentAngle);

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(
        pivotScreen.x,
        pivotScreen.y,
        arcRadius,
        refAngleRad,
        endRad,
        currentAngle > 0
      );
      ctx.stroke();
      ctx.restore();

      // Angle tooltip near cursor
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

    // Ghost entities (semi-transparent rotated copies)
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
  }, [phase, basePoint, referencePoint, currentAngle, selectedEntityIds, getEntity, transform, getCanvas, getViewportElement, cursorWorld]);

  // Clear canvas when transitioning from active preview phase → idle/base-point
  const PREVIEW_PHASES: ReadonlySet<RotationPhase> = new Set(['awaiting-reference', 'awaiting-angle']);
  useEffect(() => {
    const wasPreviewActive = PREVIEW_PHASES.has(prevPhaseRef.current);
    const isPreviewActive = PREVIEW_PHASES.has(phase);

    if (wasPreviewActive && !isPreviewActive) {
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

  // Schedule rendering during both reference and angle phases
  useEffect(() => {
    if (phase !== 'awaiting-reference' && phase !== 'awaiting-angle') return;

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
