/**
 * 🏢 ENTERPRISE: Guide Entity-Picking Click Handlers
 *
 * @description Handles guide tools that require picking DXF entities from the scene:
 * - guide-arc-segments, guide-arc-distance (arc/circle entity picking)
 * - guide-arc-line-intersect (line then arc picking)
 * - guide-circle-intersect (two arc/circle picking)
 * - guide-line-midpoint, guide-circle-center (entity geometry extraction)
 * - guide-from-entity, guide-offset-entity (entity → guide creation)
 *
 * EXTRACTED FROM: guide-click-handlers.ts — SRP split (ADR N.7.1)
 *
 * @see ADR-189: Construction Guide System
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import {
  isLineEntity, isPolylineEntity, isLWPolylineEntity,
  isArcEntity, isCircleEntity,
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { dlog } from '../../debug';

import type { ArcPickableEntity, UseCanvasClickHandlerParams } from './canvas-click-types';
import type { GuideClickContext } from './guide-click-handlers';

// ============================================================================
// HELPER: Get scene from level manager
// ============================================================================

function getScene(ctx: GuideClickContext): SceneModel | null {
  return ctx.levelManager.currentLevelId
    ? ctx.levelManager.getLevelScene(ctx.levelManager.currentLevelId)
    : null;
}

// ============================================================================
// HELPER: Pick arc/circle entity from scene
// ============================================================================

function pickArcOrCircleEntity(
  worldPoint: Point2D,
  scene: SceneModel,
  hitTolerance: number,
): ArcPickableEntity | null {
  if (!scene.entities) return null;

  for (const entity of scene.entities) {
    if (isArcEntity(entity)) {
      if (pointToArcDistance(worldPoint, entity) <= hitTolerance) {
        return {
          center: entity.center,
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle,
          isFullCircle: false,
        };
      }
    } else if (isCircleEntity(entity)) {
      const dx = worldPoint.x - entity.center.x;
      const dy = worldPoint.y - entity.center.y;
      if (Math.abs(Math.sqrt(dx * dx + dy * dy) - entity.radius) <= hitTolerance) {
        return {
          center: entity.center,
          radius: entity.radius,
          startAngle: 0,
          endAngle: 360,
          isFullCircle: true,
        };
      }
    }
  }
  return null;
}

// ============================================================================
// HANDLERS
// ============================================================================

/** guide-arc-segments — 1-click entity pick */
export function handleArcSegments(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  if (!p.onArcSegmentsPicked) return true;
  const scene = getScene(ctx);
  if (scene) {
    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
    const picked = pickArcOrCircleEntity(ctx.worldPoint, scene, hitTolerance);
    if (picked) {
      p.onArcSegmentsPicked(picked);
    }
  }
  return true;
}

/** guide-arc-distance — 1-click entity pick */
export function handleArcDistance(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  if (!p.onArcDistancePicked) return true;
  const scene = getScene(ctx);
  if (scene) {
    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
    const picked = pickArcOrCircleEntity(ctx.worldPoint, scene, hitTolerance);
    if (picked) {
      p.onArcDistancePicked(picked);
    }
  }
  return true;
}

/** guide-arc-line-intersect — 2-click: line then arc */
export function handleArcLineIntersect(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
  const step = p.arcLineStep ?? 0;

  if (step === 0 && p.onArcLineLinePicked) {
    for (const entity of scene.entities) {
      if (isLineEntity(entity)) {
        if (pointToLineDistance(ctx.worldPoint, entity.start, entity.end) <= hitTolerance) {
          p.onArcLineLinePicked({ start: entity.start, end: entity.end });
          return true;
        }
      }
    }
  } else if (step === 1 && p.onArcLineArcPicked) {
    const picked = pickArcOrCircleEntity(ctx.worldPoint, scene, hitTolerance);
    if (picked) {
      p.onArcLineArcPicked(picked);
    }
  }
  return true;
}

/** guide-circle-intersect — 2-click: arc/circle then arc/circle */
export function handleCircleIntersect(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
  const step = p.circleIntersectStep ?? 0;
  const callback = step === 0 ? p.onCircleIntersectFirstPicked : p.onCircleIntersectSecondPicked;
  if (!callback) return true;

  const picked = pickArcOrCircleEntity(ctx.worldPoint, scene, hitTolerance);
  if (picked) {
    callback(picked);
  }
  return true;
}

/** guide-line-midpoint — click on LINE entity */
export function handleLineMidpoint(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  if (!p.onLineMidpointPlace) return true;
  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
  let closestEntity: { start: Point2D; end: Point2D } | null = null;
  let closestDist = hitTolerance;

  for (const entity of scene.entities) {
    if (isLineEntity(entity)) {
      const dist = pointToLineDistance(ctx.worldPoint, entity.start, entity.end);
      if (dist < closestDist) {
        closestDist = dist;
        closestEntity = { start: entity.start, end: entity.end };
      }
    }
  }

  if (closestEntity) {
    const midpoint: Point2D = {
      x: (closestEntity.start.x + closestEntity.end.x) / 2,
      y: (closestEntity.start.y + closestEntity.end.y) / 2,
    };
    p.onLineMidpointPlace(midpoint);
    dlog('guideEntityHandlers', 'Line midpoint placed', midpoint);
  }
  return true;
}

/** guide-circle-center — click on CIRCLE/ARC entity */
export function handleCircleCenter(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  if (!p.onCircleCenterPlace) return true;
  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
  let closestCenter: Point2D | null = null;
  let closestDist = hitTolerance;

  for (const entity of scene.entities) {
    if (isCircleEntity(entity)) {
      const dx = ctx.worldPoint.x - entity.center.x;
      const dy = ctx.worldPoint.y - entity.center.y;
      const distFromCircumference = Math.abs(Math.sqrt(dx * dx + dy * dy) - entity.radius);
      if (distFromCircumference < closestDist) {
        closestDist = distFromCircumference;
        closestCenter = entity.center;
      }
    } else if (isArcEntity(entity)) {
      const dist = pointToArcDistance(ctx.worldPoint, entity);
      if (dist < closestDist) {
        closestDist = dist;
        closestCenter = entity.center;
      }
    }
  }

  if (closestCenter) {
    p.onCircleCenterPlace(closestCenter);
    dlog('guideEntityHandlers', 'Circle/arc center placed', closestCenter);
  }
  return true;
}

/** guide-from-entity — entity picking */
export function handleFromEntity(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  if (!p.onGuideFromEntity) return true;
  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;

  // Iterate backwards (top-most first)
  for (let i = scene.entities.length - 1; i >= 0; i--) {
    const entity = scene.entities[i];

    if (isLineEntity(entity)) {
      const start: Point2D = { x: entity.start.x, y: entity.start.y };
      const end: Point2D = { x: entity.end.x, y: entity.end.y };
      if (pointToLineDistance(ctx.worldPoint, start, end) < hitTolerance) {
        p.onGuideFromEntity('LINE', { lineStart: start, lineEnd: end });
        dlog('guideEntityHandlers', 'B8: Guide from LINE entity');
        return true;
      }
    }

    if (isCircleEntity(entity)) {
      const center: Point2D = { x: entity.center.x, y: entity.center.y };
      const distToCenter = Math.sqrt(
        (ctx.worldPoint.x - center.x) ** 2 + (ctx.worldPoint.y - center.y) ** 2,
      );
      if (Math.abs(distToCenter - entity.radius) < hitTolerance) {
        p.onGuideFromEntity('CIRCLE', { center, radius: entity.radius });
        dlog('guideEntityHandlers', 'B8: Guide from CIRCLE entity');
        return true;
      }
    }

    if (isArcEntity(entity)) {
      const center: Point2D = { x: entity.center.x, y: entity.center.y };
      if (pointToArcDistance(ctx.worldPoint, entity) < hitTolerance) {
        p.onGuideFromEntity('ARC', { center, radius: entity.radius, clickPoint: ctx.worldPoint });
        dlog('guideEntityHandlers', 'B8: Guide from ARC entity');
        return true;
      }
    }

    if ((isPolylineEntity(entity) || isLWPolylineEntity(entity)) && entity.vertices && entity.vertices.length >= 2) {
      for (let j = 0; j < entity.vertices.length - 1; j++) {
        const segStart: Point2D = { x: entity.vertices[j].x, y: entity.vertices[j].y };
        const segEnd: Point2D = { x: entity.vertices[j + 1].x, y: entity.vertices[j + 1].y };
        if (pointToLineDistance(ctx.worldPoint, segStart, segEnd) < hitTolerance) {
          p.onGuideFromEntity('POLYLINE', { lineStart: segStart, lineEnd: segEnd });
          dlog('guideEntityHandlers', 'B8: Guide from POLYLINE segment');
          return true;
        }
      }
    }
  }
  return true;
}

/** guide-offset-entity — entity picking with offset prompt */
export function handleOffsetEntity(
  ctx: GuideClickContext,
  p: UseCanvasClickHandlerParams,
): boolean {
  if (!p.onGuideOffsetFromEntity) return true;
  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = 30 / ctx.transform.scale;

  for (const entity of scene.entities) {
    if (isLineEntity(entity)) {
      const start: Point2D = { x: entity.start.x, y: entity.start.y };
      const end: Point2D = { x: entity.end.x, y: entity.end.y };
      if (pointToLineDistance(ctx.worldPoint, start, end) < hitTolerance) {
        p.onGuideOffsetFromEntity('LINE', { lineStart: start, lineEnd: end });
        dlog('guideEntityHandlers', 'B24: Offset guide from LINE entity');
        return true;
      }
    }

    if (isCircleEntity(entity)) {
      const center: Point2D = { x: entity.center.x, y: entity.center.y };
      const distToCenter = Math.sqrt(
        (ctx.worldPoint.x - center.x) ** 2 + (ctx.worldPoint.y - center.y) ** 2,
      );
      if (Math.abs(distToCenter - entity.radius) < hitTolerance) {
        p.onGuideOffsetFromEntity('CIRCLE', { center, radius: entity.radius });
        dlog('guideEntityHandlers', 'B24: Offset guide from CIRCLE entity');
        return true;
      }
    }
  }
  return true;
}
