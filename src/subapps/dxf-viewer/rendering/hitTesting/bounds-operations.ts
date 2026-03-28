/**
 * BOUNDS OPERATIONS - Utilities για operations μεταξύ bounding boxes
 * ✅ Extracted from Bounds.ts για compliance με Google SRP file-size rule
 */

import type { Point2D } from '../types/Types';
import { SpatialUtils } from '../../core/spatial/SpatialUtils';
import { transformBoundsToScreen } from '../core/CoordinateTransforms';
import type { BoundingBox } from './Bounds';
import { createBoundingBox } from './Bounds';

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
    return createBoundingBox(
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
    return createBoundingBox(
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
   * 🏢 ADR-066: Delegates to centralized SpatialUtils.distanceToPoint
   */
  static distanceFromPoint(box: BoundingBox, point: Point2D): number {
    // 🏢 ADR-066: Delegate to centralized SpatialUtils - DRY compliance
    return SpatialUtils.distanceToPoint(point, box);
  }

  /**
   * Create bounds from viewport dimensions
   */
  static fromViewport(viewport: { width: number; height: number; x?: number; y?: number }): BoundingBox {
    const x = viewport.x ?? 0;
    const y = viewport.y ?? 0;
    return createBoundingBox(x, y, x + viewport.width, y + viewport.height);
  }

  /**
   * Transform bounds using transform matrix/function
   * Basic transform implementation - extend as needed
   */
  static transform(
    bounds: BoundingBox,
    _transform: { scale?: number; offsetX?: number; offsetY?: number }
  ): BoundingBox {
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
    return createBoundingBox(x, y, x + width, y + height);
  }

  /**
   * 🔺 TRANSFORM BOUNDS
   * Εφαρμόζει transform σε bounding box
   * 🏢 ADR-151: Delegates to centralized transformBoundsToScreen
   */
  static transform(
    box: BoundingBox,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): BoundingBox {
    // 🏢 ADR-151: Use centralized transformBoundsToScreen
    const transformed = transformBoundsToScreen(box, transform);
    return createBoundingBox(
      transformed.minX,
      transformed.minY,
      transformed.maxX,
      transformed.maxY
    );
  }

  /**
   * 🔺 SCREEN TO WORLD BOUNDS
   * Μετατρέπει screen coordinates σε world coordinates
   */
  static screenToWorld(
    screenBox: BoundingBox,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): BoundingBox {
    const minX = (screenBox.minX - transform.offsetX) / transform.scale;
    const minY = (screenBox.minY - transform.offsetY) / transform.scale;
    const maxX = (screenBox.maxX - transform.offsetX) / transform.scale;
    const maxY = (screenBox.maxY - transform.offsetY) / transform.scale;
    return createBoundingBox(minX, minY, maxX, maxY);
  }
}
