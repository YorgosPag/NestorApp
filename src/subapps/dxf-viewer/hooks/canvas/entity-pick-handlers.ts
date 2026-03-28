/**
 * 🏢 ENTERPRISE: Entity Pick Click Handlers
 *
 * @description Handles entity-picking clicks for measurement/drawing tools:
 * - PRIORITY 1.9: Angle entity measurement picking
 * - PRIORITY 2: Circle TTT entity picking
 * - PRIORITY 3: Line Perpendicular entity picking
 * - PRIORITY 4: Line Parallel entity picking
 *
 * EXTRACTED FROM: useCanvasClickHandler.ts — SRP split (ADR N.7.1)
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-147: Centralized Hit Tolerance
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import { isLineEntity, isPolylineEntity, isArcEntity } from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { dlog } from '../../debug';

import type {
  AngleEntityToolLike,
  SpecialToolLike,
  LevelManagerLike,
} from './canvas-click-types';

// ============================================================================
// TYPES
// ============================================================================

/** Context needed for entity pick handlers */
export interface EntityPickContext {
  worldPoint: Point2D;
  transform: ViewTransform;
  levelManager: LevelManagerLike;
}

// ============================================================================
// HELPER: Get scene from level manager
// ============================================================================

function getScene(ctx: EntityPickContext): SceneModel | null {
  return ctx.levelManager.currentLevelId
    ? ctx.levelManager.getLevelScene(ctx.levelManager.currentLevelId)
    : null;
}

// ============================================================================
// PRIORITY 1.9: ANGLE ENTITY MEASUREMENT PICKING
// ============================================================================

/**
 * Handles angle entity measurement picking (constraint, line-arc, two-arcs).
 * Returns `true` if the click was consumed (even if no entity was hit).
 */
export function handleAngleEntityPick(
  ctx: EntityPickContext,
  tool: AngleEntityToolLike,
  setSelectedEntityIds: (ids: string[]) => void,
): boolean {
  if (!tool.isActive || !tool.isWaitingForEntitySelection) return false;

  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;

  for (const entity of scene.entities) {
    if (!tool.acceptsEntityType(entity.type)) continue;

    let isHit = false;

    if (isLineEntity(entity)) {
      isHit = pointToLineDistance(ctx.worldPoint, entity.start, entity.end) <= hitTolerance;
    } else if (isArcEntity(entity)) {
      isHit = pointToArcDistance(ctx.worldPoint, entity) <= hitTolerance;
    } else if (isPolylineEntity(entity)) {
      if (entity.vertices && entity.vertices.length >= 2) {
        for (let i = 0; i < entity.vertices.length - 1; i++) {
          if (pointToLineDistance(ctx.worldPoint, entity.vertices[i], entity.vertices[i + 1]) <= hitTolerance) {
            isHit = true;
            break;
          }
        }
      }
    }

    if (isHit) {
      const stepBeforeClick = tool.currentStep;
      const accepted = tool.onEntityClick(entity as AnySceneEntity, ctx.worldPoint);
      if (accepted) {
        if (stepBeforeClick === 0) {
          setSelectedEntityIds([entity.id]);
        } else {
          setSelectedEntityIds([]);
        }
        dlog('entityPickHandlers', 'AngleEntityMeasurement entity accepted:', entity.id, 'step:', stepBeforeClick);
        return true;
      }
    }
  }
  dlog('entityPickHandlers', 'AngleEntityMeasurement: No matching entity at click point');
  return true;
}

// ============================================================================
// PRIORITY 2: CIRCLE TTT ENTITY PICKING
// ============================================================================

/**
 * Handles Circle TTT entity picking (tangent-tangent-tangent).
 * Returns `true` if the click was consumed.
 */
export function handleCircleTTTPick(
  ctx: EntityPickContext,
  tool: SpecialToolLike,
  activeTool: string,
): boolean {
  if (activeTool !== 'circle-ttt' || !tool.isWaitingForSelection) return false;

  const scene = getScene(ctx);
  if (!scene?.entities) return true;

  const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;

  for (const entity of scene.entities) {
    if (isLineEntity(entity) || isPolylineEntity(entity)) {
      let isHit = false;

      if (isLineEntity(entity)) {
        isHit = pointToLineDistance(ctx.worldPoint, entity.start, entity.end) <= hitTolerance;
      } else if (isPolylineEntity(entity)) {
        if (entity.vertices && entity.vertices.length >= 2) {
          for (let i = 0; i < entity.vertices.length - 1; i++) {
            if (pointToLineDistance(ctx.worldPoint, entity.vertices[i], entity.vertices[i + 1]) <= hitTolerance) {
              isHit = true;
              break;
            }
          }
          if (!isHit && entity.closed && entity.vertices.length > 2) {
            isHit = pointToLineDistance(ctx.worldPoint, entity.vertices[entity.vertices.length - 1], entity.vertices[0]) <= hitTolerance;
          }
        }
      }

      if (isHit) {
        const accepted = tool.onEntityClick(entity as AnySceneEntity, ctx.worldPoint);
        if (accepted) {
          dlog('entityPickHandlers', 'Circle TTT entity accepted:', entity.id);
          return true;
        }
      }
    }
  }
  dlog('entityPickHandlers', 'Circle TTT: No line/polyline found at click point');
  return true;
}

// ============================================================================
// PRIORITY 3: LINE PERPENDICULAR ENTITY PICKING
// ============================================================================

/**
 * Handles Line Perpendicular entity picking.
 * Returns `true` if the click was consumed.
 */
export function handleLinePerpendicularPick(
  ctx: EntityPickContext,
  tool: SpecialToolLike,
  activeTool: string,
): boolean {
  if (activeTool !== 'line-perpendicular' || !tool.isActive) return false;

  if (tool.currentStep === 0) {
    const scene = getScene(ctx);
    if (!scene?.entities) return true;

    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
    for (const entity of scene.entities) {
      if (isLineEntity(entity)) {
        if (pointToLineDistance(ctx.worldPoint, entity.start, entity.end) <= hitTolerance) {
          const accepted = tool.onEntityClick(entity as AnySceneEntity, ctx.worldPoint);
          if (accepted) {
            dlog('entityPickHandlers', 'LinePerpendicular entity accepted:', entity.id);
            return true;
          }
        }
      }
    }
    dlog('entityPickHandlers', 'LinePerpendicular: No line found at click point');
    return true;
  } else if (tool.currentStep === 1) {
    tool.onCanvasClick?.(ctx.worldPoint);
    return true;
  }
  return false;
}

// ============================================================================
// PRIORITY 4: LINE PARALLEL ENTITY PICKING
// ============================================================================

/**
 * Handles Line Parallel entity picking.
 * Returns `true` if the click was consumed.
 */
export function handleLineParallelPick(
  ctx: EntityPickContext,
  tool: SpecialToolLike,
  activeTool: string,
): boolean {
  if (activeTool !== 'line-parallel' || !tool.isActive) return false;

  if (tool.currentStep === 0) {
    const scene = getScene(ctx);
    if (!scene?.entities) return true;

    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / ctx.transform.scale;
    for (const entity of scene.entities) {
      if (isLineEntity(entity)) {
        if (pointToLineDistance(ctx.worldPoint, entity.start, entity.end) <= hitTolerance) {
          const accepted = tool.onEntityClick(entity as AnySceneEntity, ctx.worldPoint);
          if (accepted) {
            dlog('entityPickHandlers', 'LineParallel entity accepted:', entity.id);
            return true;
          }
        }
      }
    }
    dlog('entityPickHandlers', 'LineParallel: No line found at click point');
    return true;
  } else if (tool.currentStep === 1) {
    tool.onCanvasClick?.(ctx.worldPoint);
    return true;
  }
  return false;
}
