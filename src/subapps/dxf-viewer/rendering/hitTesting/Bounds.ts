/**
 * BOUNDS UTILITIES - Bounding box calculations για spatial indexing
 * ✅ ΦΑΣΗ 5: Core utilities για hit-testing και spatial queries
 */

import type { EntityModel, Point2D } from '../types/Types';
// 🏢 ADR-070: Centralized Vector Magnitude
import { vectorMagnitude } from '../entities/shared/geometry-rendering-utils';

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
}

interface SplineEntityProperties {
  controlPoints?: Point2D[];
  vertices?: Point2D[];
}

interface PointEntityProperties {
  position: Point2D;
}

// 🏢 ENTERPRISE: Type guard helpers
type EntityWithLine = EntityModel & LineEntityProperties;
type EntityWithCircle = EntityModel & CircleEntityProperties;
type EntityWithPolyline = EntityModel & PolylineEntityProperties;
type EntityWithEllipse = EntityModel & EllipseEntityProperties;
type EntityWithText = EntityModel & TextEntityProperties;
type EntityWithSpline = EntityModel & SplineEntityProperties;
type EntityWithPoint = EntityModel & PointEntityProperties;

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
   * Εκτίμηση βάσει font size - θα μπορούσε να βελτιωθεί με measureText
   */
  private static calculateTextBounds(entity: EntityModel, tolerance: number): BoundingBox {
    // 🏢 ENTERPRISE: Type-safe casting for TextEntity properties
    const textEntity = entity as EntityWithText;
    const position = textEntity.position;
    const text = textEntity.text || '';
    const fontSize = textEntity.fontSize || 12;

    // Rough estimation - 0.6 * fontSize per character width
    const estimatedWidth = text.length * fontSize * 0.6;
    const estimatedHeight = fontSize;

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
   * 🔺 BOUNDING BOX FACTORY
   * Δημιουργεί BoundingBox object με όλες τις computed properties
   */
  private static createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
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
}

/**
 * 🔺 BOUNDING BOX OPERATIONS
 * Utilities για operations μεταξύ bounding boxes
 */
export class BoundsOperations {
  /**
   * 🔺 INTERSECTION CHECK
   * Ελέγχει αν δύο bounding boxes τέμνονται
   */
  static intersects(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(box1.maxX < box2.minX ||
             box1.minX > box2.maxX ||
             box1.maxY < box2.minY ||
             box1.minY > box2.maxY);
  }

  /**
   * 🔺 CONTAINS CHECK
   * Ελέγχει αν το box1 περιέχει εντελώς το box2
   */
  static contains(box1: BoundingBox, box2: BoundingBox): boolean {
    return box1.minX <= box2.minX &&
           box1.minY <= box2.minY &&
           box1.maxX >= box2.maxX &&
           box1.maxY >= box2.maxY;
  }

  /**
   * 🔺 POINT INSIDE CHECK
   * Ελέγχει αν ένα point είναι μέσα σε bounding box
   */
  static containsPoint(box: BoundingBox, point: Point2D): boolean {
    return point.x >= box.minX &&
           point.x <= box.maxX &&
           point.y >= box.minY &&
           point.y <= box.maxY;
  }

  /**
   * 🔺 UNION
   * Δημιουργεί το μικρότερο box που περιέχει και τα δύο
   */
  static union(box1: BoundingBox, box2: BoundingBox): BoundingBox {
    return BoundsCalculator['createBoundingBox'](
      Math.min(box1.minX, box2.minX),
      Math.min(box1.minY, box2.minY),
      Math.max(box1.maxX, box2.maxX),
      Math.max(box1.maxY, box2.maxY)
    );
  }

  /**
   * 🔺 EXPAND
   * Επεκτείνει ένα bounding box κατά ένα margin
   */
  static expand(box: BoundingBox, margin: number): BoundingBox {
    return BoundsCalculator['createBoundingBox'](
      box.minX - margin,
      box.minY - margin,
      box.maxX + margin,
      box.maxY + margin
    );
  }

  /**
   * 🔺 AREA CALCULATION
   * Υπολογίζει την επιφάνεια ενός bounding box
   */
  static area(box: BoundingBox): number {
    return box.width * box.height;
  }

  /**
   * 🔺 DISTANCE FROM POINT
   * Υπολογίζει την απόσταση από ένα point στο κοντινότερο σημείο του box
   */
  static distanceFromPoint(box: BoundingBox, point: Point2D): number {
    const dx = Math.max(0, Math.max(box.minX - point.x, point.x - box.maxX));
    const dy = Math.max(0, Math.max(box.minY - point.y, point.y - box.maxY));
    // 🏢 ADR-070: Use centralized vector magnitude
    return vectorMagnitude({ x: dx, y: dy });
  }

  // ✅ ENTERPRISE FIX: Added missing methods για HitTester.ts TS2339 errors

  /**
   * Create bounds from viewport dimensions
   */
  static fromViewport(viewport: { width: number; height: number; x?: number; y?: number }) {
    return {
      minX: viewport.x || 0,
      minY: viewport.y || 0,
      maxX: (viewport.x || 0) + viewport.width,
      maxY: (viewport.y || 0) + viewport.height,
      width: viewport.width,
      height: viewport.height
    };
  }

  /**
   * Transform bounds using transform matrix/function
   */
  static transform(bounds: BoundingBox, transform: { scale?: number; offsetX?: number; offsetY?: number }): BoundingBox {
    // Basic transform implementation - extend as needed
    return bounds;
  }
}

/**
 * 🔺 VIEWPORT BOUNDS
 * Utilities για viewport-based operations
 */
export class ViewportBounds {
  /**
   * 🔺 CREATE VIEWPORT BOUNDS
   * Δημιουργεί bounding box από viewport coordinates
   */
  static fromViewport(x: number, y: number, width: number, height: number): BoundingBox {
    return BoundsCalculator['createBoundingBox'](x, y, x + width, y + height);
  }

  /**
   * 🔺 TRANSFORM BOUNDS
   * Εφαρμόζει transform σε bounding box
   */
  static transform(box: BoundingBox, transform: { scale: number; offsetX: number; offsetY: number }): BoundingBox {
    const minX = box.minX * transform.scale + transform.offsetX;
    const minY = box.minY * transform.scale + transform.offsetY;
    const maxX = box.maxX * transform.scale + transform.offsetX;
    const maxY = box.maxY * transform.scale + transform.offsetY;

    return BoundsCalculator['createBoundingBox'](minX, minY, maxX, maxY);
  }

  /**
   * 🔺 SCREEN TO WORLD BOUNDS
   * Μετατρέπει screen coordinates σε world coordinates
   */
  static screenToWorld(screenBox: BoundingBox, transform: { scale: number; offsetX: number; offsetY: number }): BoundingBox {
    const minX = (screenBox.minX - transform.offsetX) / transform.scale;
    const minY = (screenBox.minY - transform.offsetY) / transform.scale;
    const maxX = (screenBox.maxX - transform.offsetX) / transform.scale;
    const maxY = (screenBox.maxY - transform.offsetY) / transform.scale;

    return BoundsCalculator['createBoundingBox'](minX, minY, maxX, maxY);
  }
}