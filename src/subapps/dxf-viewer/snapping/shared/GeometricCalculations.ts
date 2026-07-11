/**
 * Shared Geometric Calculations
 * Κοινές γεωμετρικές υπολογιστικές μέθοδοι για όλα τα snap engines
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Uses centralized Entity types from types/entities.ts
 * - Uses type guards for safe property access
 * - Eliminated local interface duplicates
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../extended-types';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance, rotatePoint, pointOnCircle, squaredDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-079: Centralized Geometric Precision Constants & Utility Functions
import {
  GEOMETRY_PRECISION,
  isDenominatorZero,
  isCircleIntersectionSinglePoint
} from '../../config/tolerance-config';
// 🏢 ENTERPRISE: Import centralized entity types and type guards
import type {
  RectangleEntity
} from '../../types/entities';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isCircleEntity,
  isArcEntity,
  isRectangleEntity,
  isWallEntity,
  isColumnEntity,
  isRayEntity,
  isBeamEntity,
  isSlabEntity,
  isSlabOpeningEntity,
  isOpeningEntity,
  isFoundationEntity,
  isHatchEntity,
  isRoofEntity,
} from '../../types/entities';
import type { RoofEntity } from '../../bim/types/roof-types';
// ADR-363 BIM entity key-point SSoT (delegates to bim-entity-points.ts).
import { getBimEntityKeyPoints2D, getBimEntityEdgeMidpoints2D } from '../../bim/utils/bim-entity-points';
// ADR-507 — hatch boundary bbox-center SSoT (reused for the hatch CENTER snap; zero duplicate bbox math).
import { hatchBoundsCenter } from '../../bim/hatch/hatch-grips';
// ADR-417 — roof eave outer-ring SSoT (ό,τι ζωγραφίζεται ως γείσο → έλξη εκεί).
import { roofEaveOuterRing } from '../../bim/geometry/roof-eave-plan-geom';
import { mmToSceneUnits } from '../../utils/scene-units';

export interface IntersectionResult {
  point: Point2D;
  type: string;
}

export interface RectangleLine {
  start: Point2D;
  end: Point2D;
}

export class GeometricCalculations {
  
  // --------- DISTANCE CALCULATIONS ---------

  // Διαγράφηκε το περιττό wrapper calculateDistance - χρησιμοποιείστε απευθείας calculateDistance από geometry-rendering-utils

  static distanceSq(p1: Point2D, p2: Point2D): number {
    // 🏢 ADR-157: Delegates to centralized squaredDistance (ADR-109)
    return squaredDistance(p1, p2);
  }

  static distancePointToLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    // Use shared geometry-utils function to eliminate duplication
    return pointToLineDistance(point, lineStart, lineEnd);
  }

  // --------- ENTITY PROPERTY EXTRACTORS ---------

  static getEntityEndpoints(entity: Entity): Point2D[] {
    const endpoints: Point2D[] = [];

    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isLineEntity(entity)) {
      endpoints.push(entity.start);
      endpoints.push(entity.end);
    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      // AutoCAD/Revit ENDPOINT osnap: ΚΑΘΕ κορυφή είναι άκρο ενός τμήματος — όχι
      // μόνο τα δύο ακραία. Ισχύει το ίδιο για ανοιχτή ΚΑΙ κλειστή πολυγραμμή· το
      // `closed` flag δεν προσθέτει/αφαιρεί κορυφή, μόνο την ακμή κλεισίματος (που
      // την καλύπτει το MIDPOINT). Πριν, η ανοιχτή πολυγραμμή έδινε μόνο first+last,
      // κρύβοντας τα σημεία αλλαγής διεύθυνσης από την έλξη (ADR-378 follow-up).
      if (entity.vertices) endpoints.push(...entity.vertices);
    } else if (isArcEntity(entity)) {
      // 🏢 ADR-074: Use centralized pointOnCircle
      const start = pointOnCircle(entity.center, entity.radius, entity.startAngle);
      const end = pointOnCircle(entity.center, entity.radius, entity.endAngle);
      endpoints.push(start, end);
    } else if (isRectangleEntity(entity)) {
      const corners = GeometricCalculations.getRectangleCorners(entity);
      endpoints.push(...corners);
    } else if (isWallEntity(entity) || isColumnEntity(entity) || isBeamEntity(entity) || isSlabEntity(entity) || isSlabOpeningEntity(entity) || isOpeningEntity(entity)) {
      // ADR-363 — BIM entity key points delegated to SSoT (bim-entity-points.ts).
      endpoints.push(...getBimEntityKeyPoints2D(entity));
    } else if (isRayEntity(entity)) {
      endpoints.push(entity.basePoint);
    } else if (isHatchEntity(entity)) {
      // ADR-507 — γραμμοσκίαση: κάθε κορυφή κάθε ring του ορίου (`boundaryPaths`)
      // είναι λαβή (`hatch-vertex-*`) → ENDPOINT έλξη, όπως στην κλειστή πολυγραμμή.
      for (const ring of entity.boundaryPaths) {
        endpoints.push(...ring);
      }
    } else if (isRoofEntity(entity)) {
      // ADR-417 — στέγη: κορυφές footprint (γραμμή τοίχου/pivot) + εξωτερικό mitered
      // δαχτυλίδι γείσου (SSoT `roofEaveOuterRing` — ό,τι ζωγραφίζεται) + άκρα
      // κορφιάδων/hips (`geometry.ridges`). Καλύπτει το πλήρες Revit-grade σετ.
      for (const v of entity.params?.outline?.vertices ?? []) endpoints.push({ x: v.x, y: v.y });
      endpoints.push(...GeometricCalculations.roofEaveRing(entity));
      for (const r of entity.geometry?.ridges ?? []) {
        endpoints.push({ x: r.a.x, y: r.a.y }, { x: r.b.x, y: r.b.y });
      }
    }
    // XLine: infinite in both directions → no endpoints

    return endpoints;
  }

  /**
   * ADR-507 — Midpoints κάθε ακμής ενός vertex ring. Όταν `closed`, προστίθεται και
   * η ακμή κλεισίματος (τελευταία→πρώτη, μόνο για length>2). SSoT για κλειστή
   * πολυγραμμή ΚΑΙ όρια γραμμοσκίασης (μηδέν διπλότυπο edge-midpoint loop).
   */
  private static ringEdgeMidpoints(vertices: readonly Point2D[], closed: boolean): Point2D[] {
    const mids: Point2D[] = [];
    if (!vertices || vertices.length < 2) return mids;
    for (let i = 1; i < vertices.length; i++) {
      mids.push({ x: (vertices[i - 1].x + vertices[i].x) / 2, y: (vertices[i - 1].y + vertices[i].y) / 2 });
    }
    if (closed && vertices.length > 2) {
      const a = vertices[vertices.length - 1];
      const b = vertices[0];
      mids.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    return mids;
  }

  static getEntityMidpoints(entity: Entity): Point2D[] {
    const midpoints: Point2D[] = [];

    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isLineEntity(entity)) {
      midpoints.push({
        x: (entity.start.x + entity.end.x) / 2,
        y: (entity.start.y + entity.end.y) / 2
      });
    } else if (isArcEntity(entity)) {
      // 🏢 ADR-074: Use centralized pointOnCircle
      const midAngle = (entity.startAngle + entity.endAngle) / 2;
      midpoints.push(pointOnCircle(entity.center, entity.radius, midAngle));
    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      // Edge midpoints (+ closing edge when closed) via shared SSoT helper.
      midpoints.push(...GeometricCalculations.ringEdgeMidpoints(entity.vertices, entity.closed || false));
    } else if (isHatchEntity(entity)) {
      // ADR-507 — γραμμοσκίαση: μέσα ακμών κάθε ring (κλειστός βρόχος) του ορίου.
      for (const ring of entity.boundaryPaths) {
        midpoints.push(...GeometricCalculations.ringEdgeMidpoints(ring, true));
      }
    } else if (isRoofEntity(entity)) {
      // ADR-417 — στέγη: μέσα ακμών footprint + εξωτερικού δαχτυλιδιού γείσου + κορφιάδων/hips.
      midpoints.push(...GeometricCalculations.ringEdgeMidpoints(entity.params?.outline?.vertices ?? [], true));
      midpoints.push(...GeometricCalculations.ringEdgeMidpoints(GeometricCalculations.roofEaveRing(entity), true));
      for (const r of entity.geometry?.ridges ?? []) {
        midpoints.push({ x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 });
      }
    } else if (isWallEntity(entity) || isBeamEntity(entity) || isSlabEntity(entity) || isSlabOpeningEntity(entity) || isOpeningEntity(entity)) {
      // ADR-363 — BIM entity edge midpoints delegated to SSoT (bim-entity-points.ts).
      midpoints.push(...getBimEntityEdgeMidpoints2D(entity));
    }

    return midpoints;
  }

  static getEntityMidpoint(entity: Entity): Point2D | null {
    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isWallEntity(entity)) {
      // ADR-363 — delegate to SSoT; pick median edge midpoint as representative.
      const mids = getBimEntityEdgeMidpoints2D(entity);
      return mids.length > 0 ? mids[Math.floor((mids.length - 1) / 2)] : null;
    }
    if (isLineEntity(entity)) {
      return {
        x: (entity.start.x + entity.end.x) / 2,
        y: (entity.start.y + entity.end.y) / 2
      };
    } else if (isArcEntity(entity)) {
      // 🏢 ADR-074: Use centralized pointOnCircle
      const midAngle = (entity.startAngle + entity.endAngle) / 2;
      return pointOnCircle(entity.center, entity.radius, midAngle);
    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      const vertices = entity.vertices;
      if (vertices && vertices.length >= 2) {
        const midIndex = Math.floor(vertices.length / 2);
        if (vertices.length % 2 === 1) {
          return vertices[midIndex];
        } else {
          const p1 = vertices[midIndex - 1];
          const p2 = vertices[midIndex];
          return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          };
        }
      }
    } else if (isBeamEntity(entity)) {
      // ADR-363 — delegates to SSoT (single midpoint for beam axis).
      const pts = getBimEntityEdgeMidpoints2D(entity);
      return pts.length > 0 ? pts[0] : null;
    }

    return null;
  }

  static getEntityCenter(entity: Entity): Point2D | null {
    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isCircleEntity(entity) || isArcEntity(entity)) {
      return entity.center;
    } else if (isFoundationEntity(entity)) {
      // ADR-436 Slice 2 — pad footing center axis = `position` (mirror column
      // center snap). Lets the tie-beam / strip line tools snap their endpoints
      // to existing pad centers via the shared CENTER snap engine (μηδέν νέο engine).
      const params = entity.params;
      if (params.kind === 'pad') {
        return { x: params.position.x, y: params.position.y };
      }
      return null;
    } else if (isRectangleEntity(entity)) {
      // RectangleEntity has required corner1 and corner2
      if (entity.corner1 && entity.corner2) {
        return {
          x: (entity.corner1.x + entity.corner2.x) / 2,
          y: (entity.corner1.y + entity.corner2.y) / 2
        };
      }
    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      // For closed polylines with 4 vertices (squares/rectangles)
      const vertices = entity.vertices;
      const isClosed = entity.closed || false;

      if (vertices && vertices.length === 4 && isClosed) {
        // Calculate center of 4-vertex closed polyline (rectangle)
        let centerX = 0;
        let centerY = 0;
        for (const point of vertices) {
          centerX += point.x;
          centerY += point.y;
        }
        return {
          x: centerX / 4,
          y: centerY / 4
        };
      }
    } else if (isHatchEntity(entity)) {
      // ADR-507 — γραμμοσκίαση: CENTER έλξη = κέντρο bbox του ορίου. Επαναχρήση του
      // `hatchBoundsCenter` SSoT (ίδιο math με τον gradient origin default) → μηδέν διπλότυπο.
      return hatchBoundsCenter(entity.boundaryPaths);
    } else if (isRoofEntity(entity)) {
      // ADR-417 — στέγη: CENTER = κέντρο bbox footprint (derived `geometry.bbox` SSoT).
      const b = entity.geometry?.bbox;
      return b ? { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 } : null;
    }

    return null;
  }

  /**
   * ADR-417 — το εξωτερικό mitered δαχτυλίδι γείσου μιας στέγης σε plan
   * (SSoT `roofEaveOuterRing` — ό,τι ζωγραφίζει ο `RoofRenderer`). `s` = canvas
   * units ανά mm. Κοινό για ENDPOINT + MIDPOINT έλξη γείσου· κενό σε degenerate roof.
   */
  private static roofEaveRing(entity: RoofEntity): Point2D[] {
    const p = entity.params;
    const s = mmToSceneUnits(p?.sceneUnits ?? 'mm');
    return roofEaveOuterRing(p?.outline?.vertices ?? [], p?.edges ?? [], s, entity.geometry?.ridges ?? []);
  }

  // --------- RECTANGLE UTILITIES ---------

  static getRectangleCorners(rectangle: RectangleEntity): Point2D[] {
    const { corner1, corner2, rotation = 0 } = rectangle;
    if (!corner1 || !corner2) return [];
    
    const corners = [
      { x: corner1.x, y: corner1.y },
      { x: corner2.x, y: corner1.y },
      { x: corner2.x, y: corner2.y },
      { x: corner1.x, y: corner2.y }
    ];
    
    if (rotation !== 0) {
      const center = {
        x: (corner1.x + corner2.x) / 2,
        y: (corner1.y + corner2.y) / 2
      };
      
      return corners.map(corner => GeometricCalculations.rotatePoint(corner, center, rotation));
    }
    
    return corners;
  }

  static getRectangleLines(rectangle: RectangleEntity): RectangleLine[] {
    const corners = GeometricCalculations.getRectangleCorners(rectangle);
    if (corners.length !== 4) return [];
    
    return [
      { start: corners[0], end: corners[1] },
      { start: corners[1], end: corners[2] },
      { start: corners[2], end: corners[3] },
      { start: corners[3], end: corners[0] }
    ];
  }

  static rotatePoint(point: Point2D, center: Point2D, angle: number): Point2D {
    return rotatePoint(point, center, angle);
  }

  // --------- LINE INTERSECTIONS ---------

  static getLineIntersection(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    // 🏢 ADR-079: Use centralized precision check function
    if (isDenominatorZero(denom)) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }

    return null;
  }

  static getLineCircleIntersections(lineStart: Point2D, lineEnd: Point2D, center: Point2D, radius: number): Point2D[] {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const fx = lineStart.x - center.x;
    const fy = lineStart.y - center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];

    const discriminantSqrt = Math.sqrt(discriminant);
    const t1 = (-b - discriminantSqrt) / (2 * a);
    const t2 = (-b + discriminantSqrt) / (2 * a);

    const intersections: Point2D[] = [];

    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        x: lineStart.x + t1 * dx,
        y: lineStart.y + t1 * dy
      });
    }

    // 🏢 ADR-079: Use centralized intersection duplicate threshold
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > GEOMETRY_PRECISION.INTERSECTION_DUPLICATE) {
      intersections.push({
        x: lineStart.x + t2 * dx,
        y: lineStart.y + t2 * dy
      });
    }

    return intersections;
  }

  static getCircleIntersections(center1: Point2D, radius1: number, center2: Point2D, radius2: number): Point2D[] {
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    // 🏢 ADR-065: Use centralized distance calculation
    const d = calculateDistance(center1, center2);

    if (d > radius1 + radius2 || d < Math.abs(radius1 - radius2) || d === 0) {
      return [];
    }

    const a = (radius1 * radius1 - radius2 * radius2 + d * d) / (2 * d);
    const h = Math.sqrt(radius1 * radius1 - a * a);

    const px = center1.x + a * (dx / d);
    const py = center1.y + a * (dy / d);

    // 🏢 ADR-079: Use centralized precision check function
    if (isCircleIntersectionSinglePoint(h)) {
      return [{ x: px, y: py }];
    }

    return [
      {
        x: px + h * (-dy / d),
        y: py + h * (dx / d)
      },
      {
        x: px - h * (-dy / d),
        y: py - h * (dx / d)
      }
    ];
  }

  // --------- ENTITY PROXIMITY CHECKS ---------

  static isEntityNearPoint(entity: Entity, point: Point2D, radius: number): boolean {
    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isLineEntity(entity)) {
      return GeometricCalculations.distancePointToLine(point, entity.start, entity.end) <= radius;
    } else if (isCircleEntity(entity)) {
      const distanceToCenter = calculateDistance(point, entity.center);
      return Math.abs(distanceToCenter - entity.radius) <= radius;
    } else if (isRectangleEntity(entity)) {
      const rectLines = GeometricCalculations.getRectangleLines(entity);
      return rectLines.some(line => GeometricCalculations.distancePointToLine(point, line.start, line.end) <= radius);
    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      const vertices = entity.vertices;
      if (vertices && vertices.length > 1) {
        for (let i = 1; i < vertices.length; i++) {
          const dist = GeometricCalculations.distancePointToLine(point, vertices[i-1], vertices[i]);
          if (dist <= radius) return true;
        }

        // Check closing edge for closed polylines
        const isClosed = entity.closed || false;
        if (isClosed && vertices.length > 2) {
          const dist = GeometricCalculations.distancePointToLine(point, vertices[vertices.length - 1], vertices[0]);
          if (dist <= radius) return true;
        }
      }
    }

    return false;
  }
}