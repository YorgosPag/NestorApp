/**
 * Entity conversion utilities
 * Handles converting between different entity types (e.g., line to polyline)
 */

import type { Point2D } from '../rendering/types/Types';
import type { LineEntity, PolylineEntity } from '../types/scene';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { getNearestPointOnLine, calculateMidpoint } from '../rendering/entities/shared/geometry-utils';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';

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
    layerId: lineEntity.layerId,
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
  // 🏢 ADR-065: Use centralized distance calculation
  const distance = calculateDistance(point, closestPoint);
  
  return distance <= tolerance;
}

/** Πού μπαίνει μια νέα κορυφή: σε ποια ακμή, σε ποιο σημείο, σε ποια θέση της λίστας. */
export interface EdgeGripInsertion {
  edgeIndex: number;
  insertPoint: Point2D;
  insertIndex: number;
}

/**
 * Η ΜΙΑ αναζήτηση «σε ποια ακμή θα έμπαινε μια νέα κορυφή» — ADR-718 §Β (N.18 de-duplication).
 *
 * Υπήρχαν **δύο ταυτόσημα σώματα** (`findPolylineEdgeForGrip` για οντότητες,
 * {@link findOverlayEdgeForGrip} για overlays): ίδιο φίλτρο ανοχής, ίδιος φύλακας «όχι πολύ
 * κοντά σε υπάρχουσα κορυφή», ίδια επιλογή ελάχιστης απόστασης — και **μία** πραγματική
 * διαφορά: αν μετριέται και η ακμή **κλεισίματος**. Το jscpd τα έπιασε (133 tokens) όταν το
 * αρχείο ξαναγράφτηκε· τα δύο αντίγραφα θα απέκλιναν στην πρώτη διόρθωση του ενός.
 *
 * Η διαφορά γίνεται **παράμετρος**, ίδιο idiom με το `calculatePolylineLength(points, isClosed)`.
 *
 * ⚠️ Ο φύλακας `tolerance * 2` **δεν** είναι το ίδιο με «η πλησιέστερη ακμή»: μια ακμή που
 * αποτυγχάνει στον φύλακα αποκλείεται και κερδίζει η επόμενη. Γι' αυτό η αναζήτηση φιλτράρει
 * **και μετά** ελαχιστοποιεί, όχι το αντίστροφο — και γι' αυτό ΔΕΝ είναι το ίδιο εργαλείο με
 * το «σε ποια ακμή έκανε δεξί κλικ ο χρήστης» (εκεί δεν υπάρχει υποψηφιότητα, μόνο εγγύτητα).
 */
function findEdgeForGripInsertion(
  point: Point2D,
  vertices: readonly Point2D[],
  tolerance: number,
  isClosed: boolean,
): EdgeGripInsertion | null {
  if (vertices.length < 2) return null;

  let closestEdge: (EdgeGripInsertion & { distance: number }) | null = null;
  // Κλειστό ⇒ μετρά και η ακμή που γυρίζει στην πρώτη κορυφή· ανοιχτό ⇒ μία λιγότερη.
  const edgeCount = isClosed ? vertices.length : vertices.length - 1;

  for (let i = 0; i < edgeCount; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];

    if (!isPointNearLineSegment(point, start, end, tolerance)) continue;

    const insertPoint = getClosestPointOnLineSegment(point, start, end);
    // 🏢 ADR-065: Use centralized distance calculation
    const distance = calculateDistance(point, insertPoint);

    // Don't allow insertion too close to existing vertices
    const startDist = calculateDistance(insertPoint, start);
    const endDist = calculateDistance(insertPoint, end);
    if (startDist <= tolerance * 2 || endDist <= tolerance * 2) continue;

    if (!closestEdge || distance < closestEdge.distance) {
      closestEdge = { edgeIndex: i, insertPoint, insertIndex: i + 1, distance };
    }
  }

  if (!closestEdge) return null;
  const { edgeIndex, insertPoint, insertIndex } = closestEdge;
  return { edgeIndex, insertPoint, insertIndex };
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
): EdgeGripInsertion | null {
  // Ιστορική συμπεριφορά: η ακμή κλεισίματος ΔΕΝ μετριέται εδώ (ο μοναδικός καλών ήταν πάντα
  // διαδρομή ανοιχτής πολυγραμμής). Διατηρείται αυτούσια — η ενοποίηση δεν αλλάζει σημασιολογία.
  return findEdgeForGripInsertion(point, polyline.vertices, tolerance, false);
}

/**
 * ADR-718 §Β — η ελάχιστη μορφή που διαβάζουν/γράφουν οι τρεις επεξεργασίες κλεισίματος:
 * κορυφές + η σημαία. **ΚΑΙ** το `polyline` **ΚΑΙ** το `lwpolyline` την ικανοποιούν δομικά,
 * οπότε ο ΕΝΑΣ command (`SetPolylineClosureCommand`) εξυπηρετεί και τους δύο τύπους **χωρίς
 * cast** ανάμεσα στα μέλη της ένωσης — ένα cast εκεί θα ήταν `as unknown as`, δηλαδή ακριβώς
 * το είδος της σιωπηλής παραδοχής που ο τύπος υπάρχει για να αποτρέψει.
 */
export interface PolylineRing {
  readonly vertices: readonly Point2D[];
  readonly closed?: boolean;
}

/**
 * Close a polyline by setting its closed flag to true
 * @param polyline - The polyline (or lwpolyline) ring to close
 * @returns The ring with closed set to true
 */
export function closePolyline<T extends PolylineRing>(polyline: T): T {
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
  // 🏢 ADR-065: Use centralized distance calculation
  const distance = calculateDistance(point1, point2);
  return distance <= tolerance;
}

/**
 * Open a polygon by setting its closed flag to false
 * @param polyline - The polygon ring to open
 * @returns The ring with closed set to false
 */
export function openPolyline<T extends PolylineRing>(polyline: T): T {
  return {
    ...polyline,
    closed: false
  };
}

/**
 * Open a polygon at a specific edge, reordering vertices so the break point becomes the start/end
 *
 * Ακμή `edgeIndex` = το τμήμα `vertices[edgeIndex] → vertices[(edgeIndex + 1) % N]`. Μετά το
 * άνοιγμα η λίστα ξεκινά από το ΔΕΥΤΕΡΟ άκρο της ακμής, οπότε **αυτή ακριβώς η ακμή** είναι η
 * μία που λείπει. Η τελευταία ακμή (`N-1`, το κλείσιμο) δίνει την ταυτοτική αναδιάταξη, δηλαδή
 * ταυτίζεται με το σκέτο {@link openPolyline} — το ίδιο μαθηματικό, μία συμπεριφορά.
 *
 * @param polyline - The polygon ring to open
 * @param edgeIndex - The index of the edge where to break the polygon (0-based)
 * @returns The ring with vertices reordered and closed set to false
 */
export function openPolylineAtEdge<T extends PolylineRing>(polyline: T, edgeIndex: number): T {
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
): EdgeGripInsertion | null {
  // Τα overlays είναι ΠΑΝΤΑ κλειστά πολύγωνα → μετρά και η ακμή τελευταία→πρώτη. Η μόνη άλλη
  // δουλειά εδώ είναι η μετατροπή μορφής· η αναζήτηση είναι η ΙΔΙΑ (N.18).
  return findEdgeForGripInsertion(point, polygon.map(overlayVertexToPoint2D), tolerance, true);
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

// ============================================================================
// 🏢 ENTERPRISE (2026-01-25): OVERLAY ↔ REGION ADAPTERS
// Adapter Pattern για integration με κεντρικοποιημένο Grip System
// Μετατρέπει Overlay format σε Region format που χρησιμοποιούν τα hooks
// ============================================================================

import type { Overlay } from '../overlays/types';
import type { Region } from '../types/overlay';

/**
 * 🏢 ENTERPRISE ADAPTER: Convert Overlay to Region format
 * Επιτρέπει χρήση του κεντρικοποιημένου useGripDetection με Overlays
 *
 * @param overlay - Overlay με polygon: Array<[number, number]>
 * @returns Region με vertices: Point2D[] (compatible με grip hooks)
 */
export function overlayToRegion(overlay: Overlay): Region {
  return {
    id: overlay.id,
    vertices: overlay.polygon.map(overlayVertexToPoint2D),
    // ADR-258: Αν δεν υπάρχει status, fallback σε 'unavailable' (λευκό/γκρι αντί hardcoded 'for-sale')
    status: overlay.status ?? 'unavailable',
    layer: 'base',
    metadata: overlay.linked ? { linked: overlay.linked } : undefined,
    locked: false,
    visible: true,
    opacity: overlay.style?.opacity ?? 1.0,
    color: overlay.style?.fill,
    levelId: overlay.levelId,
    createdAt: overlay.createdAt ? new Date(overlay.createdAt).toISOString() : undefined,
    updatedAt: overlay.updatedAt ? new Date(overlay.updatedAt).toISOString() : undefined,
  };
}

/**
 * 🏢 ENTERPRISE ADAPTER: Convert multiple Overlays to Regions
 * Batch conversion για efficiency
 *
 * @param overlays - Array of Overlays
 * @returns Array of Regions (compatible με grip hooks)
 */
export function overlaysToRegions(overlays: Overlay[]): Region[] {
  return overlays.map(overlayToRegion);
}

/**
 * 🏢 ENTERPRISE: Update overlay vertex at specific index
 * Χρησιμοποιείται από grip dragging για vertex move
 *
 * @param polygon - Original polygon Array<[number, number]>
 * @param vertexIndex - Index of vertex to update
 * @param newPosition - New position as Point2D
 * @returns New polygon with updated vertex
 */
export function updateOverlayVertex(
  polygon: Array<[number, number]>,
  vertexIndex: number,
  newPosition: Point2D
): Array<[number, number]> {
  if (vertexIndex < 0 || vertexIndex >= polygon.length) {
    return polygon; // Invalid index, return unchanged
  }

  const newPolygon = [...polygon];
  newPolygon[vertexIndex] = point2DToOverlayVertex(newPosition);
  return newPolygon;
}

/**
 * 🏢 ENTERPRISE: Calculate edge midpoint for overlay polygon
 * Υπολογίζει το μεσαίο σημείο μιας ακμής
 *
 * @param polygon - Overlay polygon
 * @param edgeIndex - Index of edge (0 = between vertex 0 and 1)
 * @returns Midpoint as Point2D or null if invalid
 */
export function getOverlayEdgeMidpoint(
  polygon: Array<[number, number]>,
  edgeIndex: number
): Point2D | null {
  if (edgeIndex < 0 || edgeIndex >= polygon.length) {
    return null;
  }

  const start = overlayVertexToPoint2D(polygon[edgeIndex]);
  const end = overlayVertexToPoint2D(polygon[(edgeIndex + 1) % polygon.length]);

  // 🏢 ADR-073: Use centralized midpoint calculation
  return calculateMidpoint(start, end);
}
