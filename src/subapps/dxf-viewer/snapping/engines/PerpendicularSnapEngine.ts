/**
 * Perpendicular Snap Engine
 * Υπεύθυνο για εύρεση perpendicular snap points σε γραμμές
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Uses centralized Entity types from types/entities.ts
 * - Uses type guards for safe property access
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance, translatePoint } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-378: SSoT snap-visibility predicate (imported DXF entities omit `visible`)
import { isEntityVisibleForSnap } from '../shared/snap-visibility';
import { findEntityBasedSnapCandidates } from './shared/snap-engine-utils';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ENTERPRISE: Import centralized type guards
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isRectangleEntity,
  isCircleEntity,
  isXLineEntity,
  isRayEntity,
  isWallEntity,
  isSlabEntity,
  isOpeningEntity,
} from '../../types/entities';
// 🏢 ADR-087: Centralized Snap Engine Configuration
import { SNAP_RADIUS_MULTIPLIERS, SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
// ADR-363 Phase 5.5e — wall axis perpendicular feet (unclamped per-segment).
import { getWallAxisPerpendicularFeet } from '../../bim/walls/wall-axis-projection';
// ADR-363 Phase 5.5f — slab edge perpendicular feet (unclamped per-edge).
import { getSlabEdgePerpendicularFeet } from '../../bim/slabs/slab-edge-projection';
// ADR-363 Phase 5.5g — opening outline perpendicular feet (unclamped per-edge).
import { getOpeningOutlinePerpendicularFeet } from '../../bim/walls/opening-outline-projection';

export class PerpendicularSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.PERPENDICULAR);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.PERPENDICULAR);
    const maxDist = radius * SNAP_RADIUS_MULTIPLIERS.STANDARD;
    const priority = SNAP_ENGINE_PRIORITIES.PERPENDICULAR;

    // ADR-363 Phase A: BIM entities pre-pass — creates distinct description candidates
    // before findEntityBasedSnapCandidates (which would overwrite description with generic 'Perpendicular').
    const bimCandidates: SnapCandidate[] = [];
    const nonBimEntities: EntityModel[] = [];

    if (!Array.isArray(context.entities)) return { candidates: [] };

    for (const entity of context.entities) {
      if (!isEntityVisibleForSnap(entity)) continue;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      if (isWallEntity(entity)) {
        const feet = getWallAxisPerpendicularFeet(entity, cursorPoint, maxDist);
        for (const f of feet) {
          bimCandidates.push(this.createCandidate(f.point, 'bim-wall', calculateDistance(cursorPoint, f.point), priority, entity.id));
        }
      } else if (isSlabEntity(entity)) {
        const feet = getSlabEdgePerpendicularFeet(entity, cursorPoint, maxDist);
        for (const f of feet) {
          bimCandidates.push(this.createCandidate(f.point, 'bim-slab', calculateDistance(cursorPoint, f.point), priority, entity.id));
        }
      } else if (isOpeningEntity(entity)) {
        const feet = getOpeningOutlinePerpendicularFeet(entity, cursorPoint, maxDist);
        for (const f of feet) {
          bimCandidates.push(this.createCandidate(f.point, 'bim-opening', calculateDistance(cursorPoint, f.point), priority, entity.id));
        }
      } else {
        nonBimEntities.push(entity);
      }
    }

    const nonBimResult = findEntityBasedSnapCandidates(
      nonBimEntities,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.PERPENDICULAR,
        displayName: 'Perpendicular',
        priority,
      },
      (entity, cursorPoint, _) => {
        const richPoints = this.getPerpendicularPoints(entity as EntityModel, cursorPoint, maxDist);
        return richPoints.map(p => p.point);
      }
    );

    const allCandidates = [...bimCandidates, ...nonBimResult.candidates]
      .sort((a, b) => a.distance - b.distance);

    return { candidates: allCandidates };
  }

  private getPerpendicularPoints(entity: EntityModel, cursorPoint: Point2D, maxDistance: number): Array<{point: Point2D, type: string}> {
    const perpendicularPoints: Array<{point: Point2D, type: string}> = [];

    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isLineEntity(entity)) {
      const perpPoint = this.getPerpendicularToLine(entity.start, entity.end, cursorPoint);
      if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
        perpendicularPoints.push({point: perpPoint, type: 'Line'});
      }

    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      const vertices = entity.vertices;
      const isClosed = entity.closed || false;

      if (vertices && vertices.length > 1) {
        // Check all line segments
        for (let i = 1; i < vertices.length; i++) {
          const perpPoint = this.getPerpendicularToLine(vertices[i-1], vertices[i], cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: `Polyline Segment ${i}`});
          }
        }

        // Check closing segment for closed polylines
        if (isClosed && vertices.length > 2) {
          const perpPoint = this.getPerpendicularToLine(vertices[vertices.length - 1], vertices[0], cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: 'Polyline Closing Segment'});
          }
        }
      }

    } else if (isRectangleEntity(entity)) {
      const lines = GeometricCalculations.getRectangleLines(entity);
      lines.forEach((line, index) => {
        const perpPoint = this.getPerpendicularToLine(line.start, line.end, cursorPoint);
        if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
          perpendicularPoints.push({point: perpPoint, type: `Rectangle Edge ${index + 1}`});
        }
      });

    } else if (isCircleEntity(entity)) {
      // Perpendicular from cursor to circle (nearest point on circle)
      const dx = cursorPoint.x - entity.center.x;
      const dy = cursorPoint.y - entity.center.y;
      // 🏢 ADR-065: Use centralized distance calculation
      const distance = calculateDistance(cursorPoint, entity.center);

      if (distance > 0 && distance <= maxDistance + entity.radius) {
        const scale = entity.radius / distance;
        const perpPoint = {
          x: entity.center.x + dx * scale,
          y: entity.center.y + dy * scale
        };
        perpendicularPoints.push({point: perpPoint, type: 'Circle'});
      }
    } else if (isXLineEntity(entity)) {
      // Foot of perpendicular on infinite line — always valid (no clamping)
      const base = entity.basePoint;
      const dir = entity.direction;
      const foot = getNearestPointOnLine(cursorPoint, base, translatePoint(base, dir), false);
      if (calculateDistance(cursorPoint, foot) <= maxDistance) {
        perpendicularPoints.push({ point: foot, type: 'XLine' });
      }
    } else if (isWallEntity(entity)) {
      // ADR-363 Phase 5.5e — unclamped foot ανά axis segment (cached
      // `geometry.axisPolyline.points` καλύπτει straight/curved/polyline).
      // Επιτρέπει "perpendicular extension" snap όταν cursor είναι πέρα από
      // wall endpoint (mirror AutoCAD Line PERPENDICULAR semantics).
      const feet = getWallAxisPerpendicularFeet(entity, cursorPoint, maxDistance);
      for (const f of feet) {
        perpendicularPoints.push({ point: f.point, type: `Wall Axis Segment ${f.segmentIndex + 1}` });
      }
    } else if (isSlabEntity(entity)) {
      // ADR-363 Phase 5.5f — unclamped foot ανά slab outline edge (cached
      // `geometry.polygon.points`, closed CCW — closing edge [last→first]
      // συμπεριλαμβάνεται). Mirror Phase 5.5e: foot on infinite edge extension
      // εντός maxDistance (AutoCAD PERPENDICULAR semantics για polygons).
      const feet = getSlabEdgePerpendicularFeet(entity, cursorPoint, maxDistance);
      for (const f of feet) {
        perpendicularPoints.push({ point: f.point, type: `Slab Edge ${f.edgeIndex + 1}` });
      }
    } else if (isOpeningEntity(entity)) {
      // ADR-363 Phase 5.5g — unclamped foot ανά edge του 4-vertex cutout outline
      // (cached `geometry.outline.vertices`, Phase 2 invariant). Closing edge
      // [3]→[0] included via modulo. Mirror Phase 5.5e/5.5f PERPENDICULAR semantics.
      const feet = getOpeningOutlinePerpendicularFeet(entity, cursorPoint, maxDistance);
      for (const f of feet) {
        perpendicularPoints.push({ point: f.point, type: `Opening Edge ${f.edgeIndex + 1}` });
      }
    } else if (isRayEntity(entity)) {
      // Foot of perpendicular — only valid if t >= 0 (on the ray, not behind origin)
      const base = entity.basePoint;
      const dir = entity.direction;
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
      if (len > 1e-10) {
        const nx = dir.x / len;
        const ny = dir.y / len;
        const t = (cursorPoint.x - base.x) * nx + (cursorPoint.y - base.y) * ny;
        if (t >= 0) {
          const foot = { x: base.x + t * nx, y: base.y + t * ny };
          if (calculateDistance(cursorPoint, foot) <= maxDistance) {
            perpendicularPoints.push({ point: foot, type: 'Ray' });
          }
        }
      }
    }

    return perpendicularPoints;
  }

  private getPerpendicularToLine(lineStart: Point2D, lineEnd: Point2D, externalPoint: Point2D): Point2D | null {
    // Use shared geometry utility for consistency
    // For perpendicular snap, we want the foot of perpendicular even if outside segment
    return getNearestPointOnLine(externalPoint, lineStart, lineEnd, false);
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    perpendicularChecks: number;
  } {
    return {
      perpendicularChecks: 0 // Could add metrics
    };
  }
}