/**
 * @module drawing-entity-builders
 * @description Pure functions for creating DXF entities from drawing tool points.
 * Extracted from useUnifiedDrawing.tsx for separation of concerns and testability.
 *
 * Functions:
 * - createEntityFromTool(): Creates a scene entity based on tool type and clicked points
 * - isEntityComplete(): Determines if enough points have been collected to complete an entity
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  LineEntity,
  CircleEntity,
  PolylineEntity,
  RectangleEntity,
  AngleMeasurementEntity,
  ArcEntity,
} from '../../types/scene';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedCircleEntity,
  ExtendedPolylineEntity,
  ExtendedArcEntity,
} from './drawing-types';
import {
  calculateDistance,
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  radToDeg,
  normalizeAngleDeg,
  angleBetweenVectors,
  circleFrom3Points,
  circleFromChordAndSagitta,
  circleFrom2PointsAndRadius,
  circleBestFit,
  subtractPoints,
} from '../../rendering/entities/shared';
import { PANEL_LAYOUT } from '../../config/panel-tokens';


/**
 * Creates a scene entity from a drawing tool and a set of world-space points.
 *
 * This is a pure function — it has no side effects and does not depend on React state.
 * The caller is responsible for generating a unique `entityId` and passing the current
 * `arcFlipped` state.
 *
 * @param tool - The active drawing tool
 * @param points - Array of clicked world-space points
 * @param entityId - Unique entity identifier (e.g. "entity_42")
 * @param arcFlipped - Whether the arc direction has been flipped by the user (X key)
 * @returns The created entity, or null if not enough points / calculation failed
 */
export function createEntityFromTool(
  tool: DrawingTool,
  points: Point2D[],
  entityId: string,
  arcFlipped: boolean
): ExtendedSceneEntity | null {
  const id = entityId;

  switch (tool) {
    case 'line':
      if (points.length >= 2) {
        return {
          id,
          type: 'line',
          start: points[0],
          end: points[1],
          visible: true,
          layer: '0',
        } as LineEntity;
      }
      break;
    case 'measure-distance':
      if (points.length >= 2) {
        const measureEntity = {
          id,
          type: 'line',
          start: points[0],
          end: points[1],
          visible: true,
          layer: '0',
          measurement: true,
          showEdgeDistances: true,
        } as LineEntity;
        return measureEntity;
      }
      break;

    case 'measure-distance-continuous':
      if (points.length >= 2) {
        const lastTwoPoints = points.slice(-2);
        const continuousMeasureEntity = {
          id,
          type: 'line',
          start: lastTwoPoints[0],
          end: lastTwoPoints[1],
          visible: true,
          layer: '0',
          measurement: true,
          showEdgeDistances: true,
        } as LineEntity;
        return continuousMeasureEntity;
      }
      break;

    case 'rectangle':
      if (points.length >= 2) {
        const [p1, p2] = points;
        return {
          id,
          type: 'rectangle',
          corner1: p1,
          corner2: p2,
          visible: true,
          layer: '0',
        } as RectangleEntity;
      }
      break;
    case 'circle':
      if (points.length >= 2) {
        const [center, edge] = points;
        const radius = calculateDistance(center, edge);
        return {
          id,
          type: 'circle',
          center,
          radius,
          visible: true,
          layer: '0',
        } as CircleEntity;
      }
      break;
    case 'circle-diameter':
      if (points.length >= 2) {
        const [center, edge] = points;
        const radius = calculateDistance(center, edge);
        return {
          id,
          type: 'circle',
          center,
          radius,
          visible: true,
          layer: '0',
          diameterMode: true,
        } as CircleEntity;
      }
      break;
    case 'circle-2p-diameter':
      if (points.length >= 2) {
        const [p1, p2] = points;
        const center = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };
        const radius = calculateDistance(p1, p2) / 2;
        return {
          id,
          type: 'circle',
          center,
          radius,
          visible: true,
          layer: '0',
          twoPointDiameter: true,
        } as CircleEntity;
      }
      break;

    // Circle from 3 points (circumcircle) - ADR-083
    case 'circle-3p':
      if (points.length >= 3) {
        const [p1, p2, p3] = points;
        const circleResult = circleFrom3Points(p1, p2, p3);
        if (circleResult) {
          return {
            id,
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
          } as CircleEntity;
        }
      }
      break;

    // Circle from chord and sagitta - ADR-083
    case 'circle-chord-sagitta':
      if (points.length >= 3) {
        const [chordStart, chordEnd, sagittaPoint] = points;
        const circleResult = circleFromChordAndSagitta(chordStart, chordEnd, sagittaPoint);
        if (circleResult) {
          return {
            id,
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
          } as CircleEntity;
        }
      }
      break;

    // Circle from 2 points + radius indicator - ADR-083
    case 'circle-2p-radius':
      if (points.length >= 3) {
        const [p1, p2, radiusIndicator] = points;
        const circleResult = circleFrom2PointsAndRadius(p1, p2, radiusIndicator);
        if (circleResult) {
          return {
            id,
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
          } as CircleEntity;
        }
      }
      break;

    // Circle best-fit (least squares) - ADR-083
    case 'circle-best-fit':
      if (points.length >= 3) {
        const circleResult = circleBestFit(points);
        if (circleResult) {
          return {
            id,
            type: 'circle',
            center: circleResult.center,
            radius: circleResult.radius,
            visible: true,
            layer: '0',
          } as CircleEntity;
        }
      }
      break;

    case 'polyline':
      if (points.length >= 2) {
        return {
          id,
          type: 'polyline',
          vertices: [...points],
          closed: false,
          visible: true,
          layer: '0',
        } as PolylineEntity;
      }
      break;
    case 'measure-angle':
      if (points.length >= 2) {
        if (points.length === 2) {
          const polyline = {
            id,
            type: 'polyline' as const,
            vertices: [points[0], points[1]],
            closed: false,
            visible: true,
            layer: '0',
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: 1,
            opacity: 1.0,
            lineType: 'solid' as const,
          };

          const extendedPolyline: ExtendedPolylineEntity = {
            ...polyline,
            preview: true,
            showEdgeDistances: true,
            isOverlayPreview: false,
          } as ExtendedPolylineEntity;

          return extendedPolyline;
        } else if (points.length >= 3) {
          const [point1, vertex, point2] = points;

          const vector1 = subtractPoints(point1, vertex);
          const vector2 = subtractPoints(point2, vertex);

          const angleRad = angleBetweenVectors(vector1, vector2);
          const angleDeg = normalizeAngleDeg(radToDeg(angleRad));

          return {
            id,
            type: 'angle-measurement',
            vertex: vertex,
            point1: point1,
            point2: point2,
            angle: angleDeg,
            visible: true,
            layer: '0',
            measurement: true,
          } as AngleMeasurementEntity;
        }
      }
      break;
    case 'polygon':
      if (points.length >= 2) {
        return {
          id,
          type: 'polyline',
          vertices: [...points],
          closed: true,
          visible: true,
          layer: '0',
        } as PolylineEntity;
      }
      break;
    case 'measure-area':
      if (points.length >= 2) {
        return {
          id,
          type: 'polyline',
          vertices: [...points],
          closed: true,
          visible: true,
          layer: '0',
          measurement: true,
        } as PolylineEntity;
      }
      break;

    // Arc drawing tools - ADR-059
    case 'arc-3p':
      // 3-Point Arc: Start -> Point on Arc -> End
      if (points.length >= 3) {
        const [start, mid, end] = points;
        const arcResult = arcFrom3Points(start, mid, end);
        if (arcResult) {
          const finalCounterclockwise = arcFlipped
            ? !arcResult.counterclockwise
            : arcResult.counterclockwise;
          return {
            id,
            type: 'arc',
            center: arcResult.center,
            radius: arcResult.radius,
            startAngle: arcResult.startAngle,
            endAngle: arcResult.endAngle,
            visible: true,
            layer: '0',
            counterclockwise: finalCounterclockwise,
          } as ArcEntity;
        }
      }
      break;

    case 'arc-cse':
      // Center -> Start -> End Arc
      if (points.length >= 3) {
        const [center, start, end] = points;
        const arcResult = arcFromCenterStartEnd(center, start, end);
        const finalCounterclockwise = arcFlipped
          ? !arcResult.counterclockwise
          : arcResult.counterclockwise;
        return {
          id,
          type: 'arc',
          center: arcResult.center,
          radius: arcResult.radius,
          startAngle: arcResult.startAngle,
          endAngle: arcResult.endAngle,
          visible: true,
          layer: '0',
          counterclockwise: finalCounterclockwise,
        } as ArcEntity;
      }
      break;

    case 'arc-sce':
      // Start -> Center -> End Arc
      if (points.length >= 3) {
        const [start, center, end] = points;
        const arcResult = arcFromStartCenterEnd(start, center, end);
        const finalCounterclockwise = arcFlipped
          ? !arcResult.counterclockwise
          : arcResult.counterclockwise;
        console.debug('createEntityFromTool arc-sce:', {
          startAngle: arcResult.startAngle,
          endAngle: arcResult.endAngle,
          counterclockwise: finalCounterclockwise,
          flipped: arcFlipped,
          points: { start, center, end },
        });
        const arcEntity = {
          id,
          type: 'arc' as const,
          center: arcResult.center,
          radius: arcResult.radius,
          startAngle: arcResult.startAngle,
          endAngle: arcResult.endAngle,
          visible: true,
          layer: '0',
          counterclockwise: finalCounterclockwise,
        };
        console.debug('createEntityFromTool arc-sce FULL ENTITY:', JSON.stringify(arcEntity, null, 2));
        return arcEntity as ArcEntity;
      }
      break;
  }
  return null;
}


/**
 * Determines whether enough points have been collected to complete an entity for the given tool.
 *
 * @param tool - The active drawing tool
 * @param pointCount - Number of points currently collected (including the one just added)
 * @returns true if the entity can be completed (auto-finish), false if more points are needed
 */
export function isEntityComplete(tool: DrawingTool, pointCount: number): boolean {
  switch (tool) {
    case 'line':
    case 'measure-distance':
    case 'rectangle':
    case 'circle':
    case 'circle-diameter':
    case 'circle-2p-diameter':
      return pointCount >= 2;
    case 'measure-angle':
    case 'arc-3p':
    case 'arc-cse':
    case 'arc-sce':
    case 'circle-3p':
    case 'circle-chord-sagitta':
    case 'circle-2p-radius':
      return pointCount >= 3;
    case 'measure-distance-continuous':
    case 'polyline':
    case 'polygon':
    case 'measure-area':
    case 'circle-best-fit':
      return false; // These tools continue until manually finished
    default:
      return false;
  }
}
