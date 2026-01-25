/**
 * Entity conversion utilities
 * Handles converting between different entity types (e.g., line to polyline)
 */

import type { Point2D } from '../rendering/types/Types';
import type { LineEntity, PolylineEntity, AnySceneEntity } from '../types/scene';
import { getNearestPointOnLine } from '../rendering/entities/shared/geometry-utils';

/**
 * Convert a line entity to a polyline entity
 * @param lineEntity - The line entity to convert
 * @param insertPoint - Optional point to insert as a new vertex
 * @returns A new polyline entity
 */
export function convertLineToPolyline(
  lineEntity: LineEntity, 
  insertPoint?: Point2D
): PolylineEntity {
  const vertices: Point2D[] = [lineEntity.start, lineEntity.end];
  
  // If an insert point is provided, add it between start and end
  if (insertPoint) {
    vertices.splice(1, 0, insertPoint);
  }
  
  return {
    id: lineEntity.id,
    type: 'polyline',
    layer: lineEntity.layer,
    color: lineEntity.color,
    lineweight: lineEntity.lineweight,
    visible: lineEntity.visible,
    name: lineEntity.name,
    vertices,
    closed: false
  };
}

/**
 * Add a vertex to a polyline at the specified position
 * @param polyline - The polyline entity
 * @param insertIndex - Index where to insert the new vertex
 * @param newVertex - The new vertex to insert
 * @returns Updated polyline entity
 */
export function addVertexToPolyline(
  polyline: PolylineEntity,
  insertIndex: number,
  newVertex: Point2D
): PolylineEntity {
  const newVertices = [...polyline.vertices];
  newVertices.splice(insertIndex, 0, newVertex);
  
  return {
    ...polyline,
    vertices: newVertices
  };
}

/**
 * Calculate the closest point on a line segment to a given point
 * @param point - The point to project
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @returns The closest point on the line segment
 */
export function getClosestPointOnLineSegment(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): Point2D {
  // Use shared geometry utils implementation
  return getNearestPointOnLine(point, lineStart, lineEnd, true);
}

/**
 * Check if a point is close enough to a line segment to add a grip
 * @param point - The point to test
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @param tolerance - Distance tolerance
 * @returns True if point is close to line segment
 */
export function isPointNearLineSegment(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
  tolerance: number
): boolean {
  const closestPoint = getClosestPointOnLineSegment(point, lineStart, lineEnd);
  const distance = Math.sqrt(
    Math.pow(point.x - closestPoint.x, 2) + 
    Math.pow(point.y - closestPoint.y, 2)
  );
  
  return distance <= tolerance;
}

/**
 * Find which edge of a polyline is closest to a point and return info for adding a grip
 * @param point - The point to test
 * @param polyline - The polyline entity
 * @param tolerance - Distance tolerance
 * @returns Edge info for grip insertion or null if no close edge found
 */
export function findPolylineEdgeForGrip(
  point: Point2D,
  polyline: PolylineEntity,
  tolerance: number
): { edgeIndex: number; insertPoint: Point2D; insertIndex: number } | null {
  const vertices = polyline.vertices;
  if (vertices.length < 2) return null;

  let closestEdge: { edgeIndex: number; insertPoint: Point2D; insertIndex: number; distance: number } | null = null;

  // Check each edge of the polyline
  for (let i = 0; i < vertices.length - 1; i++) {
    const start = vertices[i];
    const end = vertices[i + 1];

    if (isPointNearLineSegment(point, start, end, tolerance)) {
      const insertPoint = getClosestPointOnLineSegment(point, start, end);
      const distance = Math.sqrt(
        Math.pow(point.x - insertPoint.x, 2) + 
        Math.pow(point.y - insertPoint.y, 2)
      );

      // Don't allow insertion too close to existing vertices
      const startDist = Math.sqrt(Math.pow(insertPoint.x - start.x, 2) + Math.pow(insertPoint.y - start.y, 2));
      const endDist = Math.sqrt(Math.pow(insertPoint.x - end.x, 2) + Math.pow(insertPoint.y - end.y, 2));
      
      if (startDist > tolerance * 2 && endDist > tolerance * 2) {
        if (!closestEdge || distance < closestEdge.distance) {
          closestEdge = {
            edgeIndex: i,
            insertPoint,
            insertIndex: i + 1, // Insert after vertex i
            distance
          };
        }
      }
    }
  }

  return closestEdge ? {
    edgeIndex: closestEdge.edgeIndex,
    insertPoint: closestEdge.insertPoint,
    insertIndex: closestEdge.insertIndex
  } : null;
}

/**
 * Close a polyline by setting its closed flag to true
 * @param polyline - The polyline entity to close
 * @returns The polyline with closed set to true
 */
export function closePolyline(polyline: PolylineEntity): PolylineEntity {
  return {
    ...polyline,
    closed: true
  };
}

/**
 * Check if two points are close enough to be considered for connection
 * @param point1 - First point
 * @param point2 - Second point  
 * @param tolerance - Distance tolerance
 * @returns True if points are close enough to connect
 */
export function arePointsConnectable(
  point1: Point2D, 
  point2: Point2D, 
  tolerance: number
): boolean {
  const distance = Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
  );
  return distance <= tolerance;
}

/**
 * Open a polygon by setting its closed flag to false
 * @param polyline - The polygon entity to open
 * @returns The polyline with closed set to false
 */
export function openPolyline(polyline: PolylineEntity): PolylineEntity {
  return {
    ...polyline,
    closed: false
  };
}

/**
 * Open a polygon at a specific edge, reordering vertices so the break point becomes the start/end
 * @param polyline - The polygon entity to open 
 * @param edgeIndex - The index of the edge where to break the polygon (0-based)
 * @returns The polyline with vertices reordered and closed set to false
 */
export function openPolylineAtEdge(polyline: PolylineEntity, edgeIndex: number): PolylineEntity {
  if (!polyline.closed || polyline.vertices.length < 3) {
    return polyline; // Cannot break if not closed or insufficient vertices
  }
  
  if (edgeIndex < 0 || edgeIndex >= polyline.vertices.length) {
    return openPolyline(polyline); // Invalid edge index, just open normally
  }
  
  // Reorder vertices so that the break happens at the specified edge
  // Edge edgeIndex connects vertex[edgeIndex] to vertex[(edgeIndex + 1) % length]
  const newVertices = [
    ...polyline.vertices.slice(edgeIndex + 1),
    ...polyline.vertices.slice(0, edgeIndex + 1)
  ];
  
  return {
    ...polyline,
    vertices: newVertices,
    closed: false
  };
}

/**
 * Check if a polyline can be closed by connecting its endpoints
 * @param polyline - The polyline to check
 * @param tolerance - Distance tolerance for connection
 * @returns True if the polyline can be closed
 */
export function canPolylineBeClosedByConnection(
  polyline: PolylineEntity,
  tolerance: number
): boolean {
  if (polyline.closed || polyline.vertices.length < 3) return false;
  
  const firstVertex = polyline.vertices[0];
  const lastVertex = polyline.vertices[polyline.vertices.length - 1];

  return arePointsConnectable(firstVertex, lastVertex, tolerance);
}

// ============================================================================
// 🏢 ENTERPRISE (2026-01-25): OVERLAY POLYGON UTILITIES
// Επέκταση για Overlay polygon format: Array<[number, number]>
// Χρησιμοποιεί τις υπάρχουσες geometry utilities με format conversion
// ============================================================================

/**
 * Convert overlay polygon vertex to Point2D
 * @param vertex - Overlay vertex format [x, y]
 * @returns Point2D format { x, y }
 */
export function overlayVertexToPoint2D(vertex: [number, number]): Point2D {
  return { x: vertex[0], y: vertex[1] };
}

/**
 * Convert Point2D to overlay polygon vertex
 * @param point - Point2D format { x, y }
 * @returns Overlay vertex format [x, y]
 */
export function point2DToOverlayVertex(point: Point2D): [number, number] {
  return [point.x, point.y];
}

/**
 * Find which edge of an overlay polygon is closest to a point
 * Uses existing geometry utilities with format conversion
 * @param point - The point to test (world coordinates)
 * @param polygon - Overlay polygon format Array<[number, number]>
 * @param tolerance - Distance tolerance (in world units)
 * @returns Edge info for vertex insertion or null if no close edge found
 */
export function findOverlayEdgeForGrip(
  point: Point2D,
  polygon: Array<[number, number]>,
  tolerance: number
): { edgeIndex: number; insertPoint: Point2D; insertIndex: number } | null {
  if (polygon.length < 2) return null;

  let closestEdge: {
    edgeIndex: number;
    insertPoint: Point2D;
    insertIndex: number;
    distance: number
  } | null = null;

  // Check each edge of the polygon (including closing edge for closed polygons)
  const edgeCount = polygon.length; // For closed polygons, last edge connects last→first

  for (let i = 0; i < edgeCount; i++) {
    const startVertex = polygon[i];
    const endVertex = polygon[(i + 1) % polygon.length]; // Wrap around for closed polygon

    const start = overlayVertexToPoint2D(startVertex);
    const end = overlayVertexToPoint2D(endVertex);

    // Use existing utility for edge detection
    if (isPointNearLineSegment(point, start, end, tolerance)) {
      const insertPoint = getClosestPointOnLineSegment(point, start, end);
      const distance = Math.sqrt(
        Math.pow(point.x - insertPoint.x, 2) +
        Math.pow(point.y - insertPoint.y, 2)
      );

      // Don't allow insertion too close to existing vertices
      const startDist = Math.sqrt(
        Math.pow(insertPoint.x - start.x, 2) +
        Math.pow(insertPoint.y - start.y, 2)
      );
      const endDist = Math.sqrt(
        Math.pow(insertPoint.x - end.x, 2) +
        Math.pow(insertPoint.y - end.y, 2)
      );

      // Minimum distance from existing vertices (2x tolerance)
      if (startDist > tolerance * 2 && endDist > tolerance * 2) {
        if (!closestEdge || distance < closestEdge.distance) {
          closestEdge = {
            edgeIndex: i,
            insertPoint,
            insertIndex: i + 1, // Insert after vertex i
            distance
          };
        }
      }
    }
  }

  return closestEdge ? {
    edgeIndex: closestEdge.edgeIndex,
    insertPoint: closestEdge.insertPoint,
    insertIndex: closestEdge.insertIndex
  } : null;
}

/**
 * Add a vertex to an overlay polygon at the specified position
 * @param polygon - The overlay polygon Array<[number, number]>
 * @param insertIndex - Index where to insert the new vertex
 * @param newVertex - The new vertex to insert (Point2D or [x, y])
 * @returns New polygon array with inserted vertex
 */
export function addVertexToOverlayPolygon(
  polygon: Array<[number, number]>,
  insertIndex: number,
  newVertex: Point2D | [number, number]
): Array<[number, number]> {
  const newPolygon = [...polygon];
  const vertexToInsert: [number, number] = Array.isArray(newVertex)
    ? newVertex
    : point2DToOverlayVertex(newVertex);

  newPolygon.splice(insertIndex, 0, vertexToInsert);

  return newPolygon;
}

/**
 * Remove a vertex from an overlay polygon
 * @param polygon - The overlay polygon Array<[number, number]>
 * @param vertexIndex - Index of vertex to remove
 * @param minVertices - Minimum vertices required (default 3 for triangle)
 * @returns New polygon array or null if removal would violate minimum
 */
export function removeVertexFromOverlayPolygon(
  polygon: Array<[number, number]>,
  vertexIndex: number,
  minVertices: number = 3
): Array<[number, number]> | null {
  if (polygon.length <= minVertices) {
    return null; // Cannot remove - would violate minimum
  }

  if (vertexIndex < 0 || vertexIndex >= polygon.length) {
    return null; // Invalid index
  }

  const newPolygon = [...polygon];
  newPolygon.splice(vertexIndex, 1);

  return newPolygon;
}