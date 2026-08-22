/**
 * 🏢 ENTERPRISE CANVAS COORDINATES
 *
 * Global coordinate system utilities που επεκτείνουν το DXF Canvas system
 * Unified coordinate transformations για όλες τις εφαρμογές
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

/**
 * 📐 BASIC POINT TYPES
 * Core coordinate primitives
 */
export interface Point2D {
  x: number;
  y: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

/**
 * 🎯 COORDINATE TRANSFORMATION MATRIX
 * 2D transformation matrix για coordinate conversions
 */
export interface TransformMatrix {
  a: number; // scale X
  b: number; // skew Y
  c: number; // skew X
  d: number; // scale Y
  e: number; // translate X
  f: number; // translate Y
}

/**
 * 📊 COORDINATE BOUNDS
 * Bounding box representation
 */
export interface CoordinateBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width?: number;
  height?: number;
}

/**
 * 🔧 COORDINATE UTILITIES CLASS
 * Core coordinate transformation utilities
 */
export class CoordinateUtils {
  // ============================================================================
  // BASIC POINT OPERATIONS
  // ============================================================================

  /**
   * Create 2D point
   */
  static point2D(x: number, y: number): Point2D {
    return { x, y };
  }

  /**
   * Copy point
   */
  static copyPoint(point: Point2D): Point2D {
    return { x: point.x, y: point.y };
  }

  /**
   * Check if points are equal
   */
  static pointsEqual(p1: Point2D, p2: Point2D, tolerance: number = 1e-10): boolean {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
  }

  // ============================================================================
  // DISTANCE CALCULATIONS
  // ============================================================================

  /**
   * Calculate distance between two points
   */
  static distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate manhattan distance
   */
  static manhattanDistance(p1: Point2D, p2: Point2D): number {
    return Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
  }

  /**
   * Calculate squared distance (faster for comparisons)
   */
  static distanceSquared(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
  }

  // ============================================================================
  // VECTOR OPERATIONS
  // ============================================================================

  /**
   * Create vector από two points
   */
  static vectorFromPoints(from: Point2D, to: Point2D): Vector2D {
    return {
      x: to.x - from.x,
      y: to.y - from.y
    };
  }

  /**
   * Calculate vector magnitude
   */
  static vectorMagnitude(vector: Vector2D): number {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  }

  /**
   * Normalize vector
   */
  static normalizeVector(vector: Vector2D): Vector2D {
    const magnitude = this.vectorMagnitude(vector);
    if (magnitude === 0) return { x: 0, y: 0 };
    return {
      x: vector.x / magnitude,
      y: vector.y / magnitude
    };
  }

  /**
   * Calculate dot product
   */
  static dotProduct(v1: Vector2D, v2: Vector2D): number {
    return v1.x * v2.x + v1.y * v2.y;
  }

  /**
   * Calculate cross product (2D)
   */
  static crossProduct(v1: Vector2D, v2: Vector2D): number {
    return v1.x * v2.y - v1.y * v2.x;
  }

  // ============================================================================
  // COORDINATE TRANSFORMATIONS
  // ============================================================================

  /**
   * Apply transformation matrix to point
   */
  static transformPoint(point: Point2D, matrix: TransformMatrix): Point2D {
    return {
      x: point.x * matrix.a + point.y * matrix.c + matrix.e,
      y: point.x * matrix.b + point.y * matrix.d + matrix.f
    };
  }

  /**
   * Create identity transformation matrix
   */
  static identityMatrix(): TransformMatrix {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  /**
   * Create translation matrix
   */
  static translationMatrix(dx: number, dy: number): TransformMatrix {
    return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy };
  }

  /**
   * Create scale matrix
   */
  static scaleMatrix(sx: number, sy: number = sx): TransformMatrix {
    return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
  }

  /**
   * Create rotation matrix
   */
  static rotationMatrix(angle: number): TransformMatrix {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  }

  /**
   * Multiply transformation matrices
   */
  static multiplyMatrices(m1: TransformMatrix, m2: TransformMatrix): TransformMatrix {
    return {
      a: m1.a * m2.a + m1.b * m2.c,
      b: m1.a * m2.b + m1.b * m2.d,
      c: m1.c * m2.a + m1.d * m2.c,
      d: m1.c * m2.b + m1.d * m2.d,
      e: m1.e * m2.a + m1.f * m2.c + m2.e,
      f: m1.e * m2.b + m1.f * m2.d + m2.f
    };
  }

  /**
   * Invert transformation matrix
   */
  static invertMatrix(matrix: TransformMatrix): TransformMatrix | null {
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    if (Math.abs(det) < 1e-10) return null; // Matrix is not invertible

    const invDet = 1 / det;
    return {
      a: matrix.d * invDet,
      b: -matrix.b * invDet,
      c: -matrix.c * invDet,
      d: matrix.a * invDet,
      e: (matrix.c * matrix.f - matrix.d * matrix.e) * invDet,
      f: (matrix.b * matrix.e - matrix.a * matrix.f) * invDet
    };
  }

  // ============================================================================
  // BOUNDS OPERATIONS
  // ============================================================================

  /**
   * Create bounds από points
   */
  static boundsFromPoints(points: Point2D[]): CoordinateBounds {
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if point is inside bounds
   */
  static pointInBounds(point: Point2D, bounds: CoordinateBounds): boolean {
    return (
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
    );
  }

  /**
   * Expand bounds by margin
   */
  static expandBounds(bounds: CoordinateBounds, margin: number): CoordinateBounds {
    return {
      minX: bounds.minX - margin,
      minY: bounds.minY - margin,
      maxX: bounds.maxX + margin,
      maxY: bounds.maxY + margin,
      width: (bounds.width || 0) + 2 * margin,
      height: (bounds.height || 0) + 2 * margin
    };
  }

  /**
   * Get bounds center point
   */
  static getBoundsCenter(bounds: CoordinateBounds): Point2D {
    return {
      x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
      y: bounds.minY + (bounds.maxY - bounds.minY) / 2
    };
  }

  // ============================================================================
  // COORDINATE SPACE CONVERSIONS
  // ============================================================================

  /**
   * Convert screen to canvas coordinates
   * Επεκτείνει το υπάρχον DXF CanvasUtils system
   */
  static screenToCanvas(
    screenPoint: Point2D,
    canvasRect: DOMRect,
    transform?: {
      scale: number;
      panX: number;
      panY: number;
    }
  ): Point2D {
    const canvasPoint = {
      x: screenPoint.x - canvasRect.left,
      y: screenPoint.y - canvasRect.top
    };

    if (transform) {
      return {
        x: (canvasPoint.x - transform.panX) / transform.scale,
        y: (canvasPoint.y - transform.panY) / transform.scale
      };
    }

    return canvasPoint;
  }

  /**
   * Convert canvas to screen coordinates
   * Επεκτείνει το υπάρχον DXF CanvasUtils system
   */
  static canvasToScreen(
    canvasPoint: Point2D,
    canvasRect: DOMRect,
    transform?: {
      scale: number;
      panX: number;
      panY: number;
    }
  ): Point2D {
    let screenPoint = canvasPoint;

    if (transform) {
      screenPoint = {
        x: canvasPoint.x * transform.scale + transform.panX,
        y: canvasPoint.y * transform.scale + transform.panY
      };
    }

    return {
      x: screenPoint.x + canvasRect.left,
      y: screenPoint.y + canvasRect.top
    };
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Clamp point to bounds
   */
  static clampToBounds(point: Point2D, bounds: CoordinateBounds): Point2D {
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y))
    };
  }

  /**
   * Lerp between two points
   */
  static lerp(p1: Point2D, p2: Point2D, t: number): Point2D {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  /**
   * Round point coordinates
   */
  static roundPoint(point: Point2D, precision: number = 0): Point2D {
    const factor = Math.pow(10, precision);
    return {
      x: Math.round(point.x * factor) / factor,
      y: Math.round(point.y * factor) / factor
    };
  }

  /**
   * Check if number is approximately equal
   */
  static approximatelyEqual(a: number, b: number, tolerance: number = 1e-10): boolean {
    return Math.abs(a - b) < tolerance;
  }

  /**
   * Convert degrees to radians
   */
  static degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  static radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
  }
}