/**
 * Nearest Snap Engine
 * Υπεύθυνο για εύρεση του κοντινότερου σημείου σε οποιαδήποτε entity
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
// ADR-363 Phase 5.5e — wall axis projection (clamped NEAREST semantics).
import { isWallEntity, isSlabEntity, isOpeningEntity } from '../../types/entities';
import { projectPointOnWallAxis } from '../../bim/walls/wall-axis-projection';
// ADR-363 Phase 5.5f — slab edge projection (clamped NEAREST semantics).
import { projectPointOnSlabEdge } from '../../bim/slabs/slab-edge-projection';
// ADR-363 Phase 5.5g — opening outline projection (clamped NEAREST semantics).
import { projectPointOnOpeningOutline } from '../../bim/walls/opening-outline-projection';

export class NearestSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.NEAREST);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.NEAREST;
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.NEAREST);
    let closestPoint: Point2D | null = null;
    let closestDistance = Infinity;
    let closestEntity: EntityModel | null = null;
    
    // Guard against non-iterable entities
    if (!Array.isArray(context.entities)) {
      console.warn('[NearestSnapEngine] entities is not an array:', typeof context.entities, context.entities);
      return { candidates };
    }
    
    // Find the nearest point on any entity
    for (const entity of context.entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!entity.visible) continue;
      
      const nearestPoint = this.getNearestPointOnEntity(entity, cursorPoint);
      if (nearestPoint) {
        const distance = calculateDistance(cursorPoint, nearestPoint);
        
        if (distance < closestDistance && distance <= radius) {
          closestDistance = distance;
          closestPoint = nearestPoint;
          closestEntity = entity;
        }
      }
    }
    
    if (closestPoint && closestEntity) {
      const candidate = this.createCandidate(
        closestPoint,
        'Nearest',
        closestDistance,
        priority,
        closestEntity.id
      );
      
      candidates.push(candidate);
    }

    return { candidates };
  }

  private getNearestPointOnEntity(entity: EntityModel, point: Point2D): Point2D | null {
    // ADR-363 Phase 5.5e — wall axis projection. Διαβάζει cached
    // `wall.geometry.axisPolyline.points` (Phase 1 invariant) → uniform για
    // straight/curved/polyline kinds. Clamped semantics: αν cursor πέσει πέρα
    // από wall endpoint, foot = endpoint (όχι προέκταση — αυτό το καλύπτει
    // το PerpendicularSnapEngine στο Phase 5.5e).
    if (isWallEntity(entity)) {
      return projectPointOnWallAxis(entity, point);
    }
    // ADR-363 Phase 5.5f — slab edge projection. Reads cached
    // `slab.geometry.polygon.points` (Phase 3 invariant). Closed polygon:
    // closing edge [last→first] included. Clamped semantics.
    if (isSlabEntity(entity)) {
      return projectPointOnSlabEdge(entity, point);
    }
    // ADR-363 Phase 5.5g — opening outline (4-edge cutout rectangle).
    if (isOpeningEntity(entity)) {
      return projectPointOnOpeningOutline(entity, point);
    }

    const entityType = entity.type.toLowerCase();

    if (entityType === 'line') {
      if ('start' in entity && 'end' in entity && entity.start && entity.end) {
        return getNearestPointOnLine(point, entity.start as Point2D, entity.end as Point2D);
      }
    } else if (entityType === 'circle') {
      if ('center' in entity && 'radius' in entity && entity.center && entity.radius) {
        return this.getNearestPointOnCircle(point, entity.center as Point2D, entity.radius as number);
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const polylineEntity = entity;
      const points = ('vertices' in polylineEntity ? polylineEntity.vertices : undefined) as Point2D[] | undefined;
      if (points && points.length > 1) {
        const isClosed = 'closed' in entity ? Boolean(entity.closed) : false;
        return this.getNearestPointOnPolyline(point, points, isClosed);
      }
    } else if (entityType === 'xline') {
      if ('basePoint' in entity && 'direction' in entity && entity.basePoint && entity.direction) {
        const base = entity.basePoint as Point2D;
        const dir = entity.direction as Point2D;
        // Projection on infinite line (no clamping)
        return getNearestPointOnLine(point, base, { x: base.x + dir.x, y: base.y + dir.y }, false);
      }
    } else if (entityType === 'ray') {
      if ('basePoint' in entity && 'direction' in entity && entity.basePoint && entity.direction) {
        const base = entity.basePoint as Point2D;
        const dir = entity.direction as Point2D;
        const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (len < 1e-10) return null;
        const nx = dir.x / len;
        const ny = dir.y / len;
        const t = (point.x - base.x) * nx + (point.y - base.y) * ny;
        if (t < 0) return { x: base.x, y: base.y };
        return { x: base.x + t * nx, y: base.y + t * ny };
      }
    }

    return null;
  }

  // Using centralized geometry utility - eliminates duplication

  private getNearestPointOnCircle(point: Point2D, center: Point2D, radius: number): Point2D {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    // 🏢 ADR-065: Use centralized distance calculation
    const distance = calculateDistance(point, center);
    
    if (distance === 0) {
      // Point is at center, return any point on circle
      return { x: center.x + radius, y: center.y };
    }
    
    // Normalize and scale to radius
    const scale = radius / distance;
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale
    };
  }

  private getNearestPointOnPolyline(point: Point2D, points: Point2D[], closed: boolean): Point2D | null {
    let nearestPoint: Point2D | null = null;
    let nearestDistance = Infinity;
    
    // Check all line segments
    for (let i = 1; i < points.length; i++) {
      const segmentNearest = getNearestPointOnLine(point, points[i-1], points[i]);
      const distance = calculateDistance(point, segmentNearest);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = segmentNearest;
      }
    }
    
    // Check closing segment for closed polylines
    if (closed && points.length > 2) {
      const segmentNearest = getNearestPointOnLine(point, points[points.length-1], points[0]);
      const distance = calculateDistance(point, segmentNearest);
      
      if (distance < nearestDistance) {
        nearestPoint = segmentNearest;
      }
    }
    
    return nearestPoint;
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    nearestCalculations: number;
  } {
    return {
      nearestCalculations: 0 // Could add metrics
    };
  }
}