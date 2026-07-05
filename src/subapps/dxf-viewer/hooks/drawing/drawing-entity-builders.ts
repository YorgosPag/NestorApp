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
import type { XLineEntity, RayEntity } from '../../types/entities';
import { getXLineModeState } from '../../systems/tools/xline-mode-store';
// ADR-507 S2 — γραμμοσκίαση: boundary points → HatchEntity (με τα draw-defaults).
import { buildHatchEntityFromBoundary } from '../../bim/hatch/hatch-completion';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedPolylineEntity,
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
import { getDefaultLayerId } from '../../stores/LayerStore';
import { LINEWEIGHT_ISO_VALUES } from '../../config/lineweight-iso-catalog';
const LINEWEIGHT_1MM = LINEWEIGHT_ISO_VALUES[17];
function normalizeDir(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}
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
  // ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).
  const defaultLayerId = getDefaultLayerId();
  switch (tool) {
    case 'line':
      if (points.length >= 2) {
        return {
          id,
          type: 'line',
          start: points[0],
          end: points[1],
          visible: true,
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
            layerId: defaultLayerId,
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
            layerId: defaultLayerId,
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
            layerId: defaultLayerId,
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
            layerId: defaultLayerId,
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
          layerId: defaultLayerId,
        } as PolylineEntity;
      }
      break;
    case 'measure-angle':
    case 'measure-angle-measuregeom':
      if (points.length >= 2) {
        if (points.length === 2) {
          const polyline = {
            id,
            type: 'polyline' as const,
            vertices: [points[0], points[1]],
            closed: false,
            visible: true,
            layerId: defaultLayerId,
            color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
            lineweight: LINEWEIGHT_1MM,
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
            layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
          layerId: defaultLayerId,
          measurement: true,
        } as PolylineEntity;
      }
      break;
    // ADR-507 S2 — γραμμοσκίαση (Τρόπος Α: κλειστό όριο, N-click + Enter).
    case 'hatch':
      return buildHatchEntityFromBoundary(points, id, defaultLayerId);
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
            layerId: defaultLayerId,
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
          layerId: defaultLayerId,
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
        return {
          id,
          type: 'arc',
          center: arcResult.center,
          radius: arcResult.radius,
          startAngle: arcResult.startAngle,
          endAngle: arcResult.endAngle,
          visible: true,
          layerId: defaultLayerId,
          counterclockwise: finalCounterclockwise,
        } as ArcEntity;
      }
      break;
    case 'xline': {
      const xlineState = getXLineModeState();
      if (xlineState.mode === 'horizontal' && points.length >= 1) {
        return { id, type: 'xline', basePoint: points[0], direction: { x: 1, y: 0 }, visible: true, layerId: defaultLayerId } as XLineEntity;
      }
      if (xlineState.mode === 'vertical' && points.length >= 1) {
        return { id, type: 'xline', basePoint: points[0], direction: { x: 0, y: 1 }, visible: true, layerId: defaultLayerId } as XLineEntity;
      }
      if (xlineState.mode === 'angle') {
        if (xlineState.angleValue !== null && points.length >= 1) {
          const angleRad = xlineState.angleValue * Math.PI / 180;
          return { id, type: 'xline', basePoint: points[0], direction: { x: Math.cos(angleRad), y: Math.sin(angleRad) }, visible: true, layerId: defaultLayerId } as XLineEntity;
        }
        if (points.length >= 2) {
          return { id, type: 'xline', basePoint: points[0], direction: normalizeDir(points[1].x - points[0].x, points[1].y - points[0].y), visible: true, layerId: defaultLayerId } as XLineEntity;
        }
        break;
      }
      if (xlineState.mode === 'bisect') {
        if (points.length >= 3) {
          const [p1, p2, p3] = points;
          const d2x = p2.x - p1.x, d2y = p2.y - p1.y;
          const d3x = p3.x - p1.x, d3y = p3.y - p1.y;
          const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
          const len3 = Math.sqrt(d3x * d3x + d3y * d3y);
          if (len2 < 1e-10 || len3 < 1e-10) return null;
          const dir = normalizeDir(d2x / len2 + d3x / len3, d2y / len2 + d3y / len3);
          return { id, type: 'xline', basePoint: p1, direction: dir, visible: true, layerId: defaultLayerId } as XLineEntity;
        }
        break;
      }
      if (xlineState.mode === 'offset') return null; // Phase 4+ — needs entity pick
      // through (default)
      if (points.length >= 2) {
        const dir = normalizeDir(points[1].x - points[0].x, points[1].y - points[0].y);
        return { id, type: 'xline', basePoint: points[0], direction: dir, visible: true, layerId: defaultLayerId } as XLineEntity;
      }
      break;
    }
    case 'ray': {
      if (points.length >= 2) {
        const dir = normalizeDir(points[1].x - points[0].x, points[1].y - points[0].y);
        return {
          id,
          type: 'ray',
          basePoint: points[0],
          direction: dir,
          visible: true,
          layerId: defaultLayerId,
        } as RayEntity;
      }
      break;
    }
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
    case 'ray':
      return pointCount >= 2;
    case 'measure-angle':
    case 'measure-angle-measuregeom':
    case 'arc-3p':
    case 'arc-cse':
    case 'arc-sce':
    case 'circle-3p':
    case 'circle-chord-sagitta':
    case 'circle-2p-radius':
      return pointCount >= 3;
    case 'xline': {
      const state = getXLineModeState();
      if (state.mode === 'horizontal' || state.mode === 'vertical') return pointCount >= 1;
      if (state.mode === 'angle') return state.angleValue !== null ? pointCount >= 1 : pointCount >= 2;
      if (state.mode === 'bisect') return pointCount >= 3;
      if (state.mode === 'offset') return false;
      return pointCount >= 2; // through default
    }
    case 'measure-distance-continuous':
    case 'polyline':
    case 'polygon':
    case 'measure-area':
    case 'hatch': // ADR-507 S2 — closed boundary, N-click + Enter
    case 'circle-best-fit':
      return false; // These tools continue until manually finished
    default:
      return false;
  }
}
