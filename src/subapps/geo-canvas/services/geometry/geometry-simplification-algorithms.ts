/**
 * 🔧 GEOMETRY SIMPLIFICATION — ALGORITHMS & TYPES
 *
 * Douglas-Peucker simplification + LOD management.
 * Extracted from GeometrySimplificationEngine.ts (ADR-065 SRP).
 */

import type { BoundingBox } from '../../types/administrative-types';

// ============================================================================
// TYPES
// ============================================================================

export interface SimplificationConfig {
  enableSimplification: boolean;
  dynamicLOD: boolean;
  preserveTopology: boolean;
  maxComplexityThreshold: number;
  minComplexityThreshold: number;
  adaptiveSimplification: boolean;
}

export interface ViewportContext {
  zoom: number;
  bounds: BoundingBox;
  mapWidth: number;
  mapHeight: number;
  pixelRatio: number;
}

export interface SimplificationResult {
  originalGeometry: GeoJSON.Geometry;
  simplifiedGeometry: GeoJSON.Geometry;
  originalPoints: number;
  simplifiedPoints: number;
  reductionRatio: number;
  processingTime: number;
  qualityScore: number;
  optimizationLevel: 'none' | 'light' | 'medium' | 'heavy';
}

export interface LODLevel {
  name: string;
  minZoom: number;
  maxZoom: number;
  tolerance: number;
  maxPoints: number;
  preserveArea: boolean;
  preserveShape: boolean;
}

// ============================================================================
// DOUGLAS-PEUCKER ALGORITHM
// ============================================================================

/**
 * Douglas-Peucker line simplification algorithm.
 * Recursively removes points that don't contribute significantly to line shape.
 */
export class DouglasPeuckerSimplifier {

  public static simplifyLineString(coordinates: number[][], tolerance: number): number[][] {
    if (coordinates.length <= 2) return coordinates;

    const simplified = this.douglasPeucker(coordinates, tolerance);
    if (simplified.length < 2) {
      return [coordinates[0], coordinates[coordinates.length - 1]];
    }
    return simplified;
  }

  public static simplifyPolygon(coordinates: number[][][], tolerance: number): number[][][] {
    return coordinates.map(ring => {
      if (ring.length <= 3) return ring;

      const simplified = this.douglasPeucker(ring, tolerance);

      if (simplified.length >= 3) {
        const first = simplified[0];
        const last = simplified[simplified.length - 1];

        if (first[0] !== last[0] || first[1] !== last[1]) {
          simplified.push([...first]);
        }

        if (simplified.length < 4) return ring;
      }

      return simplified.length >= 4 ? simplified : ring;
    });
  }

  private static douglasPeucker(points: number[][], tolerance: number): number[][] {
    if (points.length <= 2) return points;

    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance) {
      const leftSegment = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const rightSegment = this.douglasPeucker(points.slice(maxIndex), tolerance);
      return [...leftSegment.slice(0, -1), ...rightSegment];
    }

    return [start, end];
  }

  private static perpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    if (x1 === x2 && y1 === y2) {
      return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
    }

    const A = y2 - y1;
    const B = x1 - x2;
    const C = x2 * y1 - x1 * y2;

    return Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B);
  }
}

// ============================================================================
// LEVEL OF DETAIL (LOD) SYSTEM
// ============================================================================

/**
 * Level of Detail management for administrative boundaries.
 */
export class LODManager {

  private static readonly LOD_LEVELS: LODLevel[] = [
    { name: 'overview',  minZoom: 0,  maxZoom: 4,  tolerance: 0.01,   maxPoints: 50,  preserveArea: true, preserveShape: false },
    { name: 'regional',  minZoom: 4,  maxZoom: 8,  tolerance: 0.005,  maxPoints: 100, preserveArea: true, preserveShape: true },
    { name: 'detailed',  minZoom: 8,  maxZoom: 12, tolerance: 0.001,  maxPoints: 200, preserveArea: true, preserveShape: true },
    { name: 'precise',   minZoom: 12, maxZoom: 18, tolerance: 0.0005, maxPoints: 500, preserveArea: true, preserveShape: true }
  ];

  public static getLODLevel(zoom: number): LODLevel {
    for (const level of this.LOD_LEVELS) {
      if (zoom >= level.minZoom && zoom < level.maxZoom) {
        return level;
      }
    }
    return this.LOD_LEVELS[this.LOD_LEVELS.length - 1];
  }

  public static calculateAdaptiveTolerance(viewport: ViewportContext, baseLevel: LODLevel): number {
    let tolerance = baseLevel.tolerance;

    tolerance *= Math.max(0.5, 2 / viewport.pixelRatio);

    const viewportArea = viewport.mapWidth * viewport.mapHeight;
    const baseArea = 1920 * 1080;
    const areaFactor = Math.sqrt(viewportArea / baseArea);
    tolerance *= Math.max(0.5, 1 / areaFactor);

    return tolerance;
  }
}
