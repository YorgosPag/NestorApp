/**
 * BOUNDS UTILITIES - Bounding box calculations για spatial indexing
 * ✅ ΦΑΣΗ 5: Core utilities για hit-testing και spatial queries
 */

import type { EntityModel, Point2D } from '../types/Types';
// 🏢 ADR-107: Centralized Text Metrics Ratios
// 🏢 ADR-142: Centralized Default Font Size
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';

// 🏢 ENTERPRISE: Entity-specific type interfaces for safe type casting
interface LineEntityProperties {
  start: Point2D;
  end: Point2D;
}

interface CircleEntityProperties {
  center: Point2D;
  radius: number;
}

interface PolylineEntityProperties {
  vertices: Point2D[];
  points?: Point2D[];
}

interface EllipseEntityProperties {
  center: Point2D;
  radiusX: number;
  radiusY: number;
}

interface TextEntityProperties {
  position: Point2D;
  text: string;
  fontSize?: number;
  height?: number;      // 🏢 DXF text height (primary property from DXF parser)
  rotation?: number;    // 🏢 DXF text rotation in degrees (for rotated AABB)
}

interface SplineEntityProperties {
  controlPoints?: Point2D[];
  vertices?: Point2D[];
}

interface PointEntityProperties {
  position: Point2D;
}

interface AngleMeasurementEntityProperties {
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
}

// 🏢 ENTERPRISE: Type guard helpers
type EntityWithLine = EntityModel & LineEntityProperties;
type EntityWithCircle = EntityModel & CircleEntityProperties;
type EntityWithPolyline = EntityModel & PolylineEntityProperties;
type EntityWithEllipse = EntityModel & EllipseEntityProperties;
type EntityWithText = EntityModel & TextEntityProperties;
type EntityWithSpline = EntityModel & SplineEntityProperties;
type EntityWithPoint = EntityModel & PointEntityProperties;
type EntityWithAngleMeasurement = EntityModel & AngleMeasurementEntityProperties;

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * 🔺 BOUNDING BOX CALCULATOR
 * Υπολογίζει bounding boxes για όλους τους τύπους entities
 */
export class BoundsCalculator {
  /**
   * 🔺 MAIN ENTITY BOUNDS CALCULATION
   * Υπολογίζει το bounding box ενός entity με μικρό tolerance
   */
  static calculateEntityBounds(entity: EntityModel, tolerance = 0): BoundingBox | null {
    switch (entity.type) {
      case 'line':
        return this.calculateLineBounds(entity, tolerance);
      case 'circle':
        return this.calculateCircleBounds(entity, tolerance);
      case 'arc':
        return this.calculateArcBounds(entity, tolerance);
      case 'polyline':
      case 'lwpolyline':
        return this.calculatePolylineBounds(entity, tolerance);
      case 'rectangle':
      case 'rect':
        return this.calculateRectangleBounds(entity, tolerance);
      case 'ellipse':
        return this.calculateEllipseBounds(entity, tolerance);
      case 'text':
      case 'mtext':
        return this.calculateTextBounds(entity, tolerance);
      case 'spline':
        return this.calculateSplineBounds(entity, tolerance);
      case 'point':
        return this.calculatePointBounds(entity, tolerance);
      case 'angle-measurement':
        return this.calculateAngleMeasurementBounds(entity, tolerance);
      default:
        console.warn(`BoundsCalculator: Unknown entity type: ${entity.type}`);
        return null;
    }
  }

  /**
   * 🔺 LINE BOUNDS
   */
  private static calculateLineBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for LineEntity properties
    const lineEntity = entity as EntityWithLine;
    const start = lineEntity.start;
    const end = lineEntity.end;

    const minX = Math.min(start.x, end.x) - tolerance;
    const minY = Math.min(start.y, end.y) - tolerance;
    const maxX = Math.max(start.x, end.x) + tolerance;
    const maxY = Math.max(start.y, end.y) + tolerance;

    return this.createBoundingBox(minX, minY, maxX, maxY);
  }

  /**
   * 🔺 CIRCLE BOUNDS
   */
  private static calculateCircleBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for CircleEntity properties
    const circleEntity = entity as EntityWithCircle;
    const center = circleEntity.center;
    const radius = circleEntity.radius + tolerance;

    return this.createBoundingBox(
      center.x - radius,
      center.y - radius,
      center.x + radius,
      center.y + radius
    );
  }

  /**
   * 🔺 ARC BOUNDS
   * Simplified - θα μπορούσε να βελτιωθεί με ακριβή υπολογισμό των endpoints
   */
  private static calculateArcBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // Για τώρα χρησιμοποιούμε circle bounds (conservative approach)
    return this.calculateCircleBounds(entity, tolerance);
  }

  /**
   * 🔺 POLYLINE BOUNDS
   */
  private static calculatePolylineBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for PolylineEntity properties
    const polylineEntity = entity as EntityWithPolyline;
    const vertices = polylineEntity.vertices;
    if (!vertices || vertices.length === 0) {
      return this.createBoundingBox(0, 0, 0, 0);
    }

    let minX = vertices[0].x;
    let minY = vertices[0].y;
    let maxX = vertices[0].x;
    let maxY = vertices[0].y;

    for (const vertex of vertices) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    }

    return this.createBoundingBox(
      minX - tolerance,
      minY - tolerance,
      maxX + tolerance,
      maxY + tolerance
    );
  }

  /**
   * 🔺 RECTANGLE BOUNDS
   */
  private static calculateRectangleBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // Rectangle είναι polyline με 4 vertices
    return this.calculatePolylineBounds(entity, tolerance);
  }

  /**
   * 🔺 ELLIPSE BOUNDS
   * Simplified - χρησιμοποιεί το bounding rectangle
   */
  private static calculateEllipseBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for EllipseEntity properties
    const ellipseEntity = entity as EntityWithEllipse;
    const center = ellipseEntity.center;
    const radiusX = ellipseEntity.radiusX + tolerance;
    const radiusY = ellipseEntity.radiusY + tolerance;

    return this.createBoundingBox(
      center.x - radiusX,
      center.y - radiusY,
      center.x + radiusX,
      center.y + radiusY
    );
  }

  /**
   * 🔺 TEXT BOUNDS
   * Rotation-aware bounding box for text entities.
   *
   * 🏢 FIX (2026-02-20): Use entity.height (DXF standard) with proper fallback chain.
   * BEFORE: Used entity.fontSize || DEFAULT_FONT_SIZE (12) — but DXF entities have
   * `height` (e.g. 2.5), NOT `fontSize` → bounds were ~5x inflated → spatial index
   * returned text candidates from huge distances.
   *
   * AFTER: height || fontSize || 2.5 (AutoCAD Standard DIMTXT default)
   * Matches TextRenderer.extractTextHeight() priority chain.
   *
   * Also handles rotation: for rotated text (e.g. vertical dimension text at 90°),
   * the AABB is computed from the rotated corners of the text rectangle.
   */
  private static calculateTextBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for TextEntity properties
    const textEntity = entity as EntityWithText;
    const position = textEntity.position;
    const text = textEntity.text || '';

    // 🏢 FIX (2026-02-20): Priority chain matching TextRenderer.extractTextHeight()
    // DXF entities store text size in `height`, NOT `fontSize`
    const textHeight = textEntity.height || textEntity.fontSize || 2.5;

    // 🏢 ADR-107: Use centralized text metrics ratio for width estimation
    const estimatedWidth = text.length * textHeight * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;
    const estimatedHeight = textHeight;

    // 🏢 FIX (2026-02-20): Rotation-aware AABB
    // For rotated text (e.g. vertical dimension "2.95" at 90°), compute the axis-aligned
    // bounding box of the rotated text rectangle. Without this, the AABB for rotated text
    // extends incorrectly in one axis.
    const rotation = textEntity.rotation ?? 0;
    let normalizedRotation = rotation % 360;
    if (normalizedRotation < 0) normalizedRotation += 360;

    if (normalizedRotation !== 0) {
      // Rotate the 4 corners of the text rectangle around position
      const rad = normalizedRotation * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Text rectangle corners relative to position (origin)
      // DXF: insertion = baseline-left, text extends right and up
      const corners = [
        { x: 0, y: 0 },
        { x: estimatedWidth, y: 0 },
        { x: estimatedWidth, y: estimatedHeight },
        { x: 0, y: estimatedHeight },
      ];

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const corner of corners) {
        const rx = corner.x * cos - corner.y * sin + position.x;
        const ry = corner.x * sin + corner.y * cos + position.y;
        minX = Math.min(minX, rx);
        minY = Math.min(minY, ry);
        maxX = Math.max(maxX, rx);
        maxY = Math.max(maxY, ry);
      }

      return this.createBoundingBox(
        minX - tolerance,
        minY - tolerance,
        maxX + tolerance,
        maxY + tolerance
      );
    }

    // Non-rotated: simple axis-aligned box
    return this.createBoundingBox(
      position.x - tolerance,
      position.y - tolerance,
      position.x + estimatedWidth + tolerance,
      position.y + estimatedHeight + tolerance
    );
  }

  /**
   * 🔺 SPLINE BOUNDS
   * Simplified - χρησιμοποιεί τα control points
   */
  private static calculateSplineBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for SplineEntity properties
    const splineEntity = entity as EntityWithSpline;
    const controlPoints = splineEntity.controlPoints || splineEntity.vertices;
    if (!controlPoints || controlPoints.length === 0) {
      return this.createBoundingBox(0, 0, 0, 0);
    }

    // Use control points bounds (conservative) - create temporary polyline entity
    const polylineEntity: EntityModel & PolylineEntityProperties = {
      ...entity,
      vertices: controlPoints
    };
    return this.calculatePolylineBounds(polylineEntity, tolerance);
  }

  /**
   * 🔺 POINT BOUNDS
   */
  private static calculatePointBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for PointEntity properties
    const pointEntity = entity as EntityWithPoint;
    const position = pointEntity.position;
    const pointSize = tolerance || 1; // Minimum size for selection

    return this.createBoundingBox(
      position.x - pointSize,
      position.y - pointSize,
      position.x + pointSize,
      position.y + pointSize
    );
  }

  /**
   * 🔺 ANGLE MEASUREMENT BOUNDS
   * Bounding box from vertex + 2 arm endpoints (point1, point2)
   */
  private static calculateAngleMeasurementBounds(entity: EntityModel, tolerance: number): BoundingBox {
    const angleMeasurement = entity as EntityWithAngleMeasurement;
    const { vertex, point1, point2 } = angleMeasurement;

    const minX = Math.min(vertex.x, point1.x, point2.x) - tolerance;
    const minY = Math.min(vertex.y, point1.y, point2.y) - tolerance;
    const maxX = Math.max(vertex.x, point1.x, point2.x) + tolerance;
    const maxY = Math.max(vertex.y, point1.y, point2.y) + tolerance;

    return this.createBoundingBox(minX, minY, maxX, maxY);
  }

  /**
   * 🔺 BOUNDING BOX FACTORY
   * Δημιουργεί BoundingBox object με όλες τις computed properties
   * Delegates to the exported standalone function for use by other modules.
   */
  private static createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
    return createBoundingBox(minX, minY, maxX, maxY);
  }
}

/**
 * 🔺 BOUNDING BOX FACTORY — Standalone exported function
 * Χρησιμοποιείται από BoundsCalculator, BoundsOperations, και ViewportBounds.
 */
export function createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

// 🏢 Re-exports for backward compatibility
export { BoundsOperations, ViewportBounds } from './bounds-operations';