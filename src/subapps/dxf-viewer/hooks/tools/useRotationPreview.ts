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
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform + clear-on-exit ζουν
 * πλέον ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * @module hooks/tools/useRotationPreview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { AnySceneEntity } from '../../types/entities';
import { rotatePoint } from '../../utils/rotation-math';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { drawRotationPivotMarker } from '../../rendering/ui/rotation-pivot-marker';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import type { RotationPhase } from './useRotationTool';
import type { useLevels } from '../../systems/levels';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

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
}

// Phases where the rotation preview consumes the live cursor (SSoT for the
// cursor-subscription gate; harness also uses it for clear-on-exit).
const PREVIEW_PHASES: ReadonlySet<RotationPhase> = new Set(['awaiting-reference', 'awaiting-angle']);

// ============================================================================
// HOOK
// ============================================================================

export function useRotationPreview(props: UseRotationPreviewProps): void {
  const {
    phase, basePoint, referencePoint, currentAngle,
    selectedEntityIds, levelManager,
    transform, getCanvas, getViewportElement,
  } = props;

  /** Read an entity from the current level scene (read-only) */
  const getEntity = useCallback((entityId: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    return scene.entities.find(e => e.id === entityId) ?? null;
  }, [levelManager]);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const isReferencePhase = phase === 'awaiting-reference';
    const isAnglePhase = phase === 'awaiting-angle';
    if ((!isReferencePhase && !isAnglePhase) || !basePoint) return;

    // Convert pivot to screen coords (CSS pixels) — used by rubber band / arc below.
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, t, viewport);

    // === Rotation-centre marker (⊙) — visible in BOTH phases. ===
    drawRotationPivotMarker(ctx, basePoint, t, viewport);

    // === Rubber band line: pivot → cursor — visible in BOTH phases ===
    if (effectiveCursor) {
      const cursorScreen = CoordinateTransforms.worldToScreen(effectiveCursor, t, viewport);

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
      const refScreen = CoordinateTransforms.worldToScreen(referencePoint, t, viewport);
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

    if (effectiveCursor) {
      const cursorScreen = CoordinateTransforms.worldToScreen(effectiveCursor, t, viewport);

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
      ctx.fillText(angleText, cursorScreen.x + 15, cursorScreen.y - 10);
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
        drawGhostEntity(ctx, dxfEntity, basePoint, currentAngle, t, viewport);
      }

      ctx.restore();
    }
  }, [phase, basePoint, referencePoint, currentAngle, selectedEntityIds, getEntity]);

  useCanvasGhostPreview({
    isActive: PREVIEW_PHASES.has(phase),
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
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
